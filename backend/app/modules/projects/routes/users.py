from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.modules.projects.models import User
from app.modules.auth.schemas.api_keys import (
    UserApiKeyCreateRequest,
    UserApiKeyRead,
    UserApiKeyPatchRequest,
    UserApiKeysList,
    UserApiKeySecretResponse,
)
from app.modules.projects.schemas.user import (
    UserCreate,
    UserPasswordChangeRequest,
    UserPasswordSetRequest,
    UserPatch,
    UserRead,
    UsersList,
)
from app.modules.auth.services import api_keys as api_keys_service
from app.modules.auth.services import auth as auth_service
from app.modules.projects.services import users

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(le=200)] = 50,
    search: Annotated[str | None, Query(description="Search by username, email, name, team")] = None,
    sort_by: Annotated[
        Literal["created_at", "updated_at", "id", "username", "email", "team", "project_count", "is_enabled", "last_login_at"],
        Query(),
    ] = "created_at",
    sort_order: Annotated[Literal["asc", "desc"], Query()] = "desc",
) -> UsersList:
    return await users.list_users(
        db,
        current_user=current_user,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserRead:
    return await users.create_user(db, payload, current_user=current_user)


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_own_password(
    payload: UserPasswordChangeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await auth_service.change_password(db, payload=payload, current_user=current_user)


@router.get("/me/api-keys")
async def list_my_api_keys(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserApiKeysList:
    return await api_keys_service.list_my_api_keys(db, current_user=current_user)


@router.post("/me/api-keys", status_code=status.HTTP_201_CREATED)
async def create_my_api_key(
    payload: UserApiKeyCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserApiKeySecretResponse:
    return await api_keys_service.create_my_api_key(db, current_user=current_user, payload=payload)


@router.patch("/me/api-keys/{api_key_id}")
async def patch_my_api_key(
    api_key_id: Annotated[str, Path(...)],
    payload: UserApiKeyPatchRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserApiKeyRead:
    return await api_keys_service.patch_my_api_key(db, current_user=current_user, api_key_id=api_key_id, payload=payload)


@router.post("/me/api-keys/{api_key_id}/regenerate")
async def regenerate_my_api_key(
    api_key_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserApiKeySecretResponse:
    return await api_keys_service.regenerate_my_api_key(db, current_user=current_user, api_key_id=api_key_id)


@router.delete("/me/api-keys/{api_key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_api_key(
    api_key_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await api_keys_service.delete_my_api_key(db, current_user=current_user, api_key_id=api_key_id)


@router.get("/{user_id}")
async def get_user(
    user_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserRead:
    return await users.get_user(db, user_id=user_id, current_user=current_user)


@router.patch("/{user_id}")
async def patch_user(
    user_id: Annotated[str, Path(...)],
    payload: UserPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserRead:
    return await users.patch_user(
        db,
        user_id=user_id,
        payload=payload,
        current_user=current_user,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await users.delete_user(db, user_id=user_id, current_user=current_user)


@router.put("/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
async def set_user_password(
    user_id: Annotated[str, Path(...)],
    payload: UserPasswordSetRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await users.set_user_password(
        db,
        user_id=user_id,
        payload=payload,
        current_user=current_user,
    )
