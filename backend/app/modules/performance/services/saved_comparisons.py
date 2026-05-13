from __future__ import annotations

import secrets

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError, not_found
from app.models.enums import ProjectMemberRole
from app.modules.performance.models import PerformanceComparison
from app.modules.performance.repositories import comparisons as comparisons_repo
from app.modules.performance.repositories import runs as perf_repo
from app.modules.performance.schemas.comparisons import (
    MAX_COMPARE_RUNS,
    PerformanceComparisonCreate,
    PerformanceComparisonListItemRead,
    PerformanceComparisonPatch,
    PerformanceComparisonPublicRead,
    PerformanceComparisonRead,
    PerformanceComparisonSnapshot,
    PerformanceComparisonsList,
)
from app.modules.performance.schemas.runs import PerformanceRunRead
from app.modules.performance.services.baseline import _resolve_effective_baseline_run
from app.modules.performance.services.comparisons import _to_run_read
from app.modules.projects.models import User
from app.services.access import ensure_project_role


_TOKEN_BYTES = 24


def _generate_public_token() -> str:
    return secrets.token_urlsafe(_TOKEN_BYTES)


async def _build_run_snapshot(db: AsyncSession, run_id: str) -> PerformanceRunRead:
    run = await perf_repo.get_run_by_id_with_details(db, run_id)
    if run is None:
        raise not_found("performance_run")
    latest_import = await perf_repo.get_latest_import_for_run(db, run.id)
    resolved_baseline = await _resolve_effective_baseline_run(db, run)
    return _to_run_read(
        run,
        latest_import=latest_import,
        resolve_live_baseline=True,
        resolved_baseline=resolved_baseline,
    )


def _to_read(comparison: PerformanceComparison) -> PerformanceComparisonRead:
    snapshot = PerformanceComparisonSnapshot.model_validate(comparison.snapshot or {})
    return PerformanceComparisonRead(
        id=comparison.id,
        project_id=comparison.project_id,
        name=comparison.name,
        base_run_id=comparison.base_run_id,
        compare_run_ids=list(comparison.compare_run_ids or []),
        metric_key=comparison.metric_key,
        snapshot=snapshot,
        public_token=comparison.public_token,
        created_by=comparison.created_by,
        created_at=comparison.created_at,
        updated_at=comparison.updated_at,
    )


def _to_list_item_read(comparison: PerformanceComparison) -> PerformanceComparisonListItemRead:
    compare_ids = list(comparison.compare_run_ids or [])
    return PerformanceComparisonListItemRead(
        id=comparison.id,
        project_id=comparison.project_id,
        name=comparison.name,
        base_run_id=comparison.base_run_id,
        compare_run_ids=compare_ids,
        metric_key=comparison.metric_key,
        run_count=1 + len(compare_ids),
        public_token=comparison.public_token,
        created_by=comparison.created_by,
        created_at=comparison.created_at,
        updated_at=comparison.updated_at,
    )


def _to_public_read(comparison: PerformanceComparison) -> PerformanceComparisonPublicRead:
    snapshot = PerformanceComparisonSnapshot.model_validate(comparison.snapshot or {})
    return PerformanceComparisonPublicRead(
        id=comparison.id,
        name=comparison.name,
        metric_key=comparison.metric_key,
        snapshot=snapshot,
        created_at=comparison.created_at,
    )


def _ensure_unique_run_ids(base_run_id: str, compare_run_ids: list[str]) -> None:
    seen: set[str] = set()
    if base_run_id in compare_run_ids:
        raise DomainError(
            status_code=400,
            code="invalid_comparison_runs",
            title="Invalid comparison",
            detail="base_run_id must not be repeated in compare_run_ids",
        )
    for run_id in compare_run_ids:
        if run_id in seen:
            raise DomainError(
                status_code=400,
                code="invalid_comparison_runs",
                title="Invalid comparison",
                detail="compare_run_ids must be unique",
            )
        seen.add(run_id)


async def create_saved_comparison(
    db: AsyncSession,
    *,
    payload: PerformanceComparisonCreate,
    current_user: User,
) -> PerformanceComparisonRead:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.tester)

    _ensure_unique_run_ids(payload.base_run_id, payload.compare_run_ids)

    base_run = await perf_repo.get_run_by_id_with_details(db, payload.base_run_id)
    if base_run is None or base_run.project_id != payload.project_id:
        raise not_found("performance_run")

    snapshot_runs: list[PerformanceRunRead] = [await _build_run_snapshot(db, payload.base_run_id)]
    for compare_id in payload.compare_run_ids:
        compare_run = await perf_repo.get_run_by_id_with_details(db, compare_id)
        if compare_run is None or compare_run.project_id != payload.project_id:
            raise not_found("performance_run")
        snapshot_runs.append(await _build_run_snapshot(db, compare_id))

    if len(snapshot_runs) > MAX_COMPARE_RUNS:
        raise DomainError(
            status_code=400,
            code="too_many_comparison_runs",
            title="Too many runs",
            detail=f"Comparison supports at most {MAX_COMPARE_RUNS} runs total",
        )

    snapshot = PerformanceComparisonSnapshot(metric_key=payload.metric_key, runs=snapshot_runs)

    comparison = PerformanceComparison(
        project_id=payload.project_id,
        name=(payload.name or None),
        base_run_id=payload.base_run_id,
        compare_run_ids=list(payload.compare_run_ids),
        metric_key=payload.metric_key,
        snapshot=snapshot.model_dump(mode="json"),
        public_token=_generate_public_token() if payload.public else None,
        created_by=current_user.id,
    )
    saved = await comparisons_repo.insert_comparison(db, comparison)
    await db.commit()
    await db.refresh(saved)
    return _to_read(saved)


async def list_saved_comparisons(
    db: AsyncSession,
    *,
    project_id: str,
    search: str | None,
    visibility: str | None,
    page: int,
    page_size: int,
    current_user: User,
) -> PerformanceComparisonsList:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    result = await comparisons_repo.list_comparisons_by_project(
        db,
        project_id=project_id,
        search=search,
        visibility=visibility,
        page=page,
        page_size=page_size,
    )
    items = [_to_list_item_read(item) for item in result.items]
    return PerformanceComparisonsList(
        items=items,
        page=result.page,
        page_size=result.page_size,
        has_next=result.has_next,
    )


async def get_saved_comparison(
    db: AsyncSession,
    *,
    comparison_id: str,
    current_user: User,
) -> PerformanceComparisonRead:
    comparison = await comparisons_repo.get_comparison_by_id(db, comparison_id)
    if comparison is None:
        raise not_found("performance_comparison")
    await ensure_project_role(db, current_user, comparison.project_id, ProjectMemberRole.viewer)
    return _to_read(comparison)


async def patch_saved_comparison(
    db: AsyncSession,
    *,
    comparison_id: str,
    payload: PerformanceComparisonPatch,
    current_user: User,
) -> PerformanceComparisonRead:
    comparison = await comparisons_repo.get_comparison_by_id(db, comparison_id)
    if comparison is None:
        raise not_found("performance_comparison")
    await ensure_project_role(db, current_user, comparison.project_id, ProjectMemberRole.tester)

    if payload.name is not None:
        comparison.name = payload.name.strip() or None
    if payload.public is not None:
        if payload.public and not comparison.public_token:
            comparison.public_token = _generate_public_token()
        elif not payload.public:
            comparison.public_token = None

    await db.flush()
    await db.commit()
    await db.refresh(comparison)
    return _to_read(comparison)


async def delete_saved_comparison(
    db: AsyncSession,
    *,
    comparison_id: str,
    current_user: User,
) -> None:
    comparison = await comparisons_repo.get_comparison_by_id(db, comparison_id)
    if comparison is None:
        raise not_found("performance_comparison")
    await ensure_project_role(db, current_user, comparison.project_id, ProjectMemberRole.tester)
    await comparisons_repo.delete_comparison(db, comparison)
    await db.commit()


async def get_public_comparison(
    db: AsyncSession,
    *,
    token: str,
) -> PerformanceComparisonPublicRead:
    comparison = await comparisons_repo.get_comparison_by_public_token(db, token)
    if comparison is None or not comparison.public_token:
        raise not_found("performance_comparison")
    return _to_public_read(comparison)
