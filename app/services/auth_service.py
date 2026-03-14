# import required libraries 
from typing import List
from app.models.user import User
from sqlalchemy.orm import Session 
from app.schemas.auth import UserRegister
from app.core.security import hash_password, verify_password

def get_all_users(db: Session) -> List[User]:
    return db.query(User).order_by(User.id.asc()).all()

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

def deactivate_user_by_id(db: Session, user_id: int) -> User | None:
    user = db.get(User, user_id)
    if user is None:
        return None
    
    user.is_active = False
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def update_user_role(db: Session, user_id: int, role: str) -> User | None:
    user = db.get(User, user_id)
    if user is None:
        return None 
    
    user.role = role 
    db.add(user)
    db.commit()
    db.refresh(user)
    return user