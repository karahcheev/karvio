from __future__ import annotations

from datetime import date, datetime, time, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.core.errors import DomainError
from app.models.enums import ProjectMemberRole, TestRunStatus
from app.modules.environments.repositories import environments as environment_repo
from app.modules.milestones.repositories import milestones as milestone_repo
from app.modules.milestones.services import milestones as milestones_service
from app.modules.projects.models import User
from app.modules.test_runs.models import TestRun
from app.repositories import common as common_repo
from app.modules.test_runs.repositories import run_items as run_item_repo
from app.modules.test_runs.repositories import runs as test_run_repo
from app.modules.test_runs.schemas.runs import (
    RunSummarySnapshot,
    TestRunCreate,
    TestRunPatch,
    TestRunRead,
    TestRunsList,
)
from app.services.access import ensure_project_role
from app.core import application_events
from app.modules.reports.services import reports as reports_service


async def _get_test_run_or_404(db: AsyncSession, test_run_id: str) -> TestRun:
    run = await test_run_repo.get_by_id(db, test_run_id)
    if not run:
        raise not_found("test_run")
    return run


def _read_environment_name(run: TestRun) -> str | None:
    snapshot = run.environment_snapshot if isinstance(run.environment_snapshot, dict) else {}
    environment_block = snapshot.get("environment", {})
    if isinstance(environment_block, dict):
        from_snapshot = environment_block.get("name")
        if isinstance(from_snapshot, str) and from_snapshot.strip():
            return from_snapshot.strip()
    return run.environment_name_snapshot


def _to_test_run_read(
    run: TestRun,
    *,
    summary: RunSummarySnapshot | None = None,
    milestone_name_by_id: dict[str, str] | None = None,
) -> TestRunRead:
    return TestRunRead.model_validate(run).model_copy(
        update={
            "summary": summary,
            "environment_name": _read_environment_name(run),
            "milestone_name": (
                milestone_name_by_id.get(run.milestone_id, run.milestone_id)
                if (milestone_name_by_id and run.milestone_id)
                else None
            ),
        }
    )


async def _resolve_environment_binding(
    db: AsyncSession,
    *,
    project_id: str,
    environment_id: str,
) -> tuple[str, str, int, dict, str]:
    normalized_environment_id = environment_id.strip()
    if not normalized_environment_id:
        raise DomainError(
            status_code=422,
            code="invalid_environment",
            title="Invalid environment",
            detail="environment_id is required",
        )
    environment = await environment_repo.get_by_id(db, normalized_environment_id)
    if environment is None or environment.project_id != project_id or environment.archived_at is not None:
        raise DomainError(
            status_code=422,
            code="invalid_environment",
            title="Invalid environment",
            detail="Selected environment is not available in this project",
        )
    revision = await environment_repo.get_current_revision(db, environment.id)
    if revision is None:
        raise DomainError(
            status_code=409,
            code="environment_revision_not_found",
            title="Environment revision not found",
            detail="Selected environment has no current revision",
        )
    snapshot = revision.full_snapshot if isinstance(revision.full_snapshot, dict) else {}
    environment_name = (
        (
            snapshot.get("environment", {}).get("name")
            if isinstance(snapshot.get("environment"), dict)
            else None
        )
        or environment.name
    )
    return environment.id, revision.id, revision.revision_number, snapshot, str(environment_name)


def _assign_count_to_summary(summary: RunSummarySnapshot, status_value: str, count: int) -> None:
    if status_value == "passed":
        summary.passed = count
    elif status_value == "error":
        summary.error = count
    elif status_value == "failure":
        summary.failure = count
    elif status_value == "blocked":
        summary.blocked = count
    elif status_value == "in_progress":
        summary.in_progress = count
    elif status_value == "skipped":
        summary.skipped = count
    elif status_value == "xfailed":
        summary.xfailed = count
    elif status_value == "xpassed":
        summary.xpassed = count


async def list_test_runs(
    db: AsyncSession,
    *,
    project_id: str,
    status_filters: list[TestRunStatus] | None,
    environment_ids: list[str] | None,
    milestone_ids: list[str] | None,
    search: str | None,
    created_by: str | None,
    created_from: date | None,
    created_to: date | None,
    page: int,
    page_size: int,
    sort_by: test_run_repo.TestRunSortField,
    sort_order: common_repo.SortDirection,
    current_user: User,
) -> TestRunsList:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    created_from_dt = (
        datetime.combine(created_from, time.min, tzinfo=timezone.utc) if created_from is not None else None
    )
    created_to_dt = datetime.combine(created_to, time.max, tzinfo=timezone.utc) if created_to is not None else None
    result = await test_run_repo.list_by_project(
        db,
        project_id=project_id,
        status_filters=status_filters,
        environment_ids=environment_ids,
        milestone_ids=milestone_ids,
        search=search,
        created_by=created_by,
        created_from=created_from_dt,
        created_to=created_to_dt,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_direction=sort_order,
    )
    run_ids = [item.id for item in result.items]
    run_milestone_ids = [item.milestone_id for item in result.items if item.milestone_id]
    milestone_name_by_id = await milestone_repo.map_names_by_ids(db, run_milestone_ids)
    counts_rows = await run_item_repo.count_by_status_for_runs(db, run_ids)
    summary_by_run_id: dict[str, RunSummarySnapshot] = {}
    for run_id in run_ids:
        summary_by_run_id[run_id] = RunSummarySnapshot()

    for run_id, status, count in counts_rows:
        summary = summary_by_run_id.setdefault(run_id, RunSummarySnapshot())
        status_value = status.value if hasattr(status, "value") else str(status)
        _assign_count_to_summary(summary, status_value, count)
        summary.total += count

    for summary in summary_by_run_id.values():
        decided = summary.passed + summary.error + summary.failure + summary.xfailed + summary.xpassed
        summary.pass_rate = round((summary.passed / decided) * 100, 2) if decided else 0.0

    return TestRunsList(
        items=[
            _to_test_run_read(
                item,
                summary=summary_by_run_id.get(item.id),
                milestone_name_by_id=milestone_name_by_id,
            )
            for item in result.items
        ],
        page=result.page,
        page_size=result.page_size,
        has_next=result.has_next,
        total=result.total or 0,
    )

async def create_test_run(db: AsyncSession, *, payload: TestRunCreate, current_user: User) -> TestRunRead:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.tester)
    environment_binding: tuple[str, str, int, dict, str] | None = None
    if payload.environment_id is not None and payload.environment_id.strip():
        environment_binding = await _resolve_environment_binding(
            db,
            project_id=payload.project_id,
            environment_id=payload.environment_id,
        )
    run_payload = payload.model_dump()
    run_payload.pop("environment_id", None)
    run_payload["milestone_id"] = await milestones_service.ensure_milestone_belongs_to_project(
        db,
        project_id=payload.project_id,
        milestone_id=payload.milestone_id,
    )
    run = TestRun(**run_payload, created_by=current_user.id)
    if environment_binding is not None:
        (
            environment_id,
            environment_revision_id,
            environment_revision_number,
            environment_snapshot,
            environment_name_snapshot,
        ) = environment_binding
        run.environment_id = environment_id
        run.environment_revision_id = environment_revision_id
        run.environment_revision_number = environment_revision_number
        run.environment_snapshot = environment_snapshot
        run.environment_name_snapshot = environment_name_snapshot
    db.add(run)
    await application_events.publish(db, application_events.TestRunCreated(entity=run))
    await db.flush()
    await db.refresh(run)
    return _to_test_run_read(run)


async def get_test_run(db: AsyncSession, *, test_run_id: str, current_user: User) -> TestRunRead:
    run = await _get_test_run_or_404(db, test_run_id)
    await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.viewer)
    summary, status_breakdown = await reports_service.build_run_summary_and_breakdown(db, test_run_id)
    milestone_name_by_id = await milestone_repo.map_names_by_ids(db, [run.milestone_id] if run.milestone_id else [])
    return _to_test_run_read(run, summary=summary, milestone_name_by_id=milestone_name_by_id).model_copy(
        update={"summary": summary, "status_breakdown": status_breakdown},
    )


async def _apply_status_transition(
    db: AsyncSession,
    run: TestRun,
    target: TestRunStatus,
    started_at: datetime | None,
    completed_at: datetime | None,
    archived_at: datetime | None,
    current_user: User,
) -> str:
    """Apply status transition with validation. Returns audit action."""
    if target == TestRunStatus.in_progress:
        await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.tester)
        if run.status != TestRunStatus.not_started:
            raise DomainError(
                status_code=409,
                code="invalid_status_transition",
                title="Invalid transition",
                detail="in_progress is allowed only from not_started",
            )
        run.status = TestRunStatus.in_progress
        run.started_at = started_at or datetime.now(timezone.utc)
        return "test_run.start"
    if target == TestRunStatus.completed:
        await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.tester)
        if run.status != TestRunStatus.in_progress:
            raise DomainError(
                status_code=409,
                code="invalid_status_transition",
                title="Invalid transition",
                detail="completed is allowed only from in_progress",
            )
        in_progress_count = await test_run_repo.count_in_progress_items(db, run.id)
        if in_progress_count:
            raise DomainError(
                status_code=409,
                code="invalid_status_transition",
                title="Invalid transition",
                detail="Cannot complete run while at least one RunItem is in_progress",
            )
        run.status = TestRunStatus.completed
        run.completed_at = completed_at or datetime.now(timezone.utc)
        return "test_run.complete"
    if target == TestRunStatus.archived:
        await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.lead)
        if run.status != TestRunStatus.completed:
            raise DomainError(
                status_code=409,
                code="invalid_status_transition",
                title="Invalid transition",
                detail="archived is allowed only from completed",
            )
        run.status = TestRunStatus.archived
        run.archived_at = archived_at or datetime.now(timezone.utc)
        return "test_run.archive"
    raise DomainError(
        status_code=400,
        code="invalid_status",
        title="Invalid status",
        detail=f"Cannot transition to {target.value}",
    )


async def patch_test_run(
    db: AsyncSession,
    *,
    test_run_id: str,
    payload: TestRunPatch,
    current_user: User,
) -> TestRunRead:
    run = await _get_test_run_or_404(db, test_run_id)
    await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.tester)
    before_state = application_events.snapshot_entity(run)

    changes = payload.model_dump(exclude_unset=True)
    status_change = changes.pop("status", None)
    started_at = changes.pop("started_at", None)
    completed_at = changes.pop("completed_at", None)
    archived_at = changes.pop("archived_at", None)

    for key, value in changes.items():
        if key == "environment_id":
            if value is None:
                raise DomainError(
                    status_code=422,
                    code="invalid_environment",
                    title="Invalid environment",
                    detail="environment_id must not be null",
                )
            (
                environment_id,
                environment_revision_id,
                environment_revision_number,
                environment_snapshot,
                environment_name_snapshot,
            ) = await _resolve_environment_binding(
                db,
                project_id=run.project_id,
                environment_id=value,
            )
            run.environment_id = environment_id
            run.environment_revision_id = environment_revision_id
            run.environment_revision_number = environment_revision_number
            run.environment_snapshot = environment_snapshot
            run.environment_name_snapshot = environment_name_snapshot
            continue
        if key == "milestone_id":
            run.milestone_id = await milestones_service.ensure_milestone_belongs_to_project(
                db,
                project_id=run.project_id,
                milestone_id=value,
            )
            continue
        setattr(run, key, value)

    if status_change is not None:
        audit_action = await _apply_status_transition(
            db,
            run,
            target=status_change,
            started_at=started_at,
            completed_at=completed_at,
            archived_at=archived_at,
            current_user=current_user,
        )
        await application_events.publish(
            db,
            application_events.TestRunUpdated(
                entity=run,
                before_state=before_state,
                audit_action=audit_action,
                queue_report_notifications=status_change == TestRunStatus.completed,
            ),
        )
    else:
        if started_at is not None:
            run.started_at = started_at
        if completed_at is not None:
            run.completed_at = completed_at
        if archived_at is not None:
            run.archived_at = archived_at
        await application_events.publish(
            db,
            application_events.TestRunUpdated(
                entity=run,
                before_state=before_state,
                audit_action="test_run.update",
                queue_report_notifications=False,
            ),
        )

    await db.flush()
    await db.refresh(run)
    summary, status_breakdown = await reports_service.build_run_summary_and_breakdown(db, test_run_id)
    return _to_test_run_read(run, summary=summary).model_copy(
        update={"summary": summary, "status_breakdown": status_breakdown},
    )


async def delete_test_run(db: AsyncSession, *, test_run_id: str, current_user: User) -> None:
    run = await _get_test_run_or_404(db, test_run_id)
    await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.lead)
    before_state = application_events.snapshot_entity(run)
    await application_events.publish(
        db,
        application_events.TestRunDeleted(
            resource_id=run.id,
            before_state=before_state,
            tenant_id=run.project_id,
        ),
    )
    await db.delete(run)
