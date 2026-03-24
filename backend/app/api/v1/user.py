from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.sessions import get_db
from app.models.user import User
from app.schemas.auth import UserResponse
from app.schemas.user import UpdateUserRoleRequest, UserStatusResponse
from app.services.auth_service import (
    deactivate_user_by_id,
    get_all_users,
    update_user_role,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
) -> list[UserResponse]:
    return get_all_users(db)


@router.patch("/{user_id}/deactivate", response_model=UserStatusResponse)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
) -> UserStatusResponse:
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin cannot deactivate their own account",
        )

    user = deactivate_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserStatusResponse(message=f"User {user.email} deactivated successfully")


@router.patch("/{user_id}/role", response_model=UserResponse)
def change_user_role(
    user_id: int,
    payload: UpdateUserRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
) -> UserResponse:
    allowed_roles = {"user", "admin"}
    if payload.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role",
        )

    user = update_user_role(db, user_id, payload.role)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user