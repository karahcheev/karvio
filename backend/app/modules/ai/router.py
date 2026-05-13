from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.core.config import Settings, get_settings
from app.core.errors import DomainError
from app.db.session import get_db
from app.models.enums import ProjectMemberRole
from app.modules.ai.schemas import (
    AiFeatureStatus,
    DuplicateCheckRequest,
    DuplicateCheckResponse,
    GenerateTestCasesRequest,
    GenerateTestCasesResponse,
    GlobalAiSettingsRead,
    GlobalAiSettingsUpdate,
    ProjectAiSettingsOverviewList,
    ProjectAiSettingsRead,
    ProjectAiSettingsUpdate,
    ReviewTestCaseRequest,
    ReviewTestCaseResponse,
)
from app.modules.ai.services import duplicates, test_case_generator, test_case_reviewer
from app.modules.ai.services import settings as ai_settings_service
from app.modules.projects.models import User
from app.services.access import ensure_project_role

router = APIRouter(prefix="/ai/test-cases", tags=["ai-test-cases"])
settings_router = APIRouter(prefix="/settings/ai", tags=["settings"])


@router.get("/status")
async def get_ai_test_case_status(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    project_id: Annotated[str | None, Query()] = None,
) -> AiFeatureStatus:
    return await ai_settings_service.get_ai_feature_status(
        db,
        project_id=project_id,
        current_user=current_user,
        settings=settings,
    )


@router.post("/generate")
async def generate_test_cases(
    payload: GenerateTestCasesRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> GenerateTestCasesResponse:
    return await test_case_generator.generate_test_cases(
        db,
        payload=payload,
        current_user=current_user,
        settings=settings,
    )


@router.post("/{test_case_id}/review")
async def review_test_case(
    test_case_id: Annotated[str, Path(...)],
    payload: ReviewTestCaseRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ReviewTestCaseResponse:
    return await test_case_reviewer.review_test_case(
        db,
        test_case_id=test_case_id,
        payload=payload,
        current_user=current_user,
        settings=settings,
    )


@router.post("/duplicates/check")
async def check_duplicates(
    payload: DuplicateCheckRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> DuplicateCheckResponse:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.viewer)
    effective_settings = await ai_settings_service.get_effective_ai_settings(
        db,
        project_id=payload.project_id,
        settings=settings,
    )
    if effective_settings is None:
        raise DomainError(
            status_code=404,
            code="ai_test_case_assistant_disabled",
            title="Not found",
            detail="AI test case assistant is disabled for this project",
        )
    if not effective_settings.provider or not effective_settings.model or not effective_settings.api_key:
        raise DomainError(
            status_code=503,
            code="ai_provider_not_configured",
            title="AI provider unavailable",
            detail="AI model and API key must be configured",
        )
    return await duplicates.check_duplicates(
        db,
        payload=payload,
        current_user=current_user,
        duplicate_high_threshold=effective_settings.duplicate_high_threshold,
        duplicate_medium_threshold=effective_settings.duplicate_medium_threshold,
    )


@settings_router.get("")
async def list_ai_settings_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ProjectAiSettingsOverviewList:
    """Return AI settings for all manageable projects.

    Admins receive every project; non-admins receive only projects where they
    hold the manager role.
    """
    return await ai_settings_service.list_project_ai_settings_overview(
        db,
        current_user=current_user,
        settings=settings,
    )


@settings_router.get("/global")
async def get_global_ai_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> GlobalAiSettingsRead:
    """Return global AI settings (superadmin only)."""
    return await ai_settings_service.get_global_ai_settings(db, current_user=current_user)


@settings_router.put("/global")
async def update_global_ai_settings(
    payload: GlobalAiSettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> GlobalAiSettingsRead:
    """Update global AI settings (superadmin only)."""
    return await ai_settings_service.update_global_ai_settings(db, payload=payload, current_user=current_user)


@settings_router.delete("/{project_id}", status_code=204)
async def delete_project_ai_settings(
    project_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Remove project-level AI settings so the project falls back to global/env config."""
    await ai_settings_service.delete_project_ai_settings(
        db,
        project_id=project_id,
        current_user=current_user,
    )


@settings_router.get("/{project_id}")
async def get_project_ai_settings(
    project_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ProjectAiSettingsRead:
    """Return detailed AI settings for a single project (used by the edit form)."""
    return await ai_settings_service.get_project_ai_settings(
        db,
        project_id=project_id,
        current_user=current_user,
        settings=settings,
    )


@settings_router.put("")
async def update_project_ai_settings(
    payload: ProjectAiSettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectAiSettingsRead:
    return await ai_settings_service.update_project_ai_settings(
        db,
        payload=payload,
        current_user=current_user,
    )
