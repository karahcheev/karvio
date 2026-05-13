"""Reports facade: access control and module composition."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from enum import Enum
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.models.enums import ProjectMemberRole, RunItemStatus
from app.modules.projects.models import User
from app.modules.test_runs.repositories import run_items as run_item_repo
from app.modules.test_runs.repositories import runs as test_run_repo
from app.services.access import ensure_project_role
from app.modules.reports.adapters.export_json import serialize_report_json
from app.modules.reports.adapters.export_pdf import serialize_report_pdf
from app.modules.reports.adapters.export_xml import serialize_report_xml
from app.modules.reports.adapters.export_overview_pdf import serialize_overview_pdf
from app.modules.reports.adapters.export_overview_xml import serialize_overview_xml
from app.modules.reports.repositories.queries import (
    fetch_assignee_counts_by_project_run_window,
    fetch_project_runs,
    fetch_status_by_project_run_window,
    fetch_users_by_ids,
)
from app.modules.reports.schemas.overview import ProjectOverviewRead
from app.modules.reports.services.summary import build_project_overview_payload, build_run_report_payload


class RunReportExportFormat(str, Enum):
    json = "json"
    pdf = "pdf"
    xml = "xml"


class OverviewExportFormat(str, Enum):
    json = "json"
    pdf = "pdf"
    xml = "xml"


@dataclass(frozen=True, slots=True)
class RunReportExportResult:
    content: bytes
    media_type: str
    filename: str


@dataclass(frozen=True, slots=True)
class OverviewExportResult:
    content: bytes
    media_type: str
    filename: str


def _summary_tuple_from_count_rows(
    rows: list[tuple[RunItemStatus, int]],
) -> tuple:
    from app.modules.test_runs.schemas.runs import RunSummarySnapshot, StatusBreakdown, StatusBreakdownItem

    mapping = {status.value: count for status, count in rows}
    total = sum(mapping.values())
    passed = mapping.get(RunItemStatus.passed.value, 0)
    error = mapping.get(RunItemStatus.error.value, 0)
    failure = mapping.get(RunItemStatus.failure.value, 0)
    blocked = mapping.get(RunItemStatus.blocked.value, 0)
    in_progress = mapping.get(RunItemStatus.in_progress.value, 0)
    skipped = mapping.get(RunItemStatus.skipped.value, 0)
    xfailed = mapping.get(RunItemStatus.xfailed.value, 0)
    xpassed = mapping.get(RunItemStatus.xpassed.value, 0)
    decided = passed + error + failure + xfailed + xpassed
    pass_rate = round((passed / decided) * 100, 2) if decided else 0.0
    summary = RunSummarySnapshot(
        total=total,
        passed=passed,
        error=error,
        failure=failure,
        blocked=blocked,
        in_progress=in_progress,
        skipped=skipped,
        xfailed=xfailed,
        xpassed=xpassed,
        pass_rate=pass_rate,
    )
    status_breakdown = StatusBreakdown(
        items=[StatusBreakdownItem(status=status.value, count=count) for status, count in rows],
    )
    return summary, status_breakdown


async def build_run_summary_and_breakdown(db: AsyncSession, test_run_id: str) -> tuple:
    """Build summary and status_breakdown for a test run. No access check."""
    rows = await run_item_repo.count_by_status(db, test_run_id)
    return _summary_tuple_from_count_rows(rows)


async def _get_accessible_run(db: AsyncSession, *, test_run_id: str, current_user: User):
    run = await test_run_repo.get_by_id_with_users(db, test_run_id)
    if not run:
        raise not_found("test_run")
    await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.viewer)
    return run


def _serialize_report(payload: dict, *, report_format: RunReportExportFormat) -> tuple[bytes, str, str]:
    if report_format == RunReportExportFormat.json:
        return serialize_report_json(payload)
    if report_format == RunReportExportFormat.xml:
        return serialize_report_xml(payload)
    return serialize_report_pdf(payload)


async def export_run_report(
    db: AsyncSession,
    *,
    test_run_id: str,
    report_format: RunReportExportFormat,
    current_user: User,
) -> RunReportExportResult:
    run = await _get_accessible_run(db, test_run_id=test_run_id, current_user=current_user)
    payload = await build_run_report_payload(db, run=run)
    content, media_type, extension = _serialize_report(payload, report_format=report_format)
    filename = f"test-run-{run.id}-report.{extension}"
    return RunReportExportResult(content=content, media_type=media_type, filename=filename)


async def export_project_overview(
    db: AsyncSession,
    *,
    project_id: str,
    created_from: date | None,
    created_to: date | None,
    milestone_ids: list[str] | None = None,
    top_n: int = 8,
    granularity: Literal["day", "week", "month"] | None = None,
    export_format: OverviewExportFormat,
    current_user: User,
) -> OverviewExportResult:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    created_from_dt = datetime.combine(created_from, time.min, tzinfo=timezone.utc) if created_from else None
    created_to_dt = datetime.combine(created_to, time.max, tzinfo=timezone.utc) if created_to else None

    runs = await fetch_project_runs(
        db,
        project_id=project_id,
        created_from=created_from_dt,
        created_to=created_to_dt,
        milestone_ids=milestone_ids,
    )
    status_by_run = await fetch_status_by_project_run_window(
        db,
        project_id=project_id,
        created_from=created_from_dt,
        created_to=created_to_dt,
        milestone_ids=milestone_ids,
    )
    assignee_rows = await fetch_assignee_counts_by_project_run_window(
        db,
        project_id=project_id,
        created_from=created_from_dt,
        created_to=created_to_dt,
        milestone_ids=milestone_ids,
    )
    assignee_id_values = [assignee_id for assignee_id, _ in assignee_rows if assignee_id]
    user_names_by_id = await fetch_users_by_ids(db, set(assignee_id_values)) if assignee_id_values else {}
    resolved_granularity: Literal["day", "week", "month"] = granularity or "day"

    payload = build_project_overview_payload(
        project_id=project_id,
        created_from=created_from,
        created_to=created_to,
        top_n=top_n,
        granularity=resolved_granularity,
        runs=runs,
        status_by_run=status_by_run,
        assignee_rows=assignee_rows,
        user_names_by_id=user_names_by_id,
    )
    payload["generated_at"] = datetime.now(timezone.utc).isoformat()

    if export_format == OverviewExportFormat.xml:
        content, media_type, extension = serialize_overview_xml(payload)
    elif export_format == OverviewExportFormat.pdf:
        content, media_type, extension = serialize_overview_pdf(payload)
    else:
        import json
        raw = json.dumps(payload, indent=2, default=str).encode("utf-8")
        content, media_type, extension = raw, "application/json", "json"

    date_suffix = f"{created_from.isoformat() if created_from else 'all'}_{created_to.isoformat() if created_to else 'now'}"
    filename = f"project-{project_id}-overview-{date_suffix}.{extension}"
    return OverviewExportResult(content=content, media_type=media_type, filename=filename)


async def project_overview(
    db: AsyncSession,
    *,
    project_id: str,
    created_from: date | None,
    created_to: date | None,
    milestone_ids: list[str] | None = None,
    top_n: int = 8,
    granularity: Literal["day", "week", "month"] | None = None,
    current_user: User,
) -> ProjectOverviewRead:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    created_from_dt = datetime.combine(created_from, time.min, tzinfo=timezone.utc) if created_from else None
    created_to_dt = datetime.combine(created_to, time.max, tzinfo=timezone.utc) if created_to else None

    runs = await fetch_project_runs(
        db,
        project_id=project_id,
        created_from=created_from_dt,
        created_to=created_to_dt,
        milestone_ids=milestone_ids,
    )

    status_by_run = await fetch_status_by_project_run_window(
        db,
        project_id=project_id,
        created_from=created_from_dt,
        created_to=created_to_dt,
        milestone_ids=milestone_ids,
    )
    assignee_rows = await fetch_assignee_counts_by_project_run_window(
        db,
        project_id=project_id,
        created_from=created_from_dt,
        created_to=created_to_dt,
        milestone_ids=milestone_ids,
    )

    assignee_id_values = [assignee_id for assignee_id, _ in assignee_rows if assignee_id]
    user_names_by_id = await fetch_users_by_ids(db, set(assignee_id_values)) if assignee_id_values else {}
    resolved_granularity: Literal["day", "week", "month"] = granularity or "day"

    payload = build_project_overview_payload(
        project_id=project_id,
        created_from=created_from,
        created_to=created_to,
        top_n=top_n,
        granularity=resolved_granularity,
        runs=runs,
        status_by_run=status_by_run,
        assignee_rows=assignee_rows,
        user_names_by_id=user_names_by_id,
    )
    return ProjectOverviewRead.model_validate(payload)
