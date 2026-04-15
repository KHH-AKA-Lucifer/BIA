from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pydantic import EmailStr, TypeAdapter, ValidationError

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.security import hash_password
from app.db.sessions import SessionLocal
from app.models.user import User


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create or update a demo user.")
    parser.add_argument("--email", required=True, help="User email")
    parser.add_argument("--password", required=True, help="Plain-text password")
    parser.add_argument(
        "--role",
        choices=("user", "admin"),
        default="user",
        help="Role to assign",
    )
    parser.add_argument(
        "--force-password",
        action="store_true",
        help="Overwrite the password if the user already exists",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        email = TypeAdapter(EmailStr).validate_python(args.email)
    except ValidationError as exc:
        print(exc)
        return 1

    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()

        if user is None:
            user = User(
                email=str(email),
                password=hash_password(args.password),
                is_active=True,
                is_superuser=args.role == "admin",
                role=args.role,
            )
            db.add(user)
            action = "created"
        else:
            user.role = args.role
            user.is_active = True
            user.is_superuser = args.role == "admin"
            if args.force_password:
                user.password = hash_password(args.password)
            db.add(user)
            action = "updated"

        db.commit()
        db.refresh(user)

    print(f"{action}:{user.email}:{user.role}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
