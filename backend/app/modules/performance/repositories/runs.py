from __future__ import annotations

from typing import Literal

from sqlalchemy import String, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.performance.models import (
    PerformanceImport,
    PerformanceRun,
    PerformanceRunArtifact,
)
from app.repositories.common import OffsetPage, SortDirection

PerformanceRunSortField = Literal[
    "created_at",
    "started_at",
    "name",
    "status",
    "verdict",
    "load_kind",
    "env",
]


async def list_runs_by_project(
    db: AsyncSession,
    *,
    project_id: str,
    status_filters: list[str] | None,
    verdict_filters: list[str] | None,
    load_kind_filters: list[str] | None,
    env_filters: list[str] | None,
    search: str | None,
    include_archived: bool,
    page: int,
    page_size: int,
    sort_by: PerformanceRunSortField,
    sort_direction: SortDirection,
) -> OffsetPage[PerformanceRun]:
    sort_value_expr = {
        "created_at": PerformanceRun.created_at,
        "started_at": PerformanceRun.started_at,
        "name": func.lower(PerformanceRun.name),
        "status": func.lower(cast(PerformanceRun.status, String)),
        "verdict": func.lower(cast(PerformanceRun.verdict, String)),
        "load_kind": func.lower(cast(PerformanceRun.load_kind, String)),
        "env": func.lower(func.coalesce(PerformanceRun.env, "")),
    }[sort_by]

    stmt = (
        select(PerformanceRun)
        .where(PerformanceRun.project_id == project_id)
    )

    if not include_archived:
        stmt = stmt.where(PerformanceRun.archived.is_(False))

    if status_filters:
        stmt = stmt.where(PerformanceRun.status.in_(status_filters))
    if verdict_filters:
        stmt = stmt.where(PerformanceRun.verdict.in_(verdict_filters))
    if load_kind_filters:
        stmt = stmt.where(PerformanceRun.load_kind.in_(load_kind_filters))
    if env_filters:
        normalized = [value.strip().lower() for value in env_filters if value.strip()]
        if normalized:
            stmt = stmt.where(func.lower(PerformanceRun.env).in_(normalized))
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            PerformanceRun.name.ilike(pattern)
            | PerformanceRun.service.ilike(pattern)
            | PerformanceRun.scenario.ilike(pattern)
            | PerformanceRun.load_profile.ilike(pattern)
            | PerformanceRun.branch.ilike(pattern)
            | PerformanceRun.build.ilike(pattern)
            | PerformanceRun.version.ilike(pattern)
            | PerformanceRun.commit.ilike(pattern)
            | PerformanceRun.tool.ilike(pattern)
            | PerformanceRun.env.ilike(pattern)
        )

    sort_order = sort_value_expr.asc() if sort_direction == "asc" else sort_value_expr.desc()
    id_order = PerformanceRun.id.asc() if sort_direction == "asc" else PerformanceRun.id.desc()

    offset = (page - 1) * page_size
    result_rows = await db.scalars(stmt.order_by(sort_order, id_order).limit(page_size + 1).offset(offset))
    rows = list(result_rows.all())
    has_next = len(rows) > page_size
    items = rows[:page_size]
    return OffsetPage(items=items, page=page, page_size=page_size, has_next=has_next)


async def get_run_by_id(db: AsyncSession, run_id: str) -> PerformanceRun | None:
    return await db.get(PerformanceRun, run_id)


async def get_run_by_id_with_details(db: AsyncSession, run_id: str) -> PerformanceRun | None:
    return await db.scalar(
        select(PerformanceRun)
        .where(PerformanceRun.id == run_id)
        .options(
            selectinload(PerformanceRun.transactions),
            selectinload(PerformanceRun.errors),
            selectinload(PerformanceRun.artifacts),
            selectinload(PerformanceRun.imports),
        )
    )


async def list_run_ids_by_project_and_name(db: AsyncSession, *, project_id: str, name: str) -> list[str]:
    result_rows = await db.scalars(
        select(PerformanceRun.id)
        .where(
            PerformanceRun.project_id == project_id,
            func.lower(PerformanceRun.name) == name.strip().lower(),
        )
        .order_by(PerformanceRun.created_at.desc())
    )
    return list(result_rows.all())


async def find_latest_green_baseline(
    db: AsyncSession,
    *,
    project_id: str,
    load_kind: str,
    exclude_run_id: str,
) -> PerformanceRun | None:
    return await db.scalar(
        select(PerformanceRun)
        .where(
            PerformanceRun.project_id == project_id,
            PerformanceRun.load_kind == load_kind,
            PerformanceRun.verdict == "green",
            PerformanceRun.archived.is_(False),
            PerformanceRun.id != exclude_run_id,
        )
        .order_by(PerformanceRun.started_at.desc(), PerformanceRun.created_at.desc(), PerformanceRun.id.desc())
        .limit(1)
    )


async def find_tagged_baseline_marker(
    db: AsyncSession,
    *,
    project_id: str,
    load_kind: str,
    exclude_run_id: str | None = None,
) -> PerformanceRun | None:
    stmt = select(PerformanceRun).where(
        PerformanceRun.project_id == project_id,
        PerformanceRun.load_kind == load_kind,
        PerformanceRun.status == "completed",
        PerformanceRun.archived.is_(False),
        PerformanceRun.baseline_policy == "tagged",
        PerformanceRun.baseline_ref == PerformanceRun.id,
    )
    if exclude_run_id:
        stmt = stmt.where(PerformanceRun.id != exclude_run_id)
    return await db.scalar(
        stmt.order_by(PerformanceRun.started_at.desc(), PerformanceRun.created_at.desc(), PerformanceRun.id.desc()).limit(1)
    )


async def clear_tagged_baseline_markers(
    db: AsyncSession,
    *,
    project_id: str,
    load_kind: str,
    exclude_run_id: str | None = None,
) -> None:
    stmt = select(PerformanceRun).where(
        PerformanceRun.project_id == project_id,
        PerformanceRun.load_kind == load_kind,
        PerformanceRun.baseline_policy == "tagged",
        PerformanceRun.baseline_ref == PerformanceRun.id,
    )
    if exclude_run_id:
        stmt = stmt.where(PerformanceRun.id != exclude_run_id)
    result_rows = await db.scalars(stmt)
    rows = list(result_rows.all())
    for run in rows:
        run.baseline_ref = None
        run.baseline_policy = "manual"
        run.baseline_label = "Manual baseline"


async def get_import_by_id(db: AsyncSession, import_id: str) -> PerformanceImport | None:
    return await db.scalar(select(PerformanceImport).where(PerformanceImport.id == import_id))


async def get_import_by_id_with_run(db: AsyncSession, import_id: str) -> PerformanceImport | None:
    return await db.scalar(
        select(PerformanceImport)
        .where(PerformanceImport.id == import_id)
        .options(selectinload(PerformanceImport.run))
    )


async def get_latest_import_for_run(db: AsyncSession, run_id: str) -> PerformanceImport | None:
    return await db.scalar(
        select(PerformanceImport)
        .where(PerformanceImport.run_id == run_id)
        .order_by(PerformanceImport.created_at.desc(), PerformanceImport.id.desc())
        .limit(1)
    )


async def get_artifact_by_id(db: AsyncSession, artifact_id: str) -> PerformanceRunArtifact | None:
    return await db.scalar(
        select(PerformanceRunArtifact)
        .where(PerformanceRunArtifact.id == artifact_id)
        .options(selectinload(PerformanceRunArtifact.run))
    )
