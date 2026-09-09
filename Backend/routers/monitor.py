from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from database import get_db
from models.survey import Response, Survey, Answer, Question, QuestionOption, UserGroup
from models.user import User
from auth_utils import require_role
from ws_manager import manager
from notifications import notify_review_decision

router = APIRouter(prefix="/api/monitor", tags=["monitor"])


def _manager_scope_user_ids(db: Session, manager_user: User) -> set:
    """User IDs belonging to any group this Manager owns — the only
    respondents whose reports that Manager may see or act on."""
    groups = db.query(UserGroup).filter(UserGroup.manager_id == manager_user.id).all()
    ids = set()
    for g in groups:
        for u in g.users:
            ids.add(u.id)
    return ids


def _assert_in_scope(db: Session, current_user: User, response: Response):
    if current_user.role == "Admin":
        return
    scope = _manager_scope_user_ids(db, current_user)
    if response.user_id not in scope:
        raise HTTPException(status_code=403, detail="This report is outside your assigned users.")


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@router.get("/my-scope")
def get_my_scope(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin", "Manager"]))
):
    """Tells the frontend whether this account sees every report (Admin) or
    only reports from specific users (Manager), and which ones."""
    if current_user.role == "Admin":
        return {"all": True, "user_ids": []}
    return {"all": False, "user_ids": sorted(_manager_scope_user_ids(db, current_user))}


@router.get("/recent")
def get_recent_responses(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin", "Manager"]))
):
    query = db.query(Response).join(Survey)
    if current_user.role == "Manager":
        scope = _manager_scope_user_ids(db, current_user)
        if not scope:
            return []
        query = query.filter(Response.user_id.in_(scope))

    responses = query.order_by(Response.completed_at.desc()).limit(limit).all()

    return [
        {
            "id": r.id,
            "survey_title": r.survey.title,
            "category": r.survey.category,
            "respondent": r.respondent_email,
            # user_id lets the dashboard link a report back to the account that
            # filed it; answer_count feeds the per-user submission history.
            "user_id": r.user_id,
            "answer_count": len(r.answers),
            "status": r.status,
            "timestamp": r.completed_at.isoformat() if r.completed_at else None,
            "reviewed_by_username": r.reviewed_by_username,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            "has_red_flag": any(
                db.query(QuestionOption)
                .filter(QuestionOption.question_id == a.question_id, QuestionOption.option_text == a.answer_text, QuestionOption.is_red_flag == True)
                .first() is not None
                for a in r.answers
            )
        }
        for r in responses
    ]

@router.get("/responses/{response_id}")
def get_response_detail(
    response_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin", "Manager"]))
):
    response = db.query(Response).filter(Response.id == response_id).first()
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    _assert_in_scope(db, current_user, response)

    # Get answers with question text
    db_answers = db.query(Answer, Question).join(Question).filter(Answer.response_id == response_id).all()

    detailed_answers = []
    total_score = 0
    scores_by_scale = {}
    has_red_flag = False

    for a, q in db_answers:
        # Find score and red flag for this answer
        option = db.query(QuestionOption).filter(
            QuestionOption.question_id == a.question_id,
            QuestionOption.option_text == a.answer_text
        ).first()

        score = option.score if option else 0
        is_red_flag = option.is_red_flag if option else False

        if is_red_flag:
            has_red_flag = True

        total_score += score

        if q.scale:
            scores_by_scale[q.scale] = scores_by_scale.get(q.scale, 0) + score

        detailed_answers.append({
            "id": a.id,
            "question_id": q.id,
            "question_text": q.question_text,
            "answer_text": a.answer_text,
            "question_type": q.question_type,
            "required": q.required,
            "order": q.order,
            # Configuration the reviewer's answer renderer needs to show a
            # word-scale rating as its caption rather than a bare number.
            "rating_style": q.rating_style,
            "rating_labels": q.rating_labels,
            "rating_max": q.rating_max,
            "scale": q.scale,
            "score": score,
            "is_red_flag": is_red_flag,
            "status": a.status or "Pending",
            "review_note": a.review_note,
            "reviewed_by_username": a.reviewed_by_username,
            "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None,
        })

    # Determine severity (simplified logic)
    severity = "Normal"
    if has_red_flag:
        severity = "High Risk (Red Flag)"
    elif total_score > 15:
        severity = "High"
    elif total_score > 8:
        severity = "Moderate"
    elif total_score > 0:
        severity = "Low"

    return {
        "id": response.id,
        "survey_title": response.survey.title,
        "respondent": response.respondent_email,
        "status": response.status,
        "timestamp": response.completed_at.isoformat() if response.completed_at else None,
        "total_score": total_score,
        "severity": severity,
        "has_red_flag": has_red_flag,
        "scores_by_scale": scores_by_scale,
        "answers": detailed_answers,
        "manager_comment": response.manager_comment,
        "reviewed_by_username": response.reviewed_by_username,
        "reviewed_at": response.reviewed_at.isoformat() if response.reviewed_at else None,
    }

@router.delete("/responses/{response_id}")
def delete_response(
    response_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_role(["Admin", "Manager"]))
):
    response = db.query(Response).filter(Response.id == response_id).first()
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    _assert_in_scope(db, current_user, response)

    db.delete(response)
    db.commit()
    return {"message": "Response deleted successfully"}


class BulkDeleteRequest(BaseModel):
    ids: List[int]

@router.post("/responses/bulk-delete")
def bulk_delete_responses(
    request: BulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_role(["Admin", "Manager"]))
):
    scope = None if current_user.role == "Admin" else _manager_scope_user_ids(db, current_user)

    deleted = 0
    for rid in request.ids:
        response = db.query(Response).filter(Response.id == rid).first()
        if response and (scope is None or response.user_id in scope):
            db.delete(response)
            deleted += 1
    db.commit()
    return {"message": f"Deleted {deleted} response(s)", "deleted": deleted}

ALLOWED_STATUSES = {"Pending", "Reviewed", "Intervention Triggered", "Resolved", "Approved", "Rejected"}


class StatusUpdateRequest(BaseModel):
    status: str
    comment: Optional[str] = None

@router.patch("/responses/{response_id}/status")
def update_response_status(
    response_id: int,
    request: StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_role(["Admin", "Manager"]))
):
    response = db.query(Response).filter(Response.id == response_id).first()
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    _assert_in_scope(db, current_user, response)

    if request.status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(sorted(ALLOWED_STATUSES))}")

    comment = (request.comment or "").strip()
    if request.status == "Rejected" and not comment:
        raise HTTPException(status_code=400, detail="A comment is required when rejecting a submission.")

    response.status = request.status
    if request.comment is not None:
        response.manager_comment = comment or None
    response.reviewed_by_username = current_user.username
    response.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(response)

    notify_review_decision(db, response, response.survey, current_user, request.status, comment)

    return response


class AnswerReviewRequest(BaseModel):
    status: str
    note: Optional[str] = None


@router.patch("/answers/{answer_id}/status")
def update_answer_status(
    answer_id: int,
    request: AnswerReviewRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_role(["Admin", "Manager"]))
):
    """Approve or decline a single answer within a submission. Scope is
    enforced through the answer's parent response, so a Manager can only
    review answers from users in their own groups."""
    answer = db.query(Answer).filter(Answer.id == answer_id).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")

    response = db.query(Response).filter(Response.id == answer.response_id).first()
    if not response:
        raise HTTPException(status_code=404, detail="Parent submission not found")
    _assert_in_scope(db, current_user, response)

    if request.status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(sorted(ALLOWED_STATUSES))}")

    note = (request.note or "").strip()
    if request.status == "Rejected" and not note:
        raise HTTPException(status_code=400, detail="A note is required when declining an answer.")

    answer.status = request.status
    answer.review_note = note or None
    answer.reviewed_by_username = current_user.username
    answer.reviewed_at = datetime.utcnow()

    # Roll the per-answer decisions up to the submission: any decline makes the
    # whole submission Rejected; it is Approved only once every answer is.
    siblings = db.query(Answer).filter(Answer.response_id == response.id).all()
    if any((x.status or "Pending") == "Rejected" for x in siblings):
        response.status = "Rejected"
    elif all((x.status or "Pending") == "Approved" for x in siblings):
        response.status = "Approved"
    else:
        response.status = "Pending"
    response.reviewed_by_username = current_user.username
    response.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(answer)

    return {
        "id": answer.id,
        "status": answer.status,
        "review_note": answer.review_note,
        "reviewed_by_username": answer.reviewed_by_username,
        "reviewed_at": answer.reviewed_at.isoformat() if answer.reviewed_at else None,
        "response_status": response.status,
    }


@router.get("/managers-overview")
def get_managers_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin"]))
):
    """Admin-facing rollup of every Manager's approval progress, so the
    Admin can see the overall review process across the whole team."""
    managers = db.query(User).filter(User.role == "Manager").order_by(User.username).all()

    overview = []
    for m in managers:
        scope = _manager_scope_user_ids(db, m)
        group_count = db.query(UserGroup).filter(UserGroup.manager_id == m.id).count()

        if scope:
            responses = db.query(Response).filter(Response.user_id.in_(scope)).all()
        else:
            responses = []

        pending = sum(1 for r in responses if r.status == "Pending")
        approved = sum(1 for r in responses if r.status == "Approved")
        rejected = sum(1 for r in responses if r.status == "Rejected")

        overview.append({
            "manager_id": m.id,
            "manager_username": m.username,
            "group_count": group_count,
            "user_count": len(scope),
            "total_responses": len(responses),
            "pending": pending,
            "approved": approved,
            "rejected": rejected,
        })

    return overview
