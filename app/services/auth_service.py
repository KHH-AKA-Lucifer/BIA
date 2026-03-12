# import required libraries 
from app.models.user import User
from sqlalchemy.orm import Session 
from app.schemas.auth import UserRegister
from app.core.security import hash_password, verify_password


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()

def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()

def create_user(db: Session, user_in: UserRegister) -> User:
    user = User(
        email = user_in.email,
        password = hash_password(user_in.password),
        is_active = True,
        is_superuser = False
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password):
        return None 
    
    return user