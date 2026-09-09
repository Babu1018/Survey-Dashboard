from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class QuestionOptionSchema(BaseModel):
    id: Optional[int] = None
    option_text: str
    order: int
    next_question: Optional[int] = None
    score: int = 0
    is_red_flag: bool = False
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    media_items: Optional[str] = None
    emoji: Optional[str] = None

    class Config:
        from_attributes = True


class QuestionSchema(BaseModel):
    id: Optional[int] = None
    question_text: str
    question_type: str
    media_type: str = "none"
    media_url: Optional[str] = None
    media_items: Optional[str] = None
    required: bool = True
    order: int
    rating_max: Optional[int] = 5
    low_label: Optional[str] = None
    high_label: Optional[str] = None
    rating_style: Optional[str] = "number"
    rating_labels: Optional[str] = None
    allowed_file_types: Optional[str] = None
    max_file_size_mb: Optional[int] = 10
    matrix_rows: Optional[str] = None
    matrix_columns: Optional[str] = None
    matrix_multi: Optional[bool] = False
    scale: Optional[str] = None
    score_threshold: Optional[int] = None
    score_rules: Optional[str] = None
    threshold_next_question: Optional[int] = None
    backward_question: Optional[int] = None
    tier: Optional[int] = 1
    parent_question_key: Optional[str] = None
    options: List[QuestionOptionSchema] = []

    class Config:
        from_attributes = True


class SurveySchema(BaseModel):
    id: Optional[int] = None
    title: str
    description: Optional[str] = None
    category: str = "Developer"
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SurveyDetailSchema(SurveySchema):
    questions: List[QuestionSchema] = []


class AnswerSchema(BaseModel):
    question_id: int
    answer_text: str

    class Config:
        from_attributes = True


class ResponseSchema(BaseModel):
    id: Optional[int] = None
    survey_id: int
    respondent_email: Optional[str] = None
    user_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    answers: List[AnswerSchema]
    is_completed: bool = False
    status: str = "Pending"
    completed_at: Optional[datetime] = None
    manager_comment: Optional[str] = None
    reviewed_by_username: Optional[str] = None
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MyResponseOut(BaseModel):
    id: int
    survey_id: int
    survey_title: str
    status: str
    completed_at: Optional[datetime] = None
    manager_comment: Optional[str] = None
    reviewed_by_username: Optional[str] = None
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserMinimal(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True


class UserGroupSchema(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    manager_id: Optional[int] = None
    manager: Optional[UserMinimal] = None
    users: List[UserMinimal] = []
    surveys: List[SurveySchema] = []

    class Config:
        from_attributes = True


class GroupManagerUpdate(BaseModel):
    manager_id: Optional[int] = None

