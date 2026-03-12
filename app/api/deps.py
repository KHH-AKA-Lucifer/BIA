# import required libraries
from jose import JWTError
from app.models.user import User
from app.db.sessions import get_db
from sqlalchemy.orm import Session
from collections.abc import Callable
from app.core.security import decode_token
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status
from app.services.auth_service import get_user_by_id

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_current_user(
        db: Session = Depends(get_db),
        token: str = Depends(oauth2_scheme),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id : int | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except (JWTError, ValueError):
        raise credentials_exception
    
    user = get_user_by_id(db, int(user_id))
    if user is None:
        raise credentials_exception
    return user

def get_current_active_user(
        current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user

def require_roles(*allowed_roles:str) -> Callable:
    def role_checker(
            current_user: User = Depends(get_current_active_user),
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return current_user
    
    return role_checker