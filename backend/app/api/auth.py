from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
)
from app.services.auth_service import (
    authenticate_user,
    get_current_user,
    request_password_reset,
    reset_password,
)
from app.services.email_service import send_reset_email
from app.utils.security import create_access_token

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(
        db,
        request.email,
        request.password
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    return LoginResponse(
        success=True,
        message="Login successful",
        full_name=user.full_name,
        email=user.email,
        access_token=create_access_token(user.email),
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Generate a password reset token for the given email.
    Always returns success to prevent email enumeration.
    If EMAIL_ENABLED=true and SMTP configured, sends a real email.
    Otherwise logs token to console (dev mode).
    """
    token = request_password_reset(db, request.email)

    if token:
        send_reset_email(request.email, token)

    return ForgotPasswordResponse(
        success=True,
        message="If the email exists, a reset link has been sent."
    )


@router.post("/reset-password", response_model=ResetPasswordResponse)
def reset_password_endpoint(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    success = reset_password(db, request.token, request.new_password)

    if not success:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token."
        )

    return ResetPasswordResponse(
        success=True,
        message="Password has been reset. You can now log in."
    )


@router.get("/me")
def read_current_user(user=Depends(get_current_user)):
    return {
        "email": user.email,
        "full_name": user.full_name,
    }