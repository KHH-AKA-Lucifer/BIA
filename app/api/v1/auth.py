# import required libraries 
import logging
from jose import jwt, JWTError
from app.models.user import User
from sqlalchemy.orm import Session
from app.db.sessions import get_db
from app.core.config import settings
from fastapi.security import OAuth2PasswordRequestForm
from app.core.security import verify_password, hash_password
from fastapi import APIRouter, Depends, HTTPException, status 
from app.api.deps import get_current_active_user, require_roles
from app.core.security import create_access_token, create_refresh_token,decode_token
from app.schemas.auth import TokenResponse, UserRegister, UserResponse, ChangePasswordRequest  #UserLogin
from app.services.auth_service import authenticate_user, create_user, get_user_by_email

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger("app")

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserRegister, db: Session = Depends(get_db)) -> UserResponse:
    existing_user = get_user_by_email(db, user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    user = create_user(db, user_in)
    return user

@router.post("/login", response_model=TokenResponse)

# JSON request not a good practice 
# def login(user_in: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
#     user = authenticate_user(db, user_in.email, user_in.password)
#     if not user:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Invalid email or password",
#         )
#     access_token = create_access_token(subject=user.id)

#     return TokenResponse(
#         access_token=access_token,
#         token_type="bearer",
#     )

def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db:Session = Depends(get_db),
    ) -> TokenResponse:
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )

@router.post("/change-password")
def reset_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="Current password incorrect",
        )

    current_user.hashed_password = hash_password(payload.new_password)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return {"message": "Password updated successfully"}  

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(refreshtoken: str):

    try:
        payload = decode_token(refreshtoken)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=401,
                detail="Invalid refresh token",
            )
        
        user_id = int(payload.get("sub"))
    
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid refresh token",
        )
    
    new_access = create_access_token(user_id)
    new_refresh = create_refresh_token(user_id)
    
    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        token_type="bearer",
    )

@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_active_user)
):
    logger.info("User %s logged out", current_user.email)

    return {"message": f"{current_user.email} has logged out"}

@router.get("/me", response_model=UserResponse)
def read_me(current_user: User = Depends(get_current_active_user)) -> UserResponse:
    return current_user

@router.get("/admin", response_model=UserResponse)
def admin_only(
    current_user: User = Depends(require_roles("admin")),
) -> UserResponse:
    return current_user