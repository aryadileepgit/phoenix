import os
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

# Password hashing configuration
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(
    os.getenv("JWT_EXPIRE_MINUTES", "480")
)


def _jwt_secret():
    secret = os.getenv("JWT_SECRET", "")

    if secret:
        return secret

    print(
        "WARNING: JWT_SECRET is not set; using an insecure "
        "development fallback. Set JWT_SECRET in backend/.env."
    )

    return "phoenix-dev-secret-change-me"


def hash_password(password: str) -> str:
    """
    Hash a plain text password.
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain text password against its hash.
    """
    return pwd_context.verify(
        plain_password,
        hashed_password
    )


def create_access_token(email: str) -> str:
    """
    Issue a signed bearer token. The frontend stores this and
    sends it back on every request; routers verify it through
    get_current_user instead of trusting a localStorage flag.
    """
    expires = (
        datetime.now(timezone.utc)
        + timedelta(minutes=JWT_EXPIRE_MINUTES)
    )

    return jwt.encode(
        {"sub": email, "exp": expires},
        _jwt_secret(),
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> str | None:
    """
    Returns the token subject (email), or None when the token
    is invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            _jwt_secret(),
            algorithms=[JWT_ALGORITHM],
        )
    except JWTError:
        return None

    email = payload.get("sub")

    return email if isinstance(email, str) else None