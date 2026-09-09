from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from database import get_db
from models.user import User, LoginLog
from schemas.user import (
    LoginRequest,
    Token,
    PasswordChangeRequest,
    UserOut,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    PhoneOtpRequest,
    PhoneOtpVerify,
    EmailLoginRequest,
    EmailLookupRequest,
)
from auth_utils import verify_password, get_password_hash, create_access_token, get_current_user, generate_otp
from email_utils import send_otp_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

OTP_EXPIRE_MINUTES = 10

def _record_login(db: Session, request: Request, user: User):
    db.add(LoginLog(
        user_id=user.id,
        username=user.username,
        role=user.role,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    ))
    db.commit()

@router.post("/login", response_model=Token)
async def login(login_data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_data.username).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is disabled")

    access_token = create_access_token(data={"sub": user.username})
    _record_login(db, request, user)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/login/email", response_model=Token)
async def login_email(login_data: EmailLoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is disabled")

    access_token = create_access_token(data={"sub": user.username})
    _record_login(db, request, user)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/lookup-username")
async def lookup_username(data: EmailLookupRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    return {"username": user.username if user else None}

@router.post("/change-password")
async def change_password(
    data: PasswordChangeRequest, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.password_hash = get_password_hash(data.new_password)
    current_user.is_first_login = False
    db.commit()
    return {"message": "Password updated successfully"}

@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if user:
        otp_code = generate_otp()
        user.otp_code_hash = get_password_hash(otp_code)
        user.otp_expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)
        db.commit()
        try:
            send_otp_email(user.email, otp_code)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to send OTP email: {e}")

    # Generic response regardless of whether the account/email exists
    return {"message": "If that email is registered, an OTP has been sent."}

@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if (
        not user
        or not user.otp_code_hash
        or not user.otp_expires_at
        or user.otp_expires_at < datetime.utcnow()
        or not verify_password(data.otp, user.otp_code_hash)
    ):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    user.password_hash = get_password_hash(data.new_password)
    user.otp_code_hash = None
    user.otp_expires_at = None
    user.is_first_login = False
    db.commit()
    return {"message": "Password reset successfully"}

@router.post("/login/phone/request-otp")
async def request_phone_login_otp(data: PhoneOtpRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone_number == data.phone_number).first()
    if user and user.email and user.is_active:
        otp_code = generate_otp()
        user.otp_code_hash = get_password_hash(otp_code)
        user.otp_expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)
        db.commit()
        try:
            send_otp_email(user.email, otp_code)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to send OTP email: {e}")

    return {"message": "If that phone number is registered, an OTP has been sent."}

@router.post("/login/phone/verify-otp", response_model=Token)
async def verify_phone_login_otp(data: PhoneOtpVerify, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone_number == data.phone_number).first()
    if (
        not user
        or not user.is_active
        or not user.otp_code_hash
        or not user.otp_expires_at
        or user.otp_expires_at < datetime.utcnow()
        or not verify_password(data.otp, user.otp_code_hash)
    ):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    user.otp_code_hash = None
    user.otp_expires_at = None
    db.commit()

    access_token = create_access_token(data={"sub": user.username})
    _record_login(db, request, user)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }
