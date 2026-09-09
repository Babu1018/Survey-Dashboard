from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from database import get_db
from models.user import User, LoginLog
from models.survey import Survey, Response
from schemas.user import UserCreate, UserOut, UserUpdate, LoginLogOut
from auth_utils import get_password_hash, require_role
from notifications import notify_survey_assigned, notify_submission_goal
# Authentik sync temporarily disabled - see main.py for the matching change.
# from authentik_sync import sync_create_user, sync_update_user, sync_delete_user

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/", response_model=List[UserOut])
async def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin", "Manager"]))
):
    return db.query(User).all()


# Registered ahead of /{user_id} so "login-logs" isn't swallowed by that
# path parameter route.
@router.get("/login-logs", response_model=List[LoginLogOut])
async def list_login_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin", "Manager"]))
):
    return db.query(LoginLog).order_by(LoginLog.logged_in_at.desc()).limit(500).all()


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin", "Manager"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/", response_model=UserOut)
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin", "Manager"]))
):
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        phone_number=user_data.phone_number,
        password_hash=get_password_hash(user_data.password),
        password_plain=user_data.password,
        role=user_data.role,
        is_first_login=True
    )
    db.add(new_user)
    db.flush()  # get new_user.id before commit

    # Assign survey (model question paper) if provided
    if user_data.assigned_survey_id:
        survey = db.query(Survey).filter(Survey.id == user_data.assigned_survey_id).first()
        if not survey:
            raise HTTPException(status_code=404, detail="Survey not found")
        new_user.assigned_surveys.append(survey)

    db.commit()
    db.refresh(new_user)

    # sync_create_user(new_user, user_data.password)

    return new_user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_data.password:
        user.password_hash = get_password_hash(user_data.password)
        user.password_plain = user_data.password
    if user_data.email is not None:
        user.email = user_data.email
    if user_data.phone_number is not None:
        user.phone_number = user_data.phone_number
    if user_data.role is not None:
        user.role = user_data.role
    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    db.commit()
    db.refresh(user)

    # sync_update_user(user, password=user_data.password)

    return user


@router.post("/{user_id}/assign-survey/{survey_id}", response_model=UserOut)
async def assign_survey_to_user(
    user_id: int,
    survey_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin", "Manager"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    # Avoid duplicate assignment
    if survey not in user.assigned_surveys:
        user.assigned_surveys.append(survey)
        db.commit()
        db.refresh(user)
        notify_survey_assigned(db, user, survey, current_user)

    return user


@router.delete("/{user_id}/assign-survey/{survey_id}", response_model=UserOut)
async def unassign_survey_from_user(
    user_id: int,
    survey_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin", "Manager"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if survey and survey in user.assigned_surveys:
        user.assigned_surveys.remove(survey)
        db.commit()
        db.refresh(user)

    return user


class GoalNotifyRequest(BaseModel):
    days: int
    count: int


@router.post("/{user_id}/notify-goal")
async def notify_goal(
    user_id: int,
    payload: GoalNotifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin", "Manager"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    notify_submission_goal(db, user, payload.days, payload.count, current_user)
    return {"status": "ok"}


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    delete_history: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete the main admin account")

    # Clear group managerships to prevent FK constraint violations
    for group in user.managed_groups:
        group.manager_id = None

    if delete_history:
        # Delete login logs
        db.query(LoginLog).filter(LoginLog.user_id == user_id).delete(synchronize_session=False)
        # Delete survey responses (cascades to answers)
        db.query(Response).filter(Response.user_id == user_id).delete(synchronize_session=False)

    # sync_delete_user(user)

    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}

