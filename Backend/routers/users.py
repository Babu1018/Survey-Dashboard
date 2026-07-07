from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models.user import User
from models.survey import Survey
from schemas.user import UserCreate, UserOut, UserUpdate
from auth_utils import get_password_hash, require_role

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/", response_model=List[UserOut])
async def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin", "Manager"]))
):
    return db.query(User).all()


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
        password_hash=get_password_hash(user_data.password),
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
    if user_data.role is not None:
        user.role = user_data.role
    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    db.commit()
    db.refresh(user)
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


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete the main admin account")

    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}

