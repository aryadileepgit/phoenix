import secrets
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User
from app.utils.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)

RESET_TOKEN_BYTES = 32
RESET_TOKEN_EXPIRE_MINUTES = 60


def authenticate_user(db: Session, email: str, password: str):
    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user


def create_reset_token() -> str:
    """Generate a cryptographically secure reset token."""
    return secrets.token_urlsafe(RESET_TOKEN_BYTES)


def request_password_reset(db: Session, email: str) -> str | None:
    """
    Generate a reset token for the user, store its hash and expiry.
    Returns the plain token (for dev logging/email) or None if user not found.
    """
    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user:
        return None

    plain_token = create_reset_token()
    # Store only the hash (bcrypt) for security
    user.reset_token = hash_password(plain_token)
    user.reset_token_expires = (
        datetime.now(timezone.utc)
        + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    )
    db.commit()

    return plain_token


def reset_password(db: Session, token: str, new_password: str) -> bool:
    """
    Verify the reset token and update the password.
    Returns True on success, False if token invalid/expired/user not found.
    """
    user = (
        db.query(User)
        .filter(User.reset_token.isnot(None))
        .first()
    )

    if not user:
        return False

    if not verify_password(token, user.reset_token):
        return False

    if (
        user.reset_token_expires is None
        or user.reset_token_expires < datetime.now(timezone.utc)
    ):
        return False

    user.password_hash = hash_password(new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()

    return True


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """
    Request guard: every protected router resolves the bearer
    token back to a live user row. Forged, expired, or
    deleted-user tokens get 401 — a flipped localStorage flag
    is no longer enough to reach the API.
    """

    email = decode_access_token(token)

    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user