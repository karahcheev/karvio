"""Tests for run_case_status service (replaces test_run_item_status_service)."""

from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.models.enums import RunItemStatus, TestRunStatus
from app.modules.projects.models import Project, User
from app.modules.test_cases.models import TestCase
from app.modules.test_runs.models import RunItem, TestRun
from app.modules.test_runs.services.status import ExecutionUpdateParams, apply_execution_update


@pytest_asyncio.fixture
async def seeded_item(db_session: AsyncSession) -> RunItem:
    user = User(id="user", username="executor", password_hash="x")
    project = Project(id="proj_1", name="P")
    tc = TestCase(id="tc_1", project_id="proj_1", suite_id=None, key="P1-TC-1", title="Case", tags=[])
    run = TestRun(id="run_1", project_id="proj_1", name="Run", status=TestRunStatus.in_progress)
    item = RunItem(id="ri_1", test_run_id="run_1", test_case_id="tc_1")
    db_session.add_all([user, project, tc, run, item])
    await db_session.commit()
    await db_session.refresh(item)
    return item


async def test_status_transition_success(db_session: AsyncSession, seeded_item: RunItem):
    item = seeded_item
    await apply_execution_update(
        db_session,
        params=ExecutionUpdateParams(
            item=item,
            status=RunItemStatus.passed,
            comment="ok",
            defect_ids=[],
            executed_by_id="user",
        ),
    )
    await db_session.commit()
    await db_session.refresh(item)
    assert item.status.value == "passed"
    assert item.execution_count == 1


async def test_execution_update_allowed_when_parent_not_started(db_session: AsyncSession):
    user = User(id="user", username="executor", password_hash="x")
    project = Project(id="proj_ns", name="P")
    tc = TestCase(id="tc_ns", project_id="proj_ns", suite_id=None, key="NS-1", title="Case", tags=[])
    run = TestRun(id="run_ns", project_id="proj_ns", name="Run", status=TestRunStatus.not_started)
    item = RunItem(id="ri_ns", test_run_id="run_ns", test_case_id="tc_ns")
    db_session.add_all([user, project, tc, run, item])
    await db_session.commit()

    await apply_execution_update(
        db_session,
        params=ExecutionUpdateParams(
            item=item,
            status=RunItemStatus.passed,
            comment="ok",
            defect_ids=[],
            executed_by_id="user",
        ),
    )
    await db_session.commit()
    await db_session.refresh(item)
    assert item.status.value == "passed"
    assert item.execution_count == 1


async def test_passed_to_xpassed_allowed(db_session: AsyncSession, seeded_item: RunItem):
    item = seeded_item
    await apply_execution_update(
        db_session,
        params=ExecutionUpdateParams(
            item=item,
            status=RunItemStatus.passed,
            comment="ok",
            defect_ids=[],
            executed_by_id="user",
        ),
    )
    await db_session.commit()
    await db_session.refresh(item)
    assert item.status.value == "passed"

    await apply_execution_update(
        db_session,
        params=ExecutionUpdateParams(
            item=item,
            status=RunItemStatus.xpassed,
            comment="unexpected pass — was marked xfail",
            defect_ids=[],
            executed_by_id="user",
        ),
    )
    await db_session.commit()
    await db_session.refresh(item)
    assert item.status.value == "xpassed"


async def test_passed_to_failure_direct_allowed(db_session: AsyncSession, seeded_item: RunItem):
    item = seeded_item
    await apply_execution_update(
        db_session,
        params=ExecutionUpdateParams(
            item=item,
            status=RunItemStatus.passed,
            comment="ok",
            defect_ids=[],
            executed_by_id="user",
        ),
    )
    await db_session.commit()
    await db_session.refresh(item)

    await apply_execution_update(
        db_session,
        params=ExecutionUpdateParams(
            item=item,
            status=RunItemStatus.failure,
            comment="bad",
            defect_ids=[],
            executed_by_id="user",
        ),
    )
    await db_session.commit()
    await db_session.refresh(item)
    assert item.status.value == "failure"
    assert item.execution_count == 2


async def test_repeat_same_terminal_status_does_not_increment_execution_count(
    db_session: AsyncSession, seeded_item: RunItem
):
    item = seeded_item
    await apply_execution_update(
        db_session,
        params=ExecutionUpdateParams(
            item=item,
            status=RunItemStatus.passed,
            comment="ok",
            defect_ids=[],
            executed_by_id="user",
        ),
    )
    await db_session.commit()
    await db_session.refresh(item)
    first_count = item.execution_count
    first_last = item.last_executed_at

    await apply_execution_update(
        db_session,
        params=ExecutionUpdateParams(
            item=item,
            status=RunItemStatus.passed,
            comment="still ok",
            defect_ids=[],
            executed_by_id="user",
        ),
    )
    await db_session.commit()
    await db_session.refresh(item)
    assert item.execution_count == first_count
    assert item.last_executed_at == first_last


@pytest.mark.parametrize("run_status", [TestRunStatus.completed, TestRunStatus.archived])
async def test_status_transition_rejects_completed_or_archived_parent_run(
    db_session: AsyncSession, seeded_item: RunItem, run_status: TestRunStatus
):
    item = seeded_item
    run = await db_session.get(TestRun, item.test_run_id)
    assert run is not None
    run.status = run_status
    await db_session.commit()
    await db_session.refresh(item)

    with pytest.raises(DomainError) as error:
        await apply_execution_update(
            db_session,
            params=ExecutionUpdateParams(
                item=item,
                status=RunItemStatus.passed,
                comment="ok",
                defect_ids=[],
                executed_by_id="user",
            ),
        )

    assert error.value.code == "invalid_status_transition"
    assert "completed or archived" in error.value.detail


async def test_repeat_same_terminal_status_count_starts_at_one(
    db_session: AsyncSession, seeded_item: RunItem
):
    """Verify execution_count is exactly 1 after the first terminal status — guards against incorrect initial value."""
    item = seeded_item
    await apply_execution_update(
        db_session,
        params=ExecutionUpdateParams(
            item=item,
            status=RunItemStatus.passed,
            comment="ok",
            defect_ids=[],
            executed_by_id="user",
        ),
    )
    await db_session.commit()
    await db_session.refresh(item)
    assert item.execution_count == 1


async def test_non_terminal_status_does_not_increment_execution_count(
    db_session: AsyncSession, seeded_item: RunItem
):
    item = seeded_item
    await apply_execution_update(
        db_session,
        params=ExecutionUpdateParams(
            item=item,
            status=RunItemStatus.in_progress,
            defect_ids=[],
        ),
    )
    await db_session.commit()
    await db_session.refresh(item)
    assert item.execution_count == 0


async def test_validate_timestamps_raises_when_finished_before_started(
    db_session: AsyncSession, seeded_item: RunItem
):
    now = datetime.now(timezone.utc)
    with pytest.raises(DomainError) as exc:
        await apply_execution_update(
            db_session,
            params=ExecutionUpdateParams(
                item=seeded_item,
                status=RunItemStatus.passed,
                started_at=now,
                finished_at=now - timedelta(seconds=10),
            ),
        )
    assert exc.value.code == "validation_error"
    assert "finished_at" in str(exc.value.errors)


async def test_explicit_duration_ms_is_stored(db_session: AsyncSession, seeded_item: RunItem):
    await apply_execution_update(
        db_session,
        params=ExecutionUpdateParams(
            item=seeded_item,
            status=RunItemStatus.passed,
            duration_ms=1234,
        ),
    )
    await db_session.commit()
    await db_session.refresh(seeded_item)
    assert seeded_item.duration_ms == 1234


async def test_duration_ms_computed_from_timestamps_when_not_explicit(
    db_session: AsyncSession, seeded_item: RunItem
):
    started = datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    finished = datetime(2024, 1, 1, 0, 0, 5, tzinfo=timezone.utc)  # 5 seconds later
    await apply_execution_update(
        db_session,
        params=ExecutionUpdateParams(
            item=seeded_item,
            status=RunItemStatus.passed,
            started_at=started,
            finished_at=finished,
        ),
    )
    await db_session.commit()
    await db_session.refresh(seeded_item)
    assert seeded_item.duration_ms == 5000


async def test_apply_execution_update_raises_when_parent_run_missing(db_session: AsyncSession):
    project = Project(id="proj_orphan", name="P")
    tc = TestCase(id="tc_orphan", project_id="proj_orphan", suite_id=None, key="X-1", title="T", tags=[])
    run = TestRun(id="run_orphan", project_id="proj_orphan", name="Run", status=TestRunStatus.in_progress)
    item = RunItem(id="ri_orphan", test_run_id="run_orphan", test_case_id="tc_orphan")
    db_session.add_all([project, tc, run, item])
    await db_session.commit()

    # Simulate the parent run disappearing between item fetch and update.
    await db_session.delete(item)
    await db_session.delete(run)
    await db_session.commit()
    item.test_run_id = "run_orphan"  # keep stale reference on the in-memory object

    with pytest.raises(DomainError) as exc:
        await apply_execution_update(
            db_session,
            params=ExecutionUpdateParams(
                item=item,
                status=RunItemStatus.passed,
            ),
        )
    assert exc.value.code == "run_not_found"
