from __future__ import annotations

from datetime import date
from typing import Annotated, Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, Path, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.modules.projects.models import User
from app.modules.reports.schemas.overview import ProjectOverviewRead
from app.modules.reports.services import reports as reports_service

router = APIRouter(tags=["reports"])


@router.get("/projects/{project_id}/overview/export")
async def export_project_overview(
    project_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    export_format: Annotated[
        reports_service.OverviewExportFormat,
        Query(alias="format"),
    ] = reports_service.OverviewExportFormat.json,
    created_from: Annotated[date | None, Query()] = None,
    created_to: Annotated[date | None, Query()] = None,
    milestone_id: Annotated[list[str] | None, Query(description="Filter by milestone id.")] = None,
    top_n: Annotated[int, Query(ge=1, le=100)] = 8,
    granularity: Annotated[Literal["day", "week", "month"] | None, Query()] = None,
) -> Response:
    result = await reports_service.export_project_overview(
        db,
        project_id=project_id,
        created_from=created_from,
        created_to=created_to,
        milestone_ids=milestone_id,
        top_n=top_n,
        granularity=granularity,
        export_format=export_format,
        current_user=current_user,
    )
    return Response(
        content=result.content,
        media_type=result.media_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(result.filename)}"},
    )


@router.get("/projects/{project_id}/overview")
async def project_overview(
    project_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    created_from: Annotated[date | None, Query()] = None,
    created_to: Annotated[date | None, Query()] = None,
    milestone_id: Annotated[list[str] | None, Query(description="Filter by milestone id. Repeat for multiple.")] = None,
    top_n: Annotated[int, Query(ge=1, le=100)] = 8,
    granularity: Annotated[Literal["day", "week", "month"] | None, Query()] = None,
) -> ProjectOverviewRead:
    return await reports_service.project_overview(
        db,
        project_id=project_id,
        created_from=created_from,
        created_to=created_to,
        milestone_ids=milestone_id,
        top_n=top_n,
        granularity=granularity,
        current_user=current_user,
    )
