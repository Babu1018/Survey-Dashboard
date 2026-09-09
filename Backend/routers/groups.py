from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.survey import UserGroup, Survey, survey_assignments
from models.user import User
from schemas.survey import UserGroupSchema, SurveySchema, GroupManagerUpdate
from auth_utils import get_current_user, require_role

router = APIRouter(prefix="/api/groups", tags=["groups"])

@router.get("/", response_model=List[UserGroupSchema])
def get_groups(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(UserGroup).all()

@router.post("/", response_model=UserGroupSchema)
def create_group(
    group_data: UserGroupSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin"]))
):
    group = UserGroup(name=group_data.name, description=group_data.description)
    db.add(group)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Group name already exists")
    db.refresh(group)
    return group

@router.delete("/{group_id}")
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin"]))
):
    group = db.query(UserGroup).filter(UserGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    db.delete(group)
    db.commit()
    return {"message": "Group deleted successfully"}

@router.patch("/{group_id}", response_model=UserGroupSchema)
def update_group(
    group_id: int,
    group_data: UserGroupSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin"]))
):
    group = db.query(UserGroup).filter(UserGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group_data.name:
        group.name = group_data.name
    if group_data.description:
        group.description = group_data.description

    try:
        db.commit()
        db.refresh(group)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Group name already exists")
    return group

@router.patch("/{group_id}/manager", response_model=UserGroupSchema)
def set_group_manager(
    group_id: int,
    data: GroupManagerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin"]))
):
    group = db.query(UserGroup).filter(UserGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if data.manager_id is not None:
        manager = db.query(User).filter(User.id == data.manager_id, User.role == "Manager").first()
        if not manager:
            raise HTTPException(status_code=404, detail="Manager not found")

    group.manager_id = data.manager_id
    db.commit()
    db.refresh(group)
    return group

@router.post("/{group_id}/assign/{survey_id}", response_model=UserGroupSchema)
def assign_survey(
    group_id: int,
    survey_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin"]))
):
    group = db.query(UserGroup).filter(UserGroup.id == group_id).first()
    survey = db.query(Survey).filter(Survey.id == survey_id).first()

    if not group or not survey:
        raise HTTPException(status_code=404, detail="Group or Survey not found")

    if survey not in group.surveys:
        group.surveys.append(survey)
        db.commit()
        db.refresh(group)

    return group

@router.delete("/{group_id}/assign/{survey_id}", response_model=UserGroupSchema)
def unassign_survey(
    group_id: int,
    survey_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin"]))
):
    group = db.query(UserGroup).filter(UserGroup.id == group_id).first()
    survey = db.query(Survey).filter(Survey.id == survey_id).first()

    if not group or not survey:
        raise HTTPException(status_code=404, detail="Group or Survey not found")

    if survey in group.surveys:
        group.surveys.remove(survey)
        db.commit()
        db.refresh(group)

    return group

@router.get("/{group_id}/surveys", response_model=List[SurveySchema])
def get_group_surveys(group_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    group = db.query(UserGroup).filter(UserGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group.surveys

@router.post("/{group_id}/users/{user_id}", response_model=UserGroupSchema)
def add_user_to_group(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin"]))
):
    group = db.query(UserGroup).filter(UserGroup.id == group_id).first()
    user = db.query(User).filter(User.id == user_id).first()

    if not group or not user:
        raise HTTPException(status_code=404, detail="Group or User not found")

    if user not in group.users:
        group.users.append(user)
        db.commit()
        db.refresh(group)
    return group

@router.delete("/{group_id}/users/{user_id}", response_model=UserGroupSchema)
def remove_user_from_group(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Admin"]))
):
    group = db.query(UserGroup).filter(UserGroup.id == group_id).first()
    user = db.query(User).filter(User.id == user_id).first()

    if not group or not user:
        raise HTTPException(status_code=404, detail="Group or User not found")

    if user in group.users:
        group.users.remove(user)
        db.commit()
        db.refresh(group)
    return group
