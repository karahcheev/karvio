from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.domain_strings import (
    ACTION_AUTH_CHANGE_PASSWORD,
    ACTION_AUTH_LOGIN,
    EVENT_USE_CASE_AUTH_CHANGE_PASSWORD,
    EVENT_USE_CASE_AUTH_LOGIN,
)
from app.core.errors import DomainError
from app.core.metrics import record_use_case
from app.core.security import create_access_token, hash_password, verify_password
from app.modules.auth import presenters as auth_presenters
from app.modules.auth.repositories import auth as auth_repo
from app.modules.auth.schemas.auth import LoginRequest, TokenResponse
from app.modules.projects.models import User
from app.modules.projects.schemas.user import UserPasswordChangeRequest
from app.modules.audit.services import audit as audit_service

logger = logging.getLogger("tms.use_case.auth")


async def login(db: AsyncSession, payload: LoginRequest) -> TokenResponse:
    user = await auth_repo.get_user_by_username(db, payload.username)
    if not user or not verify_password(payload.password, user.password_hash):
        record_use_case(ACTION_AUTH_LOGIN, outcome="invalid_credentials")
        logger.warning(
            "Auth login failed",
            extra={"event": EVENT_USE_CASE_AUTH_LOGIN, "outcome": "invalid_credentials", "username": payload.username},
        )
        await audit_service.try_emit_event_immediately(
            action=ACTION_AUTH_LOGIN,
            resource_type="user",
            resource_id=None,
            result="fail",
            metadata={"username": payload.username, "reason": "invalid_credentials"},
        )
        raise DomainError(
            status_code=401,
            code="invalid_credentials",
            title="Unauthorized",
            detail="Invalid username or password",
        )
    if not user.is_enabled:
        record_use_case(ACTION_AUTH_LOGIN, outcome="user_disabled")
        logger.warning(
            "Auth login failed",
            extra={
                "event": EVENT_USE_CASE_AUTH_LOGIN,
                "outcome": "user_disabled",
                "user_id": user.id,
                "username": payload.username,
            },
        )
        await audit_service.try_emit_event_immediately(
            action=ACTION_AUTH_LOGIN,
            resource_type="user",
            resource_id=user.id,
            result="fail",
            metadata={"username": payload.username, "reason": "user_disabled"},
            actor_id=user.id,
            actor_type="user",
        )
        raise DomainError(
            status_code=403,
            code="user_disabled",
            title="Forbidden",
            detail="User account is disabled",
        )
    before_state = audit_service.snapshot_entity(user)
    user.last_login_at = datetime.now(timezone.utc)
    await audit_service.queue_update_event(
        db,
        action=ACTION_AUTH_LOGIN,
        resource_type="user",
        entity=user,
        before=before_state,
    )
    record_use_case(ACTION_AUTH_LOGIN, outcome="success")
    logger.info(
        "Auth login succeeded",
        extra={"event": EVENT_USE_CASE_AUTH_LOGIN, "outcome": "success", "user_id": user.id},
    )
    return TokenResponse(
        access_token=create_access_token(user.id, user.token_version),
        user=await auth_presenters.user_to_read_with_memberships(db, user),
    )


async def change_password(db: AsyncSession, *, payload: UserPasswordChangeRequest, current_user: User) -> None:
    if not verify_password(payload.current_password, current_user.password_hash):
        record_use_case(ACTION_AUTH_CHANGE_PASSWORD, outcome="invalid_current_password")
        logger.warning(
            "Password change failed",
            extra={
                "event": EVENT_USE_CASE_AUTH_CHANGE_PASSWORD,
                "outcome": "invalid_current_password",
                "user_id": current_user.id,
            },
        )
        await audit_service.try_emit_event_immediately(
            action=ACTION_AUTH_CHANGE_PASSWORD,
            resource_type="user",
            resource_id=current_user.id,
            result="fail",
            metadata={"reason": "invalid_current_password"},
            actor_id=current_user.id,
            actor_type="user",
        )
        raise DomainError(
            status_code=400,
            code="invalid_current_password",
            title="Invalid request",
            detail="Current password is incorrect",
        )
    before_state = audit_service.snapshot_entity(current_user)
    current_user.password_hash = hash_password(payload.new_password)
    current_user.token_version += 1
    await audit_service.queue_update_event(
        db,
        action=ACTION_AUTH_CHANGE_PASSWORD,
        resource_type="user",
        entity=current_user,
        before=before_state,
    )
    record_use_case(ACTION_AUTH_CHANGE_PASSWORD, outcome="success")
    logger.info(
        "Password changed",
        extra={"event": EVENT_USE_CASE_AUTH_CHANGE_PASSWORD, "outcome": "success", "user_id": current_user.id},
    )
