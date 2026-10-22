from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database.database import SessionLocal
from app.models.user import User
from app.utils.security import hash_password


import os

ADMIN_NAME = os.getenv(
    "PHOENIX_ADMIN_NAME", "Administrator"
)
ADMIN_EMAIL = os.getenv(
    "PHOENIX_ADMIN_EMAIL", "ayoradileep@gmail.com"
)
ADMIN_PASSWORD = os.getenv(
    "PHOENIX_ADMIN_PASSWORD", "admin123"
)


def seed_admin():
    db: Session = SessionLocal()

    try:
        print("Checking administrator account...")

        existing_admin = (
            db.query(User)
            .filter(User.email == ADMIN_EMAIL)
            .first()
        )

        if existing_admin:
            print("Administrator already exists.")
            print(f"Email: {ADMIN_EMAIL}")
            return

        admin = User(
            full_name=ADMIN_NAME,
            email=ADMIN_EMAIL,
            password_hash=hash_password(ADMIN_PASSWORD),
            is_active=True,
        )

        db.add(admin)
        db.commit()
        db.refresh(admin)

        print("\nAdministrator created successfully!")
        print("-------------------------------------")
        print(f"Name     : {ADMIN_NAME}")
        print(f"Email    : {ADMIN_EMAIL}")
        print(f"Password : {ADMIN_PASSWORD}")
        print("-------------------------------------")

    except SQLAlchemyError as e:
        db.rollback()
        print("Database Error:")
        print(e)

    except Exception as e:
        db.rollback()
        print("Unexpected Error:")
        print(e)

    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()