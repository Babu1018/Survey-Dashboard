from fastapi import APIRouter, Depends, HTTPException, File, Form, UploadFile, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from collections import Counter
from database import get_db
from models.survey import Survey, Question, Response, Answer, QuestionOption
from schemas.survey import SurveySchema, SurveyDetailSchema, ResponseSchema, MyResponseOut
from auth_utils import get_current_user, require_role
from ws_manager import manager
from notifications import notify_submission_received
import json
import shutil
import os
import time

router = APIRouter(prefix="/api/surveys", tags=["surveys"])

class BulkDeleteSurveyRequest(BaseModel):
    ids: Optional[List[int]] = None
    category: Optional[str] = None

@router.post("/bulk-delete")
def bulk_delete_surveys(
    request: BulkDeleteSurveyRequest,
    db: Session = Depends(get_db),
    current_user: Session = Depends(require_role(["Admin", "Manager"]))
):
    if not request.ids and not request.category:
        raise HTTPException(status_code=400, detail="Must provide ids or category")
    
    query = db.query(Survey)
    if request.ids:
        query = query.filter(Survey.id.in_(request.ids))
    if request.category:
        query = query.filter(Survey.category == request.category)
    
    surveys_to_delete = query.all()
    count = len(surveys_to_delete)
    
    for s in surveys_to_delete:
        db.delete(s)
    
    db.commit()
    return {"message": f"Deleted {count} survey(s)", "count": count}

UPLOAD_DIR = "uploads"
MAX_FILE_SIZE = 200 * 1024 * 1024 # 200MB

@router.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: Session = Depends(require_role(["Admin", "Manager"]))
):
    # Check file size
    file_size = 0
    temp_file_path = f"temp_{file.filename}"
    
    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        file_size = os.path.getsize(temp_file_path)
    
    if file_size > MAX_FILE_SIZE:
        os.remove(temp_file_path)
        raise HTTPException(status_code=413, detail="File too large. Max size 200MB")

    # Generate unique filename
    timestamp = int(time.time())
    safe_filename = file.filename.replace(" ", "_")
    file_ext = os.path.splitext(safe_filename)[1].lower()
    unique_filename = f"{timestamp}_{safe_filename}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Move temp file to final destination
    shutil.move(temp_file_path, file_path)
    
    base_url = str(request.base_url).rstrip('/')
    return {"url": f"{base_url}/uploads/{unique_filename}", "filename": unique_filename}


# Which extensions each configurable "family" on a Media Upload question
# accepts. The respondent's browser is told the same list via the file input's
# accept attribute, but that is only a hint — this is the check that counts.
ANSWER_FILE_EXTENSIONS = {
    "image": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".heic"},
    "document": {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".rtf", ".odt"},
    "video": {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"},
    "audio": {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"},
}


@router.post("/upload-answer")
async def upload_answer_file(
    request: Request,
    file: UploadFile = File(...),
    question_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Attach a file as the answer to a Media Upload question.

    Separate from /upload (which is Admin/Manager-only, for authoring survey
    media) because the people answering a survey are ordinary Users. The
    per-question `allowed_file_types` and `max_file_size_mb` set by the admin
    are enforced here rather than trusted from the client.
    """
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    if question.question_type != "file_upload":
        raise HTTPException(status_code=400, detail="This question does not accept file uploads")

    file_ext = os.path.splitext(file.filename or "")[1].lower()

    # Empty/absent config means "any of the families we know about".
    families = [f.strip() for f in (question.allowed_file_types or "").split(",") if f.strip()]
    if not families:
        families = list(ANSWER_FILE_EXTENSIONS.keys())
    permitted = set()
    for family in families:
        permitted |= ANSWER_FILE_EXTENSIONS.get(family, set())
    if file_ext not in permitted:
        raise HTTPException(
            status_code=400,
            detail=f"{file_ext or 'That file type'} is not accepted here. Allowed: {', '.join(sorted(families))}.",
        )

    limit_mb = question.max_file_size_mb or 10
    limit_bytes = limit_mb * 1024 * 1024

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    timestamp = int(time.time())
    safe_filename = (file.filename or "upload").replace(" ", "_")
    unique_filename = f"ans{question_id}_{timestamp}_{safe_filename}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    # Stream to disk, aborting as soon as the size ceiling is passed so an
    # oversized upload can't fill the disk before it is rejected.
    written = 0
    try:
        with open(file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > limit_bytes:
                    buffer.close()
                    os.remove(file_path)
                    raise HTTPException(status_code=413, detail=f"File too large. Max size {limit_mb}MB")
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}")

    base_url = str(request.base_url).rstrip("/")
    return {
        "url": f"{base_url}/uploads/{unique_filename}",
        "filename": file.filename,
        "size": written,
    }

@router.post("/maintenance/repair")
def repair_database(
    db: Session = Depends(get_db),
    current_user: Session = Depends(require_role(["Admin"]))
):
    # Run the equivalent of fix_db_schema.py and fix_cascades_v2.py
    from sqlalchemy import text
    try:
        # 1. Check and add columns (simplified version of fix_db_schema.py)
        # Questions table
        needed_questions = [
            ("scale", "VARCHAR(100)"),
            ("score_threshold", "INTEGER"),
            ("score_rules", "TEXT"),
            ("threshold_next_question", "INTEGER"),
            ("backward_question", "INTEGER"),
            ("rating_max", "INTEGER DEFAULT 5"),
            ("low_label", "VARCHAR(100)"),
            ("high_label", "VARCHAR(100)")
        ]
        for col, col_type in needed_questions:
            try:
                db.execute(text(f"ALTER TABLE questions ADD COLUMN {col} {col_type}"))
                db.commit()
            except Exception:
                db.rollback() # Column likely already exists
        
        # QuestionOptions table
        needed_options = [
            ("next_question", "INTEGER"),
            ("score", "INTEGER DEFAULT 0"),
            ("is_red_flag", "BOOLEAN DEFAULT FALSE"),
            ("media_url", "VARCHAR(1000)")
        ]
        for col, col_type in needed_options:
            try:
                db.execute(text(f"ALTER TABLE question_options ADD COLUMN {col} {col_type}"))
                db.commit()
            except Exception:
                db.rollback()

        # Responses table
        try:
            db.execute(text("ALTER TABLE responses ADD COLUMN status VARCHAR(50) DEFAULT 'Pending'"))
            db.commit()
        except Exception:
            db.rollback()

        # 2. Fix Cascades (simplified version of fix_cascades_v2.py)
        targets = [
            ('survey_assignments', 'surveys', 'survey_id'),
            ('user_survey_assignments', 'surveys', 'survey_id'),
            ('questions', 'surveys', 'survey_id'),
            ('responses', 'surveys', 'survey_id'),
            ('question_options', 'questions', 'question_id'),
            ('answers', 'responses', 'response_id'),
            ('answers', 'questions', 'question_id'),
            ('survey_assignments', 'user_groups', 'group_id'),
            ('user_group_membership', 'user_groups', 'group_id'),
            ('user_group_membership', 'users', 'user_id')
        ]
        for table, ref_table, col in targets:
            res = db.execute(text(f"""
                SELECT conname 
                FROM pg_constraint 
                WHERE conrelid = '{table}'::regclass 
                AND confrelid = '{ref_table}'::regclass;
            """))
            for row in res:
                conname = row[0]
                db.execute(text(f"ALTER TABLE {table} DROP CONSTRAINT {conname}"))
                db.execute(text(f"ALTER TABLE {table} ADD CONSTRAINT {conname} FOREIGN KEY ({col}) REFERENCES {ref_table}(id) ON DELETE CASCADE"))
                db.commit()

        return {"message": "Database repair successful (Columns verified & Cascades applied)"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Repair failed: {str(e)}")

@router.get("/", response_model=List[SurveyDetailSchema])
def get_surveys(
    category: Optional[str] = None, 
    db: Session = Depends(get_db),
    current_user: Session = Depends(get_current_user)
):
    query = db.query(Survey)
    if category:
        query = query.filter(Survey.category == category)
    return query.all()

# Registered ahead of /{survey_id} so "my-responses" isn't swallowed by that
# path parameter route (same reasoning as /api/users/login-logs vs /{user_id}).
@router.get("/my-responses", response_model=List[MyResponseOut])
def get_my_responses(
    db: Session = Depends(get_db),
    current_user: Session = Depends(get_current_user)
):
    responses = (
        db.query(Response)
        .filter(Response.user_id == current_user.id)
        .order_by(Response.completed_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "survey_id": r.survey_id,
            "survey_title": r.survey.title if r.survey else "Deleted Survey",
            "status": r.status,
            "completed_at": r.completed_at,
            "manager_comment": r.manager_comment,
            "reviewed_by_username": r.reviewed_by_username,
            "reviewed_at": r.reviewed_at,
        }
        for r in responses
    ]

@router.get("/{survey_id}", response_model=SurveyDetailSchema)
def get_survey(
    survey_id: int, 
    db: Session = Depends(get_db),
    current_user: Session = Depends(get_current_user)
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    return survey

@router.post("/", response_model=SurveySchema)
def create_survey(
    survey_data: SurveySchema, 
    db: Session = Depends(get_db),
    current_user: Session = Depends(require_role(["Admin", "Manager"]))
):
    survey = Survey(
        title=survey_data.title,
        description=survey_data.description,
        category=survey_data.category,
        is_active=survey_data.is_active
    )
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return survey

@router.post("/{survey_id}/questions")
def add_questions(
    survey_id: int, 
    questions_data: List[dict], 
    db: Session = Depends(get_db),
    current_user: Session = Depends(require_role(["Admin", "Manager"]))
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    for q in questions_data:
        question = Question(
            survey_id=survey_id,
            question_text=q["question_text"],
            question_type=q["question_type"],
            media_type=q.get("media_type", "none"),
            media_url=q.get("media_url"),
            media_items=q.get("media_items"),
            required=q.get("required", True),
            scale=q.get("scale"),
            score_threshold=q.get("score_threshold"),
            score_rules=q.get("score_rules"),
            threshold_next_question=q.get("threshold_next_question"),
            backward_question=q.get("backward_question"),
            rating_max=q.get("rating_max", 5),
            low_label=q.get("low_label"),
            high_label=q.get("high_label"),
            rating_style=q.get("rating_style") or "number",
            rating_labels=q.get("rating_labels"),
            allowed_file_types=q.get("allowed_file_types"),
            max_file_size_mb=q.get("max_file_size_mb", 10),
            matrix_rows=q.get("matrix_rows"),
            matrix_columns=q.get("matrix_columns"),
            matrix_multi=q.get("matrix_multi", False),
            tier=q.get("tier", 1),
            parent_question_key=q.get("parent_question_key"),
            order=q.get("order", 0)
        )
        db.add(question)
        db.flush()
        
        if "options" in q and q["options"]:
            for opt_idx, opt in enumerate(q["options"]):
                if isinstance(opt, str):
                    option = QuestionOption(
                        question_id=question.id,
                        option_text=opt,
                        order=opt_idx
                    )
                else:
                    option = QuestionOption(
                        question_id=question.id,
                        option_text=opt.get("option_text", ""),
                        next_question=opt.get("next_question"),
                        score=opt.get("score", 0),
                        is_red_flag=opt.get("is_red_flag", False),
                        media_url=opt.get("media_url"),
                        media_type=opt.get("media_type"),
                        media_items=opt.get("media_items"),
                        emoji=opt.get("emoji"),
                        order=opt_idx
                    )
                db.add(option)
    
    db.commit()
    return {"message": "Questions added successfully"}

@router.put("/{survey_id}", response_model=SurveySchema)
def update_survey(
    survey_id: int, 
    survey_data: SurveySchema, 
    db: Session = Depends(get_db),
    current_user: Session = Depends(require_role(["Admin", "Manager"]))
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    survey.title = survey_data.title
    survey.category = survey_data.category
    survey.description = survey_data.description
    survey.is_active = survey_data.is_active
    
    db.commit()
    db.refresh(survey)
    return survey

@router.delete("/{survey_id}")
def delete_survey(
    survey_id: int, 
    db: Session = Depends(get_db),
    current_user: Session = Depends(require_role(["Admin", "Manager"]))
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    try:
        db.delete(survey)
        db.commit()
        return {"message": "Survey deleted successfully"}
    except Exception as e:
        db.rollback()
        print(f"Error deleting survey: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.delete("/{survey_id}/questions")
def delete_survey_questions(
    survey_id: int, 
    db: Session = Depends(get_db),
    current_user: Session = Depends(require_role(["Admin", "Manager"]))
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    questions = db.query(Question).filter(Question.survey_id == survey_id).all()
    for q in questions:
        db.delete(q)
        
    db.commit()
    return {"message": "Questions deleted successfully"}

@router.post("/{survey_id}/responses")
async def submit_response(survey_id: int, response_data: ResponseSchema, db: Session = Depends(get_db)):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    response = Response(
        survey_id=survey_id,
        respondent_email=response_data.respondent_email,
        user_id=response_data.user_id,
        latitude=response_data.latitude,
        longitude=response_data.longitude,
        is_completed=True
    )
    db.add(response)
    db.commit()
    db.refresh(response)
    
    has_red_flag = False
    for ans in response_data.answers:
        answer = Answer(
            response_id=response.id,
            question_id=ans.question_id,
            answer_text=ans.answer_text
        )
        db.add(answer)
        
        # Check if this answer text matches a red-flag option for this question
        red_flag_opt = db.query(QuestionOption).filter(
            QuestionOption.question_id == ans.question_id,
            QuestionOption.option_text == ans.answer_text,
            QuestionOption.is_red_flag == True
        ).first()
        if red_flag_opt:
            has_red_flag = True
    
    if has_red_flag:
        response.status = "Intervention Triggered"
    
    db.commit()
    
    notify_submission_received(db, response, survey)

    # Broadcast to Live Monitor
    await manager.broadcast({
        "type": "NEW_RESPONSE",
        "data": {
            "id": response.id,
            "survey_title": survey.title,
            "category": survey.category,
            "respondent": response.respondent_email,
            "user_id": response.user_id,
            "status": response.status,
            "timestamp": response.completed_at.isoformat() if response.completed_at else None
        }
    })
    
    return {"status": "submitted", "id": response.id}

@router.get("/{survey_id}/stats")
def get_survey_stats(survey_id: int, db: Session = Depends(get_db)):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    total_responses = db.query(Response).filter(Response.survey_id == survey_id).count()
    total_questions = db.query(Question).filter(
        Question.survey_id == survey_id,
        Question.question_type != '_section'
    ).count()
    
    return {
        "survey_id": survey_id,
        "survey_title": survey.title,
        "total_responses": total_responses,
        "total_questions": total_questions,
    }

@router.get("/{survey_id}/report")
def get_survey_report(
    survey_id: int,
    db: Session = Depends(get_db),
    current_user: Session = Depends(require_role(["Admin"]))
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    total_responses = db.query(Response).filter(Response.survey_id == survey_id).count()
    reviewed = db.query(Response).filter(
        Response.survey_id == survey_id,
        Response.status.in_(["Approved", "Rejected"])
    ).count()
    verified_pct = round((reviewed / total_responses) * 100) if total_responses else 0

    questions = (
        db.query(Question)
        .filter(Question.survey_id == survey_id, Question.question_type != "_section")
        .order_by(Question.order)
        .all()
    )

    question_reports = []
    for q in questions:
        answers = db.query(Answer).filter(Answer.question_id == q.id).all()
        answered_count = len(answers)

        # Checkbox answers are stored as a JSON-encoded array of selected
        # option texts; every other question type stores a plain string.
        text_counts = Counter()
        for a in answers:
            raw = a.answer_text
            parsed_list = None
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    parsed_list = parsed
            except (json.JSONDecodeError, TypeError):
                pass
            if parsed_list is not None:
                for v in parsed_list:
                    text_counts[str(v)] += 1
            else:
                text_counts[raw] += 1

        options = (
            db.query(QuestionOption)
            .filter(QuestionOption.question_id == q.id)
            .order_by(QuestionOption.order)
            .all()
        )
        denom = sum(text_counts.values()) or 1
        option_stats = [
            {
                "option_text": opt.option_text,
                "count": text_counts.get(opt.option_text, 0),
                "pct": round((text_counts.get(opt.option_text, 0) / denom) * 100),
            }
            for opt in options
        ] if options else []

        top = text_counts.most_common(1)
        most_common_answer = top[0][0] if top else None
        most_common_pct = round((top[0][1] / denom) * 100) if top else None

        question_reports.append({
            "id": q.id,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "required": q.required,
            "order": q.order,
            "answered_count": answered_count,
            "response_rate_pct": round((answered_count / total_responses) * 100) if total_responses else 0,
            "most_common_answer": most_common_answer,
            "most_common_pct": most_common_pct,
            "options": option_stats,
        })

    return {
        "id": survey.id,
        "title": survey.title,
        "description": survey.description,
        "category": survey.category,
        "is_active": survey.is_active,
        "created_at": survey.created_at,
        "total_questions": len(questions),
        "total_responses": total_responses,
        "verified_pct": verified_pct,
        "questions": question_reports,
    }
