from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime


class SurveyMinimal(BaseModel):
    id: int
    title: str
    category: str

    model_config = ConfigDict(from_attributes=True)


class UserBase(BaseModel):
    username: str
    email: Optional[str] = None
    phone_number: Optional[str] = None
    role: str = "User"


class UserCreate(UserBase):
    password: str
    assigned_survey_id: Optional[int] = None  # survey (model question paper) to assign


class UserUpdate(BaseModel):
    password: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class GroupMinimal(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UserOut(UserBase):
    id: int
    is_first_login: bool
    is_active: bool
    created_at: datetime
    password_plain: Optional[str] = None
    direct_surveys: List[SurveyMinimal] = Field(default=[], validation_alias="assigned_surveys")
    assigned_surveys: List[SurveyMinimal] = Field(default=[], validation_alias="all_assigned_surveys")
    groups: List[GroupMinimal] = []

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)



class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


class LoginRequest(BaseModel):
    username: str
    password: str


class PasswordChangeRequest(BaseModel):
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str


class PhoneOtpRequest(BaseModel):
    phone_number: str


class PhoneOtpVerify(BaseModel):
    phone_number: str
    otp: str


class EmailLoginRequest(BaseModel):
    email: str
    password: str


class EmailLookupRequest(BaseModel):
    email: str


class LoginLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    username: str
    role: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    logged_in_at: datetime

    model_config = ConfigDict(from_attributes=True)

