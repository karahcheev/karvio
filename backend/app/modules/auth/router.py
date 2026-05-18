from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.modules.projects.models import User
from app.modules.auth.schemas.auth import LoginRequest, LoginResponse
from app.modules.projects.schemas.user import UserRead
from app.modules.auth.services import auth as auth_service
from app.modules.auth import presenters as auth_presenters

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.access_token_ttl_seconds,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_same_site,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_same_site,
    )


@router.post("/login")
async def login(
    payload: LoginRequest, response: Response, db: Annotated[AsyncSession, Depends(get_db)]
) -> LoginResponse:
    result = await auth_service.login(db, payload)
    _set_session_cookie(response, result.access_token)
    return LoginResponse(user=result.user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    _clear_session_cookie(response)


@router.get("/me")
async def me(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserRead:
    return await auth_presenters.user_to_read_with_memberships(db, current_user)
