from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from database import get_db
from models.survey import Survey, Question, Response, Answer, QuestionOption
from schemas.survey import SurveySchema, SurveyDetailSchema, ResponseSchema
from auth_utils import get_current_user, require_role
from ws_manager import manager
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
    
    return {"url": f"http://localhost:8000/uploads/{unique_filename}", "filename": unique_filename}

@router.delete("/maintenance/cleanup")
def cleanup_orphaned_media(
    db: Session = Depends(get_db),
    current_user: Session = Depends(require_role(["Admin"]))
):
    if not os.path.exists(UPLOAD_DIR):
        return {"message": "No uploads directory found", "deleted": 0}
        
    # Get all active media URLs from database
    active_questions = db.query(Question).filter(Question.media_url.isnot(None)).all()
    active_filenames = set()
    for q in active_questions:
        if q.media_url:
            filename = q.media_url.split('/')[-1]
            active_filenames.add(filename)
            
    # Scan uploads directory
    all_files = set(os.listdir(UPLOAD_DIR))
    orphaned_files = all_files - active_filenames
    
    deleted_count = 0
    for file in orphaned_files:
        try:
            file_path = os.path.join(UPLOAD_DIR, file)
            if os.path.isfile(file_path):
                os.remove(file_path)
                deleted_count += 1
        except Exception as e:
            print(f"Error deleting file {file}: {e}")
            
    return {"message": "Cleanup complete", "deleted": deleted_count}

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
            ("threshold_next_question", "INTEGER"),
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
            required=q.get("required", True),
            scale=q.get("scale"),
            score_threshold=q.get("score_threshold"),
            threshold_next_question=q.get("threshold_next_question"),
            rating_max=q.get("rating_max", 5),
            low_label=q.get("low_label"),
            high_label=q.get("high_label"),
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
    
    # Broadcast to Live Monitor
    await manager.broadcast({
        "type": "NEW_RESPONSE",
        "data": {
            "id": response.id,
            "survey_title": survey.title,
            "category": survey.category,
            "respondent": response.respondent_email,
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
    total_questions = db.query(Question).filter(Question.survey_id == survey_id).count()
    
    return {
        "survey_id": survey_id,
        "survey_title": survey.title,
        "total_responses": total_responses,
        "total_questions": total_questions,
    }
