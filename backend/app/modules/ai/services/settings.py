from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Depends
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.errors import DomainError
from app.core.token_crypto import decrypt_secret, encrypt_secret
from app.models.enums import ProjectMemberRole, UserRole
from app.modules.ai.models import GLOBAL_AI_SETTINGS_ID, GlobalAiSettings, ProjectAiSettings
from app.modules.ai.providers.openai_provider import OpenAiProvider
from app.modules.ai.schemas import (
    AiEffectiveSource,
    AiFeatureStatus,
    GlobalAiSettingsRead,
    GlobalAiSettingsUpdate,
    ProjectAiSettingsOverviewItem,
    ProjectAiSettingsOverviewList,
    ProjectAiSettingsRead,
    ProjectAiSettingsUpdate,
)
from app.modules.ai.services.provider import AiProvider
from app.modules.projects.models import Project, ProjectMember, User
from app.services.access import ensure_admin, ensure_project_role


def ensure_ai_enabled(settings: Settings) -> None:
    if settings.ai_test_case_assistant_enabled:
        return
    raise DomainError(
        status_code=404,
        code="ai_test_case_assistant_disabled",
        title="Not found",
        detail="AI test case assistant is disabled",
    )


def _mask_settings(entity: ProjectAiSettings) -> ProjectAiSettingsRead:
    return ProjectAiSettingsRead(
        id=entity.id,
        project_id=entity.project_id,
        enabled=entity.enabled,
        provider=entity.provider,
        model=entity.model,
        api_key_configured=bool(entity.api_key_encrypted),
        timeout_ms=entity.timeout_ms,
        http_max_retries=entity.http_max_retries,
        duplicate_high_threshold=entity.duplicate_high_threshold,
        duplicate_medium_threshold=entity.duplicate_medium_threshold,
        created_at=entity.created_at,
        updated_at=entity.updated_at,
    )


async def get_project_ai_settings_entity(db: AsyncSession, project_id: str) -> ProjectAiSettings | None:
    return await db.scalar(select(ProjectAiSettings).where(ProjectAiSettings.project_id == project_id))


def _global_status(settings: Settings) -> AiFeatureStatus:
    configured = bool(settings.ai_test_case_assistant_enabled and settings.ai_provider and settings.ai_model and settings.ai_api_key)
    return AiFeatureStatus(
        enabled=configured,
        provider=settings.ai_provider if configured else None,
        model=settings.ai_model if configured else None,
    )


async def get_ai_feature_status(
    db: AsyncSession,
    *,
    project_id: str | None,
    current_user: User,
    settings: Settings,
) -> AiFeatureStatus:
    if project_id is None:
        return _global_status(settings)
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    entity = await get_project_ai_settings_entity(db, project_id)
    if entity is not None:
        configured = bool(entity.enabled and entity.provider and entity.model and entity.api_key_encrypted)
        return AiFeatureStatus(
            enabled=configured,
            provider=entity.provider if configured else None,
            model=entity.model if configured else None,
        )
    return _global_status(settings)


async def get_project_ai_settings(
    db: AsyncSession,
    *,
    project_id: str,
    current_user: User,
    settings: Settings,
) -> ProjectAiSettingsRead:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.manager)
    entity = await get_project_ai_settings_entity(db, project_id)
    if entity is None:
        now = datetime.now(timezone.utc)
        return ProjectAiSettingsRead(
            id="new",
            project_id=project_id,
            enabled=False,
            provider="openai" if settings.ai_provider in (None, "openai") else None,
            model=settings.ai_model,
            api_key_configured=False,
            timeout_ms=settings.ai_timeout_ms,
            http_max_retries=settings.ai_http_max_retries,
            duplicate_high_threshold=settings.ai_duplicate_high_threshold,
            duplicate_medium_threshold=settings.ai_duplicate_medium_threshold,
            created_at=now,
            updated_at=now,
        )
    return _mask_settings(entity)


async def delete_project_ai_settings(
    db: AsyncSession,
    *,
    project_id: str,
    current_user: User,
) -> None:
    """Remove the project-level AI settings override so the project falls back to global/env."""
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.manager)
    entity = await get_project_ai_settings_entity(db, project_id)
    if entity is not None:
        await db.delete(entity)
        await db.flush()


async def update_project_ai_settings(
    db: AsyncSession,
    *,
    payload: ProjectAiSettingsUpdate,
    current_user: User,
) -> ProjectAiSettingsRead:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.manager)
    entity = await get_project_ai_settings_entity(db, payload.project_id)
    if entity is None:
        entity = ProjectAiSettings(project_id=payload.project_id)
        db.add(entity)
    entity.enabled = payload.enabled
    entity.provider = payload.provider
    entity.model = payload.model.strip() if payload.model else None
    if payload.api_key is not None:
        entity.api_key_encrypted = encrypt_secret(payload.api_key)
    entity.timeout_ms = payload.timeout_ms
    entity.http_max_retries = payload.http_max_retries
    entity.duplicate_high_threshold = payload.duplicate_high_threshold
    entity.duplicate_medium_threshold = payload.duplicate_medium_threshold
    await db.flush()
    await db.refresh(entity)
    return _mask_settings(entity)


# ── Global AI settings ───────────────────────────────────────────────────────

async def get_global_ai_settings_entity(db: AsyncSession) -> GlobalAiSettings | None:
    return await db.scalar(select(GlobalAiSettings).where(GlobalAiSettings.id == GLOBAL_AI_SETTINGS_ID))


def _mask_global_settings(entity: GlobalAiSettings) -> GlobalAiSettingsRead:
    return GlobalAiSettingsRead(
        enabled=entity.enabled,
        provider=entity.provider,
        model=entity.model,
        api_key_configured=bool(entity.api_key_encrypted),
        timeout_ms=entity.timeout_ms,
        http_max_retries=entity.http_max_retries,
        duplicate_high_threshold=entity.duplicate_high_threshold,
        duplicate_medium_threshold=entity.duplicate_medium_threshold,
        created_at=entity.created_at,
        updated_at=entity.updated_at,
    )


async def get_global_ai_settings(
    db: AsyncSession,
    *,
    current_user: User,
) -> GlobalAiSettingsRead:
    await ensure_admin(current_user, action="ai.global_settings.read")
    entity = await get_global_ai_settings_entity(db)
    if entity is None:
        now = datetime.now(timezone.utc)
        return GlobalAiSettingsRead(
            enabled=False,
            provider="openai",
            model=None,
            api_key_configured=False,
            timeout_ms=30000,
            http_max_retries=2,
            duplicate_high_threshold=0.88,
            duplicate_medium_threshold=0.72,
            created_at=now,
            updated_at=now,
        )
    return _mask_global_settings(entity)


async def update_global_ai_settings(
    db: AsyncSession,
    *,
    payload: GlobalAiSettingsUpdate,
    current_user: User,
) -> GlobalAiSettingsRead:
    await ensure_admin(current_user, action="ai.global_settings.update")
    entity = await get_global_ai_settings_entity(db)
    if entity is None:
        entity = GlobalAiSettings(id=GLOBAL_AI_SETTINGS_ID)
        db.add(entity)
    entity.enabled = payload.enabled
    entity.provider = payload.provider
    entity.model = payload.model.strip() if payload.model else None
    if payload.api_key is not None:
        entity.api_key_encrypted = encrypt_secret(payload.api_key)
    entity.timeout_ms = payload.timeout_ms
    entity.http_max_retries = payload.http_max_retries
    entity.duplicate_high_threshold = payload.duplicate_high_threshold
    entity.duplicate_medium_threshold = payload.duplicate_medium_threshold
    await db.flush()
    await db.refresh(entity)
    return _mask_global_settings(entity)


# ── Effective settings resolution ────────────────────────────────────────────

class EffectiveAiSettings:
    def __init__(
        self,
        *,
        provider: str | None,
        model: str | None,
        api_key: str | None,
        timeout_ms: int,
        http_max_retries: int,
        duplicate_high_threshold: float,
        duplicate_medium_threshold: float,
    ) -> None:
        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.timeout_ms = timeout_ms
        self.http_max_retries = http_max_retries
        self.duplicate_high_threshold = duplicate_high_threshold
        self.duplicate_medium_threshold = duplicate_medium_threshold


def _decrypt_key(encrypted: str) -> str:
    try:
        return decrypt_secret(encrypted)
    except ValueError as exc:
        raise DomainError(
            status_code=503,
            code="ai_provider_secret_invalid",
            title="AI provider unavailable",
            detail="AI provider key could not be decrypted",
        ) from exc


async def get_effective_ai_settings(
    db: AsyncSession,
    *,
    project_id: str,
    settings: Settings,
) -> EffectiveAiSettings | None:
    # 1. Project-level override
    entity = await get_project_ai_settings_entity(db, project_id)
    if entity is not None:
        if not entity.enabled:
            return None
        return EffectiveAiSettings(
            provider=entity.provider,
            model=entity.model,
            api_key=_decrypt_key(entity.api_key_encrypted) if entity.api_key_encrypted else None,
            timeout_ms=entity.timeout_ms,
            http_max_retries=entity.http_max_retries,
            duplicate_high_threshold=entity.duplicate_high_threshold,
            duplicate_medium_threshold=entity.duplicate_medium_threshold,
        )

    # 2. Global DB settings
    global_entity = await get_global_ai_settings_entity(db)
    if global_entity is not None:
        if not global_entity.enabled:
            return None
        return EffectiveAiSettings(
            provider=global_entity.provider,
            model=global_entity.model,
            api_key=_decrypt_key(global_entity.api_key_encrypted) if global_entity.api_key_encrypted else None,
            timeout_ms=global_entity.timeout_ms,
            http_max_retries=global_entity.http_max_retries,
            duplicate_high_threshold=global_entity.duplicate_high_threshold,
            duplicate_medium_threshold=global_entity.duplicate_medium_threshold,
        )

    # 3. Env-var fallback (backward compat)
    if not settings.ai_test_case_assistant_enabled:
        return None
    return EffectiveAiSettings(
        provider=settings.ai_provider,
        model=settings.ai_model,
        api_key=settings.ai_api_key,
        timeout_ms=settings.ai_timeout_ms,
        http_max_retries=settings.ai_http_max_retries,
        duplicate_high_threshold=settings.ai_duplicate_high_threshold,
        duplicate_medium_threshold=settings.ai_duplicate_medium_threshold,
    )


async def get_ai_provider_for_project(
    db: AsyncSession,
    *,
    project_id: str,
    settings: Settings,
) -> tuple[AiProvider, EffectiveAiSettings]:
    effective = await get_effective_ai_settings(db, project_id=project_id, settings=settings)
    if effective is None:
        raise DomainError(
            status_code=404,
            code="ai_test_case_assistant_disabled",
            title="Not found",
            detail="AI test case assistant is disabled for this project",
        )
    if effective.provider != "openai":
        raise DomainError(
            status_code=503,
            code="ai_provider_not_configured",
            title="AI provider unavailable",
            detail="AI provider is not configured",
        )
    if not effective.model or not effective.api_key:
        raise DomainError(
            status_code=503,
            code="ai_provider_not_configured",
            title="AI provider unavailable",
            detail="AI model and API key must be configured",
        )
    return (
        OpenAiProvider(
            api_key=effective.api_key,
            model=effective.model,
            timeout_ms=effective.timeout_ms,
            max_retries=effective.http_max_retries,
        ),
        effective,
    )


async def list_project_ai_settings_overview(
    db: AsyncSession,
    *,
    current_user: User,
    settings: Settings,
) -> ProjectAiSettingsOverviewList:
    """Return AI settings summary for all projects the current user can manage.

    Admins see every project; non-admins see only projects where they hold the
    manager role.  A single LEFT JOIN query avoids N+1 per-project lookups.
    """
    if current_user.role == UserRole.admin:
        stmt = (
            select(Project, ProjectAiSettings)
            .outerjoin(ProjectAiSettings, ProjectAiSettings.project_id == Project.id)
            .order_by(func.lower(Project.name))
        )
    else:
        stmt = (
            select(Project, ProjectAiSettings)
            .join(
                ProjectMember,
                and_(
                    ProjectMember.project_id == Project.id,
                    ProjectMember.user_id == current_user.id,
                    ProjectMember.role == ProjectMemberRole.manager,
                ),
            )
            .outerjoin(ProjectAiSettings, ProjectAiSettings.project_id == Project.id)
            .order_by(func.lower(Project.name))
        )

    rows = (await db.execute(stmt)).all()

    # Resolve the fallback for projects with no project-level override.
    # Priority: global DB row > env vars.
    global_entity = await get_global_ai_settings_entity(db)

    if global_entity is not None:
        fallback_enabled = global_entity.enabled
        fallback_provider = global_entity.provider if global_entity.enabled else None
        fallback_model = global_entity.model
        fallback_api_key_configured = bool(global_entity.api_key_encrypted)
        fallback_source: AiEffectiveSource = "global"
    else:
        env_key_configured = bool(settings.ai_api_key)
        env_enabled = bool(
            settings.ai_test_case_assistant_enabled
            and settings.ai_provider
            and settings.ai_model
            and settings.ai_api_key
        )
        fallback_enabled = env_enabled
        fallback_provider = settings.ai_provider if env_enabled else None
        fallback_model = settings.ai_model
        fallback_api_key_configured = env_key_configured
        fallback_source = "env"

    items: list[ProjectAiSettingsOverviewItem] = []
    for row in rows:
        project: Project = row[0]
        ai: ProjectAiSettings | None = row[1]

        if ai is not None:
            items.append(
                ProjectAiSettingsOverviewItem(
                    project_id=project.id,
                    project_name=project.name,
                    has_project_settings=True,
                    enabled=ai.enabled,
                    provider=ai.provider,
                    model=ai.model,
                    api_key_configured=bool(ai.api_key_encrypted),
                    effective_source="project",
                )
            )
        else:
            items.append(
                ProjectAiSettingsOverviewItem(
                    project_id=project.id,
                    project_name=project.name,
                    has_project_settings=False,
                    enabled=fallback_enabled,
                    provider=fallback_provider,
                    model=fallback_model,
                    api_key_configured=fallback_api_key_configured,
                    effective_source=fallback_source,
                )
            )

    return ProjectAiSettingsOverviewList(items=items)


def get_ai_provider(settings: Settings = Depends(get_settings)) -> AiProvider:
    ensure_ai_enabled(settings)
    if settings.ai_provider != "openai":
        raise DomainError(
            status_code=503,
            code="ai_provider_not_configured",
            title="AI provider unavailable",
            detail="AI provider is not configured",
        )
    if not settings.ai_model or not settings.ai_api_key:
        raise DomainError(
            status_code=503,
            code="ai_provider_not_configured",
            title="AI provider unavailable",
            detail="AI model and API key must be configured",
        )
    return OpenAiProvider(
        api_key=settings.ai_api_key,
        model=settings.ai_model,
        timeout_ms=settings.ai_timeout_ms,
        max_retries=settings.ai_http_max_retries,
    )
