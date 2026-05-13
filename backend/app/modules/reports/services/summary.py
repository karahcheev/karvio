"""Payload building for reports."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.domain_strings import LABEL_UNKNOWN_USER
from app.models.enums import RunItemStatus
from app.modules.reports.repositories.queries import ProjectOverviewRunRow, fetch_run_items_with_cases
from app.modules.test_runs.models import TestRun


RUN_STATUS_ORDER = [
    RunItemStatus.untested,
    RunItemStatus.in_progress,
    RunItemStatus.passed,
    RunItemStatus.error,
    RunItemStatus.failure,
    RunItemStatus.blocked,
    RunItemStatus.skipped,
    RunItemStatus.xfailed,
    RunItemStatus.xpassed,
]
OVERVIEW_GRANULARITY = Literal["day", "week", "month"]


def _isoformat(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _user_display_name(user) -> str | None:
    """Returns username for display; None if user is None."""
    return user.username if user else None


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _bucket_start(value: datetime, granularity: OVERVIEW_GRANULARITY) -> datetime:
    dt = _to_utc(value)
    if granularity == "day":
        return dt.replace(hour=0, minute=0, second=0, microsecond=0)
    if granularity == "week":
        day_start = dt.replace(hour=0, minute=0, second=0, microsecond=0)
        return day_start - timedelta(days=day_start.weekday())
    return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _bucket_label(value: datetime, granularity: OVERVIEW_GRANULARITY) -> str:
    if granularity == "day":
        return value.date().isoformat()
    if granularity == "week":
        end = value + timedelta(days=6)
        return f"{value.date().isoformat()} - {end.date().isoformat()}"
    return value.strftime("%Y-%m")


def _empty_overview_bucket() -> dict[str, int]:
    return {
        "runs": 0,
        "passed": 0,
        "error": 0,
        "failure": 0,
        "blocked": 0,
        "skipped": 0,
        "untested": 0,
        "in_progress": 0,
        "xfailed": 0,
        "xpassed": 0,
    }


@dataclass
class _OverviewRunAggregation:
    total: int = 0
    passed: int = 0
    error: int = 0
    failure: int = 0
    blocked: int = 0
    skipped: int = 0
    untested: int = 0
    in_progress: int = 0
    xfailed: int = 0
    xpassed: int = 0
    pass_rate_trend: list[dict] = field(default_factory=list)
    failures_by_run: list[dict] = field(default_factory=list)
    bucket_totals: dict[datetime, dict[str, int]] = field(default_factory=dict)
    runs_by_environment_counts: dict[str, int] = field(default_factory=dict)
    runs_by_build_counts: dict[str, int] = field(default_factory=dict)


def _aggregate_overview_runs(
    runs: list[ProjectOverviewRunRow],
    status_by_run: dict[str, dict[str, int]],
    granularity: OVERVIEW_GRANULARITY,
) -> _OverviewRunAggregation:
    from app.models.enums import RunItemStatus

    agg = _OverviewRunAggregation()
    runs_by_created_asc = sorted(runs, key=lambda item: item.created_at)
    for run in runs_by_created_asc:
        counts = status_by_run.get(run.id, {})
        run_total = sum(counts.values())
        run_passed = counts.get(RunItemStatus.passed.value, 0)
        run_error = counts.get(RunItemStatus.error.value, 0)
        run_failure = counts.get(RunItemStatus.failure.value, 0)
        run_blocked = counts.get(RunItemStatus.blocked.value, 0)
        run_skipped = counts.get(RunItemStatus.skipped.value, 0)
        run_untested = counts.get(RunItemStatus.untested.value, 0)
        run_in_progress = counts.get(RunItemStatus.in_progress.value, 0)
        run_xfailed = counts.get(RunItemStatus.xfailed.value, 0)
        run_xpassed = counts.get(RunItemStatus.xpassed.value, 0)
        run_decided = run_passed + run_error + run_failure + run_xfailed + run_xpassed
        run_pass_rate = round((run_passed / run_decided) * 100, 2) if run_decided else 0.0

        agg.total += run_total
        agg.passed += run_passed
        agg.error += run_error
        agg.failure += run_failure
        agg.blocked += run_blocked
        agg.skipped += run_skipped
        agg.untested += run_untested
        agg.in_progress += run_in_progress
        agg.xfailed += run_xfailed
        agg.xpassed += run_xpassed

        agg.pass_rate_trend.append(
            {
                "run_id": run.id,
                "name": run.name,
                "build": run.build,
                "created_at": run.created_at.isoformat(),
                "pass_rate": run_pass_rate,
                "error": run_error,
                "failure": run_failure,
            }
        )
        agg.failures_by_run.append(
            {
                "run_id": run.id,
                "category": run.build or run.name,
                "error": run_error,
                "failure": run_failure,
            }
        )
        bucket_start = _bucket_start(run.created_at, granularity)
        bucket = agg.bucket_totals.setdefault(bucket_start, _empty_overview_bucket())
        bucket["runs"] += 1
        bucket["passed"] += run_passed
        bucket["error"] += run_error
        bucket["failure"] += run_failure
        bucket["blocked"] += run_blocked
        bucket["skipped"] += run_skipped
        bucket["untested"] += run_untested
        bucket["in_progress"] += run_in_progress
        bucket["xfailed"] += run_xfailed
        bucket["xpassed"] += run_xpassed

        environment_name = (run.environment_name_snapshot or "Unknown").strip() or "Unknown"
        if run.environment_revision_number is not None:
            environment_name = f"{environment_name} · r{run.environment_revision_number}"
        agg.runs_by_environment_counts[environment_name] = agg.runs_by_environment_counts.get(environment_name, 0) + 1
        build_name = (run.build or "No build").strip() or "No build"
        agg.runs_by_build_counts[build_name] = agg.runs_by_build_counts.get(build_name, 0) + 1

    return agg


def _build_overview_trend_series(
    bucket_totals: dict[datetime, dict[str, int]],
    granularity: OVERVIEW_GRANULARITY,
) -> tuple[list[dict], list[dict]]:
    execution_trend: list[dict] = []
    status_trend: list[dict] = []
    for bucket_start in sorted(bucket_totals):
        bucket = bucket_totals[bucket_start]
        bucket_decided = bucket["passed"] + bucket["error"] + bucket["failure"] + bucket["xfailed"] + bucket["xpassed"]
        bucket_total = (
            bucket["passed"]
            + bucket["error"]
            + bucket["failure"]
            + bucket["blocked"]
            + bucket["skipped"]
            + bucket["in_progress"]
            + bucket["untested"]
            + bucket["xfailed"]
            + bucket["xpassed"]
        )
        bucket_pass_rate = round((bucket["passed"] / bucket_decided) * 100, 2) if bucket_decided else 0.0
        bucket_start_iso = bucket_start.isoformat()
        bucket_label = _bucket_label(bucket_start, granularity)
        execution_trend.append(
            {
                "bucket_start": bucket_start_iso,
                "bucket_label": bucket_label,
                "runs": bucket["runs"],
            }
        )
        status_trend.append(
            {
                "bucket_start": bucket_start_iso,
                "bucket_label": bucket_label,
                "runs": bucket["runs"],
                "total": bucket_total,
                "passed": bucket["passed"],
                "error": bucket["error"],
                "failure": bucket["failure"],
                "blocked": bucket["blocked"],
                "skipped": bucket["skipped"],
                "in_progress": bucket["in_progress"],
                "untested": bucket["untested"],
                "xfailed": bucket["xfailed"],
                "xpassed": bucket["xpassed"],
                "pass_rate": bucket_pass_rate,
            }
        )
    return execution_trend, status_trend


def _report_item_payload(
    run_item,
    test_case,
    suite,
) -> tuple[dict, dict | None]:
    assignee_name = _user_display_name(run_item.assignee_user) if run_item.assignee_id else "Unassigned"
    executed_by_name = _user_display_name(run_item.executed_by_user) if run_item.executed_by else None
    suite_name = suite.name if suite else None
    item_payload = {
        "id": run_item.id,
        "test_case": {
            "id": test_case.id,
            "key": test_case.key,
            "title": test_case.title,
            "priority": test_case.priority.value if test_case.priority else None,
            "tags": test_case.tags,
            "suite_name": suite_name,
        },
        "status": run_item.status.value,
        "assignee_id": run_item.assignee_id,
        "assignee_name": assignee_name,
        "executed_by": run_item.executed_by,
        "executed_by_name": executed_by_name,
        "execution_count": run_item.execution_count,
        "last_executed_at": _isoformat(run_item.last_executed_at),
        "comment": run_item.comment,
        "defect_ids": run_item.defect_ids,
        "actual_result": run_item.actual_result,
        "started_at": _isoformat(run_item.started_at),
        "finished_at": _isoformat(run_item.finished_at),
        "duration_ms": run_item.duration_ms,
        "time": run_item.time,
        "created_at": _isoformat(run_item.created_at),
        "updated_at": _isoformat(run_item.updated_at),
    }
    failure: dict | None = None
    if run_item.status in {RunItemStatus.error, RunItemStatus.failure, RunItemStatus.xpassed}:
        failure = {
            "run_item_id": run_item.id,
            "test_case_id": test_case.id,
            "test_case_key": test_case.key,
            "test_case_title": test_case.title,
            "assignee_id": run_item.assignee_id,
            "assignee_name": assignee_name,
            "comment": run_item.comment,
            "defect_ids": run_item.defect_ids,
        }
    return item_payload, failure


def _assignee_breakdown_rows(rows, assignee_counts: dict[str | None, int]) -> list[dict]:
    assignee_id_to_name: dict[str | None, str] = {None: "Unassigned"}
    for run_item, _, _ in rows:
        if run_item.assignee_id and run_item.assignee_id not in assignee_id_to_name:
            assignee_id_to_name[run_item.assignee_id] = _user_display_name(run_item.assignee_user) or LABEL_UNKNOWN_USER
    by_assignee = [
        {
            "assignee_id": assignee_id,
            "assignee_name": assignee_id_to_name.get(assignee_id, LABEL_UNKNOWN_USER) if assignee_id else "Unassigned",
            "count": count,
        }
        for assignee_id, count in assignee_counts.items()
    ]
    by_assignee.sort(key=lambda item: (-item["count"], item["assignee_name"]))
    return by_assignee


async def build_run_report_payload(db: AsyncSession, *, run: TestRun) -> dict:
    """Builds full test run report payload.
    Uses FK relationships (assignee_user, executed_by_user, created_by_user) for user names.
    """
    rows = await fetch_run_items_with_cases(db, run.id)

    status_counts: dict[str, int] = {status.value: 0 for status in RUN_STATUS_ORDER}
    assignee_counts: dict[str | None, int] = {}

    for run_item, _, _ in rows:
        status_counts[run_item.status.value] = status_counts.get(run_item.status.value, 0) + 1
        assignee_counts[run_item.assignee_id] = assignee_counts.get(run_item.assignee_id, 0) + 1

    report_items: list[dict] = []
    failures: list[dict] = []
    for run_item, test_case, suite in rows:
        item_payload, failure = _report_item_payload(run_item, test_case, suite)
        report_items.append(item_payload)
        if failure is not None:
            failures.append(failure)

    by_status = [{"status": status.value, "count": status_counts.get(status.value, 0)} for status in RUN_STATUS_ORDER]
    by_assignee = _assignee_breakdown_rows(rows, assignee_counts)

    total = len(report_items)
    passed = status_counts.get(RunItemStatus.passed.value, 0)
    error = status_counts.get(RunItemStatus.error.value, 0)
    failure = status_counts.get(RunItemStatus.failure.value, 0)
    blocked = status_counts.get(RunItemStatus.blocked.value, 0)
    skipped = status_counts.get(RunItemStatus.skipped.value, 0)
    xfailed = status_counts.get(RunItemStatus.xfailed.value, 0)
    xpassed = status_counts.get(RunItemStatus.xpassed.value, 0)
    untested = status_counts.get(RunItemStatus.untested.value, 0)
    in_progress = status_counts.get(RunItemStatus.in_progress.value, 0)
    decided = passed + error + failure + xfailed + xpassed
    pass_rate = round((passed / decided) * 100, 2) if decided else 0.0
    completed = passed + error + failure + blocked + skipped + xfailed + xpassed
    progress_rate = round((completed / total) * 100, 2) if total else 0.0

    return {
        "report_type": "test_run",
        "format_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "test_run": {
            "id": run.id,
            "project_id": run.project_id,
            "name": run.name,
            "description": run.description,
            "environment_name": run.environment_name_snapshot,
            "environment_revision_number": run.environment_revision_number,
            "build": run.build,
            "status": run.status.value,
            "created_by": run.created_by,
            "created_by_name": _user_display_name(run.created_by_user) if run.created_by else None,
            "assignee": run.assignee,
            "assignee_name": _user_display_name(run.assignee_user) if run.assignee else None,
            "created_at": _isoformat(run.created_at),
            "updated_at": _isoformat(run.updated_at),
            "started_at": _isoformat(run.started_at),
            "completed_at": _isoformat(run.completed_at),
            "archived_at": _isoformat(run.archived_at),
        },
        "summary": {
            "total": total,
            "passed": passed,
            "error": error,
            "failure": failure,
            "blocked": blocked,
            "skipped": skipped,
            "xfailed": xfailed,
            "xpassed": xpassed,
            "untested": untested,
            "in_progress": in_progress,
            "pass_rate": pass_rate,
            "progress_rate": progress_rate,
        },
        "by_status": by_status,
        "by_assignee": by_assignee,
        "failures": failures,
        "items": report_items,
    }


def build_project_overview_payload(
    *,
    project_id: str,
    created_from: date | None,
    created_to: date | None,
    top_n: int = 8,
    granularity: OVERVIEW_GRANULARITY = "day",
    runs: list[ProjectOverviewRunRow],
    status_by_run: dict[str, dict[str, int]],
    assignee_rows: list[tuple[str | None, int]],
    user_names_by_id: dict[str, str],
) -> dict:
    """Builds project overview payload from preloaded data."""
    from app.models.enums import TestRunStatus

    agg = _aggregate_overview_runs(runs, status_by_run, granularity)
    total = agg.total
    passed = agg.passed
    error = agg.error
    failure = agg.failure
    blocked = agg.blocked
    skipped = agg.skipped
    untested = agg.untested
    in_progress = agg.in_progress
    xfailed = agg.xfailed
    xpassed = agg.xpassed
    pass_rate_trend = agg.pass_rate_trend
    failures_by_run = agg.failures_by_run
    bucket_totals = agg.bucket_totals
    runs_by_environment_counts = agg.runs_by_environment_counts
    runs_by_build_counts = agg.runs_by_build_counts

    active_runs = sum(1 for run in runs if run.status == TestRunStatus.in_progress)
    decided_total = passed + error + failure + xfailed + xpassed
    pass_rate = round((passed / decided_total) * 100, 2) if decided_total else 0.0

    status_distribution = [
        {"name": "Passed", "value": passed},
        {"name": "Error", "value": error},
        {"name": "Failure", "value": failure},
        {"name": "Blocked", "value": blocked},
        {"name": "Skipped", "value": skipped},
        {"name": "In progress", "value": in_progress},
        {"name": "Untested", "value": untested},
        {"name": "XFailed", "value": xfailed},
        {"name": "XPassed", "value": xpassed},
    ]
    execution_trend, status_trend = _build_overview_trend_series(bucket_totals, granularity)

    runs_by_environment = [
        {"environment": name, "runs": count}
        for name, count in sorted(runs_by_environment_counts.items(), key=lambda item: (-item[1], item[0].lower()))
    ]
    runs_by_build = [
        {"build": name, "runs": count}
        for name, count in sorted(runs_by_build_counts.items(), key=lambda item: (-item[1], item[0].lower()))
    ]

    execution_by_assignee = []
    for assignee_id, count in assignee_rows:
        if assignee_id:
            assignee_name = user_names_by_id.get(assignee_id, LABEL_UNKNOWN_USER)
        else:
            assignee_name = "Unassigned"
        execution_by_assignee.append(
            {
                "assignee_id": assignee_id,
                "assignee_name": assignee_name,
                "executed": count,
            }
        )
    execution_by_assignee.sort(key=lambda item: item["executed"], reverse=True)

    recent_activity = [
        {
            "id": run.id,
            "name": run.name,
            "status": run.status.value,
            "build": run.build,
            "updated_at": run.updated_at.isoformat(),
        }
        for run in sorted(runs, key=lambda item: item.updated_at, reverse=True)[:5]
    ]

    return {
        "project_id": project_id,
        "created_from": created_from.isoformat() if created_from else None,
        "created_to": created_to.isoformat() if created_to else None,
        "granularity": granularity,
        "run_count": len(runs),
        "release_stats": {
            "active_runs": active_runs,
            "total": total,
            "passed": passed,
            "error": error,
            "failure": failure,
            "blocked": blocked,
            "skipped": skipped,
            "untested": untested,
            "in_progress": in_progress,
            "pass_rate": pass_rate,
        },
        "pass_rate_trend": pass_rate_trend,
        "failures_by_run": failures_by_run[-top_n:],
        "execution_trend": execution_trend,
        "status_trend": status_trend,
        "runs_by_environment": runs_by_environment[:top_n],
        "runs_by_build": runs_by_build[:top_n],
        "status_distribution": [item for item in status_distribution if item["value"] > 0],
        "execution_by_assignee": execution_by_assignee[:top_n],
        "recent_activity": recent_activity,
    }
