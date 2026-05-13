"""Unified attachments API - flat resource with explicit target params."""

from __future__ import annotations

from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Path, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.storage import get_attachment_storage
from app.core.errors import DomainError
from app.db.session import get_db
from app.modules.attachments.adapters.storage import AttachmentStorage
from app.modules.attachments.schemas.attachment import AttachmentListResponse, AttachmentRead
from app.modules.attachments.services import attachments
from app.modules.projects.models import User

router = APIRouter(prefix="/attachments", tags=["attachments"])


def _validate_list_target(
    test_case_id: str | None,
    step_id: str | None,
    run_case_id: str | None,
    draft_step_client_id: str | None,
) -> tuple[str, str]:
    """Validate GET params, return (owner_type, owner_id) for internal use.
    Raises DomainError 422 if invalid.
    """
    has_tc = test_case_id is not None
    has_step = step_id is not None
    has_run = run_case_id is not None
    has_draft = draft_step_client_id is not None

    if has_tc and not has_step and not has_run and not has_draft:
        return ("test_case", test_case_id)
    if has_step and not has_tc and not has_run and not has_draft:
        return ("step", step_id)
    if has_run and not has_tc and not has_step and not has_draft:
        return ("run_case", run_case_id)
    if has_tc and has_draft and not has_step and not has_run:
        return ("draft_step", f"{test_case_id}:{draft_step_client_id}")

    if not has_tc and not has_step and not has_run:
        raise DomainError(
            status_code=422,
            code="attachment_target_required",
            title="Validation error",
            detail="Exactly one target is required: test_case_id, step_id, run_case_id, or test_case_id+draft_step_client_id",
            errors={"target": ["Target parameters are required"]},
        )
    raise DomainError(
        status_code=422,
        code="attachment_target_invalid",
        title="Validation error",
        detail="Invalid target combination. Use exactly one: test_case_id, step_id, run_case_id, or test_case_id+draft_step_client_id",
        errors={"target": ["Invalid or mixed target parameters"]},
    )


def _validate_post_target(
    test_case_id: str | None,
    step_id: str | None,
    run_case_id: str | None,
    draft_step_client_id: str | None,
) -> tuple[str, str]:
    """Validate POST form target, return (owner_type, owner_id)."""
    return _validate_list_target(test_case_id, step_id, run_case_id, draft_step_client_id)


@router.get("")
async def list_attachments(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    test_case_id: Annotated[str | None, Query(description="Filter by test case")] = None,
    step_id: Annotated[str | None, Query(description="Filter by step")] = None,
    run_case_id: Annotated[str | None, Query(description="Filter by run case")] = None,
    draft_step_client_id: Annotated[str | None, Query(description="Draft step client ID (requires test_case_id)")] = None,
) -> AttachmentListResponse:
    owner_type, owner_id = _validate_list_target(
        test_case_id, step_id, run_case_id, draft_step_client_id
    )
    return await attachments.list_attachments(
        db,
        owner_type=owner_type,
        owner_id=owner_id,
        current_user=current_user,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    db: Annotated[AsyncSession, Depends(get_db)],
    storage: Annotated[AttachmentStorage, Depends(get_attachment_storage)],
    current_user: Annotated[User, Depends(get_current_user)],
    file: Annotated[UploadFile, File(...)],
    test_case_id: Annotated[str | None, Form()] = None,
    step_id: Annotated[str | None, Form()] = None,
    run_case_id: Annotated[str | None, Form()] = None,
    draft_step_client_id: Annotated[str | None, Form()] = None,
) -> AttachmentRead:
    owner_type, owner_id = _validate_post_target(
        test_case_id, step_id, run_case_id, draft_step_client_id
    )
    return await attachments.create_attachment(
        db,
        owner_type=owner_type,
        owner_id=owner_id,
        file=file,
        storage=storage,
        current_user=current_user,
    )


@router.get("/{attachment_id}")
async def download_attachment(
    attachment_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    storage: Annotated[AttachmentStorage, Depends(get_attachment_storage)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> StreamingResponse:
    download = await attachments.download_attachment(
        db,
        attachment_id=attachment_id,
        storage=storage,
        current_user=current_user,
    )
    return StreamingResponse(
        download.stream,
        media_type=download.content_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(download.filename)}"},
        background=BackgroundTask(download.stream.close),
    )


@router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment(
    attachment_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    storage: Annotated[AttachmentStorage, Depends(get_attachment_storage)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await attachments.delete_attachment(
        db,
        attachment_id=attachment_id,
        storage=storage,
        current_user=current_user,
    )
