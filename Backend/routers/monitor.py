from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
from models.survey import Response, Survey, Answer, Question, QuestionOption
from auth_utils import require_role
from ws_manager import manager

router = APIRouter(prefix="/api/monitor", tags=["monitor"])

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@router.get("/recent")
def get_recent_responses(limit: int = 50, db: Session = Depends(get_db)):
    responses = db.query(Response).join(Survey).order_by(Response.completed_at.desc()).limit(limit).all()
    
    return [
        {
            "id": r.id,
            "survey_title": r.survey.title,
            "category": r.survey.category,
            "respondent": r.respondent_email,
            "status": r.status,
            "timestamp": r.completed_at.isoformat() if r.completed_at else None,
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
def get_response_detail(response_id: int, db: Session = Depends(get_db)):
    response = db.query(Response).filter(Response.id == response_id).first()
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    
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
            "question_text": q.question_text,
            "answer_text": a.answer_text,
            "question_type": q.question_type,
            "scale": q.scale,
            "score": score,
            "is_red_flag": is_red_flag
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
        "answers": detailed_answers
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
    deleted = 0
    for rid in request.ids:
        response = db.query(Response).filter(Response.id == rid).first()
        if response:
            db.delete(response)
            deleted += 1
    db.commit()
    return {"message": f"Deleted {deleted} response(s)", "deleted": deleted}

class StatusUpdateRequest(BaseModel):
    status: str

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
    
    response.status = request.status
    db.commit()
    db.refresh(response)
    return response
