from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.core.errors import DomainError
from app.models.enums import ProjectMemberRole
from app.modules.performance.repositories import runs as perf_repo
from app.modules.performance.services.baseline import _resolve_effective_baseline_run
from app.modules.performance.models import PerformanceRun
from app.modules.performance.services.runtime import (
    _default_summary,
    _duration_minutes,
    _new_id,
    _now_utc,
)
from app.modules.performance.services.comparisons import _to_run_read
from app.modules.performance.schemas.runs import PerformanceRunCreate, PerformanceRunPatch, PerformanceRunRead
from app.modules.projects.models import User
from app.services.access import ensure_project_role


async def create_performance_run(
    db: AsyncSession,
    *,
    payload: PerformanceRunCreate,
    current_user: User,
) -> PerformanceRunRead:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.tester)
    now = _now_utc()
    run = PerformanceRun(
        id=_new_id("prf"),
        project_id=payload.project_id,
        name=payload.name,
        service=payload.service,
        env=payload.env,
        scenario=payload.scenario,
        load_profile=payload.load_profile,
        branch=payload.branch,
        commit=payload.commit,
        build=payload.build,
        version=payload.version,
        tool=payload.tool,
        status=payload.status,
        verdict="yellow",
        load_kind=payload.load_kind,
        started_at=now,
        finished_at=now if payload.status == "completed" else None,
        duration_minutes=0,
        baseline_ref=None,
        baseline_policy="manual",
        baseline_label="Manual baseline",
        summary=_default_summary(),
        regressions=[],
        metrics_comparison=[],
        environment_snapshot={
            "region": payload.region,
            "cluster": payload.cluster,
            "namespace": payload.namespace,
            "instance_type": payload.instance_type,
            "cpu_cores": payload.cpu_cores,
            "memory_gb": payload.memory_gb,
        },
        acknowledged=False,
        created_by=current_user.id,
    )
    db.add(run)
    await db.flush()
    detailed = await perf_repo.get_run_by_id_with_details(db, run.id)
    if detailed is None:
        raise not_found("performance_run")
    return _to_run_read(detailed)


async def patch_performance_run(
    db: AsyncSession,
    *,
    run_id: str,
    payload: PerformanceRunPatch,
    current_user: User,
) -> PerformanceRunRead:
    run = await perf_repo.get_run_by_id_with_details(db, run_id)
    if run is None:
        raise not_found("performance_run")
    await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.tester)

    changes = payload.model_dump(exclude_unset=True)
    mark_as_baseline = bool(changes.pop("mark_as_baseline", False))
    for key, value in changes.items():
        setattr(run, key, value)

    if payload.status == "completed" and run.finished_at is None:
        run.finished_at = _now_utc()
        if run.started_at:
            run.duration_minutes = _duration_minutes(run.started_at, run.finished_at)

    if mark_as_baseline:
        if run.status != "completed":
            raise DomainError(
                status_code=422,
                code="performance_baseline_requires_completed_run",
                title="Validation error",
                detail="Only completed runs can be marked as baseline",
                errors={"mark_as_baseline": ["run must be completed"]},
            )
        await perf_repo.clear_tagged_baseline_markers(
            db,
            project_id=run.project_id,
            load_kind=run.load_kind,
            exclude_run_id=run.id,
        )
        run.baseline_ref = run.id
        run.baseline_policy = "tagged"
        run.baseline_label = "Tagged baseline"

    await db.flush()
    reloaded = await perf_repo.get_run_by_id_with_details(db, run.id)
    if reloaded is None:
        raise not_found("performance_run")
    run = reloaded
    latest_import = await perf_repo.get_latest_import_for_run(db, run.id)
    resolved_baseline = await _resolve_effective_baseline_run(db, run)
    return _to_run_read(
        run,
        latest_import=latest_import,
        resolve_live_baseline=True,
        resolved_baseline=resolved_baseline,
    )
