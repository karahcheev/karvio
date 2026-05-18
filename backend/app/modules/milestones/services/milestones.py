from __future__ import annotations

from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.models.enums import MilestoneStatus, ProjectMemberRole, RunItemStatus, TestRunStatus
from app.modules.milestones.models import Milestone
from app.modules.milestones.repositories import milestones as milestone_repo
from app.modules.milestones.schemas.milestone import (
    MilestoneCreate,
    MilestonePatch,
    MilestoneRead,
    MilestonesList,
    MilestoneSummaryRead,
)
from app.modules.projects.models import User
from app.modules.test_runs.repositories import run_items as run_item_repo
from app.services.access import ensure_project_role


async def _get_milestone_or_404(db: AsyncSession, milestone_id: str) -> Milestone:
    milestone = await milestone_repo.get_by_id(db, milestone_id)
    if not milestone:
        raise not_found("milestone")
    return milestone


async def ensure_milestone_belongs_to_project(
    db: AsyncSession,
    *,
    project_id: str,
    milestone_id: str | None,
) -> str | None:
    if milestone_id is None:
        return None
    normalized = milestone_id.strip()
    if not normalized:
        return None
    milestone = await milestone_repo.get_by_id(db, normalized)
    if milestone is None or milestone.project_id != project_id:
        raise not_found("milestone")
    return normalized


async def list_milestones(
    db: AsyncSession,
    *,
    project_id: str,
    statuses: list[MilestoneStatus] | None,
    search: str | None,
    page: int,
    page_size: int,
    current_user: User,
) -> MilestonesList:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    result = await milestone_repo.list_by_project(
        db,
        project_id=project_id,
        statuses=statuses,
        search=search,
        page=page,
        page_size=page_size,
    )
    return MilestonesList(
        items=[MilestoneRead.model_validate(item) for item in result.items],
        page=result.page,
        page_size=result.page_size,
        has_next=result.has_next,
        total=result.total or 0,
    )


async def create_milestone(db: AsyncSession, *, payload: MilestoneCreate, current_user: User) -> MilestoneRead:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.tester)
    milestone = Milestone(
        project_id=payload.project_id,
        name=payload.name,
        description=payload.description,
        status=payload.status,
        start_date=payload.start_date,
        target_date=payload.target_date,
        completed_at=payload.completed_at,
        owner_id=payload.owner_id,
        release_label=payload.release_label,
    )
    db.add(milestone)
    await db.flush()
    await db.refresh(milestone)
    return MilestoneRead.model_validate(milestone)


async def get_milestone(db: AsyncSession, *, milestone_id: str, current_user: User) -> MilestoneRead:
    milestone = await _get_milestone_or_404(db, milestone_id)
    await ensure_project_role(db, current_user, milestone.project_id, ProjectMemberRole.viewer)
    return MilestoneRead.model_validate(milestone)


async def patch_milestone(
    db: AsyncSession,
    *,
    milestone_id: str,
    payload: MilestonePatch,
    current_user: User,
) -> MilestoneRead:
    milestone = await _get_milestone_or_404(db, milestone_id)
    await ensure_project_role(db, current_user, milestone.project_id, ProjectMemberRole.tester)

    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(milestone, key, value)

    await db.flush()
    await db.refresh(milestone)
    return MilestoneRead.model_validate(milestone)


async def delete_milestone(db: AsyncSession, *, milestone_id: str, current_user: User) -> None:
    milestone = await _get_milestone_or_404(db, milestone_id)
    await ensure_project_role(db, current_user, milestone.project_id, ProjectMemberRole.lead)
    await db.delete(milestone)


async def get_milestone_summary(
    db: AsyncSession,
    *,
    milestone_id: str,
    current_user: User,
) -> MilestoneSummaryRead:
    milestone = await _get_milestone_or_404(db, milestone_id)
    await ensure_project_role(db, current_user, milestone.project_id, ProjectMemberRole.viewer)

    plans_total = await milestone_repo.count_plans_for_milestone(db, milestone.id)
    planned_cases_total = await milestone_repo.count_planned_cases_for_milestone(db, milestone.id)
    runs_by_status = await milestone_repo.count_runs_by_status_for_milestone(db, milestone.id)

    run_ids = await milestone_repo.list_run_ids_for_milestone(db, milestone.id)
    rows = await run_item_repo.count_by_status_for_runs(db, run_ids)

    counters: dict[str, int] = {
        RunItemStatus.untested.value: 0,
        RunItemStatus.passed.value: 0,
        RunItemStatus.error.value: 0,
        RunItemStatus.failure.value: 0,
        RunItemStatus.blocked.value: 0,
        RunItemStatus.skipped.value: 0,
        RunItemStatus.xfailed.value: 0,
        RunItemStatus.xpassed.value: 0,
    }
    total_tests = 0
    for _, status, count in rows:
        key = status.value if hasattr(status, "value") else str(status)
        counters[key] = counters.get(key, 0) + count
        total_tests += count

    decided = (
        counters[RunItemStatus.passed.value]
        + counters[RunItemStatus.error.value]
        + counters[RunItemStatus.failure.value]
        + counters[RunItemStatus.xfailed.value]
        + counters[RunItemStatus.xpassed.value]
    )
    pass_rate = round((counters[RunItemStatus.passed.value] / decided) * 100, 2) if decided else 0.0

    overdue = (
        milestone.target_date is not None
        and milestone.target_date < date.today()
        and milestone.status not in {MilestoneStatus.completed, MilestoneStatus.archived}
    )

    return MilestoneSummaryRead(
        milestone_id=milestone.id,
        plans_total=plans_total,
        planned_cases_total=planned_cases_total,
        runs_total=len(run_ids),
        planned_runs=runs_by_status.get(TestRunStatus.not_started, 0),
        active_runs=runs_by_status.get(TestRunStatus.in_progress, 0),
        completed_runs=runs_by_status.get(TestRunStatus.completed, 0),
        archived_runs=runs_by_status.get(TestRunStatus.archived, 0),
        total_tests=total_tests,
        untested=counters[RunItemStatus.untested.value],
        passed=counters[RunItemStatus.passed.value],
        error=counters[RunItemStatus.error.value],
        failure=counters[RunItemStatus.failure.value],
        blocked=counters[RunItemStatus.blocked.value],
        skipped=counters[RunItemStatus.skipped.value],
        xfailed=counters[RunItemStatus.xfailed.value],
        xpassed=counters[RunItemStatus.xpassed.value],
        pass_rate=pass_rate,
        overdue=overdue,
    )
