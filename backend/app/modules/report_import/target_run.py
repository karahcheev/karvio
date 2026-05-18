from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.core.errors import DomainError
from app.models.enums import TestRunStatus
from app.core import application_events
from app.modules.projects.models import User
from app.modules.test_runs.models import TestRun
from app.modules.test_runs.repositories import runs as test_run_repo
from app.modules.report_import.junit_xml_parser import ParsedJunitReport


async def get_run_or_404(db: AsyncSession, test_run_id: str) -> TestRun:
    run = await test_run_repo.get_by_id(db, test_run_id)
    if not run:
        raise not_found("test_run")
    return run


def ensure_run_accepts_import(run: TestRun) -> None:
    if run.status in {TestRunStatus.completed, TestRunStatus.archived}:
        raise DomainError(
            status_code=409,
            code="run_import_not_allowed",
            title="Conflict",
            detail="JUnit XML import is allowed only for not_started or in_progress test runs",
        )


def choose_target_run_name(report: ParsedJunitReport, filename: str | None) -> str:
    if report.run_name:
        return report.run_name
    if filename:
        stem = Path(filename).stem.strip()
        if stem:
            return stem
    return "JUnit Import"


async def find_matching_run(
    db: AsyncSession,
    *,
    project_id: str,
    run_name: str,
    report_timestamp: datetime | None,
) -> TestRun | None:
    candidates = [
        run
        for run in await test_run_repo.list_by_project_and_name(db, project_id=project_id, name=run_name)
        if run.status in {TestRunStatus.not_started, TestRunStatus.in_progress}
    ]
    if not candidates:
        return None
    if report_timestamp is None:
        return candidates[0]

    timestamp = report_timestamp.astimezone(timezone.utc) if report_timestamp.tzinfo else report_timestamp.replace(tzinfo=timezone.utc)
    eligible = [
        run
        for run in candidates
        if abs(
            (run.created_at.astimezone(timezone.utc) if run.created_at.tzinfo else run.created_at.replace(tzinfo=timezone.utc))
            - timestamp
        )
        <= timedelta(hours=24)
    ]
    pool = eligible or candidates
    return min(
        pool,
        key=lambda run: abs(
            (run.created_at.astimezone(timezone.utc) if run.created_at.tzinfo else run.created_at.replace(tzinfo=timezone.utc))
            - timestamp
        ),
    )


async def create_target_run(
    db: AsyncSession,
    *,
    project_id: str,
    run_name: str,
    current_user: User,
) -> TestRun:
    run = TestRun(
        project_id=project_id,
        name=run_name,
        created_by=current_user.id,
    )
    db.add(run)
    await application_events.publish(db, application_events.TestRunCreated(entity=run))
    await db.flush()
    await db.refresh(run)
    return run
