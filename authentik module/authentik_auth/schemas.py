from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class UserInfo(BaseModel):
    subject: str
    email: str
    username: str
    name: str
    roles: list[str]


class LoginResponse(BaseModel):
    authenticated: bool = True
    access_token: str
    refresh_token: str | None = None
    token_type: str = "Bearer"
    expires_in: int | None = None
    user: UserInfo
