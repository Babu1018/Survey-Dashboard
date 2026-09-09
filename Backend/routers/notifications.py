from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

from database import get_db
from models.notification import Notification
from models.user import User
from auth_utils import get_current_user
from notifications import sweep_overdue_assignments

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    message: Optional[str] = None
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


def _owned(db: Session, notification_id: int, current_user: User) -> Notification:
    """Fetch a notification, refusing anything addressed to someone else."""
    n = db.query(Notification).filter(Notification.id == notification_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    if n.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="That notification is not yours.")
    return n


@router.get("/", response_model=List[NotificationOut])
def list_notifications(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # The lapsed-survey check has no scheduler behind it; it runs here, when an
    # Admin looks. The dedupe key keeps repeat sweeps from piling up duplicates.
    if current_user.role == "Admin":
        sweep_overdue_assignments(db)

    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.dismissed_at.is_(None))
        .order_by(Notification.created_at.desc())
        .limit(min(limit, 200))
        .all()
    )


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
            Notification.dismissed_at.is_(None),
        )
        .count()
    )
    return {"count": count}


@router.patch("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = _owned(db, notification_id, current_user)
    n.is_read = True
    db.commit()
    return {"status": "ok", "id": n.id}


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .update({Notification.is_read: True})
    )
    db.commit()
    return {"status": "ok", "updated": updated}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = _owned(db, notification_id, current_user)
    if n.dedupe_key:
        # Keep the row so the sweep does not resurrect it; hide it instead.
        n.dismissed_at = datetime.utcnow()
    else:
        db.delete(n)
    db.commit()
    return {"status": "deleted", "id": notification_id}


@router.delete("/")
def clear_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.dismissed_at.is_(None))
        .all()
    )
    now = datetime.utcnow()
    for row in rows:
        if row.dedupe_key:
            row.dismissed_at = now
        else:
            db.delete(row)
    db.commit()
    return {"status": "cleared", "deleted": len(rows)}
