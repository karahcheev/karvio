from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.models.enums import ProjectMemberRole
from app.modules.performance.repositories import runs as perf_repo
from app.modules.performance.services.baseline import _resolve_effective_baseline_run
from app.modules.performance.services.comparisons import _to_run_list_item_read, _to_run_read
from app.modules.performance.schemas.runs import PerformanceRunRead, PerformanceRunsList
from app.modules.projects.models import User
from app.repositories import common as common_repo
from app.services.access import ensure_project_role


async def list_performance_runs(
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
    sort_by: perf_repo.PerformanceRunSortField,
    sort_order: common_repo.SortDirection,
    current_user: User,
) -> PerformanceRunsList:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    result = await perf_repo.list_runs_by_project(
        db,
        project_id=project_id,
        status_filters=status_filters,
        verdict_filters=verdict_filters,
        load_kind_filters=load_kind_filters,
        env_filters=env_filters,
        search=search,
        include_archived=include_archived,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_direction=sort_order,
    )
    items = [_to_run_list_item_read(run) for run in result.items]
    return PerformanceRunsList(items=items, page=result.page, page_size=result.page_size, has_next=result.has_next)


async def get_performance_run(db: AsyncSession, *, run_id: str, current_user: User) -> PerformanceRunRead:
    run = await perf_repo.get_run_by_id_with_details(db, run_id)
    if run is None:
        raise not_found("performance_run")
    await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.viewer)
    latest_import = await perf_repo.get_latest_import_for_run(db, run.id)
    resolved_baseline = await _resolve_effective_baseline_run(db, run)
    return _to_run_read(
        run,
        latest_import=latest_import,
        resolve_live_baseline=True,
        resolved_baseline=resolved_baseline,
    )
