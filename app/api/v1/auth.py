# import required libraries 
from app.models.user import User
from sqlalchemy.orm import Session
from app.db.sessions import get_db
from app.api.deps import get_current_active_user
from app.core.security import create_access_token
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import APIRouter, Depends, HTTPException, status 
from app.schemas.auth import TokenResponse, UserLogin, UserRegister, UserResponse
from app.services.auth_service import authenticate_user, create_user, get_user_by_email

router = APIRouter(prefix="/auth", tags=["auth"])

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

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
    )


@router.get("/me", response_model=UserResponse)
def read_me(current_user: User = Depends(get_current_active_user)) -> UserResponse:
    return current_user