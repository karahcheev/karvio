from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.errors import DomainError
from app.models.enums import TestRunStatus
from app.modules.report_import.junit_xml_parser import ParsedJunitReport
from app.modules.report_import.target_run import (
    choose_target_run_name,
    create_target_run,
    ensure_run_accepts_import,
    find_matching_run,
    get_run_or_404,
)


async def test_get_run_or_404_returns_existing_run() -> None:
    db = AsyncMock()
    run = SimpleNamespace(id="run-1")

    with patch("app.modules.report_import.target_run.test_run_repo.get_by_id", new_callable=AsyncMock, return_value=run):
        out = await get_run_or_404(db, "run-1")

    assert out is run


async def test_get_run_or_404_raises_when_missing() -> None:
    db = AsyncMock()

    with patch("app.modules.report_import.target_run.test_run_repo.get_by_id", new_callable=AsyncMock, return_value=None):
        with pytest.raises(DomainError) as exc:
            await get_run_or_404(db, "run-404")

    assert exc.value.code == "test_run_not_found"


@pytest.mark.parametrize("status", [TestRunStatus.not_started, TestRunStatus.in_progress])
def test_ensure_run_accepts_import_allows_non_terminal_statuses(status: TestRunStatus) -> None:
    run = SimpleNamespace(status=status)

    ensure_run_accepts_import(run)


@pytest.mark.parametrize("status", [TestRunStatus.completed, TestRunStatus.archived])
def test_ensure_run_accepts_import_rejects_terminal_statuses(status: TestRunStatus) -> None:
    run = SimpleNamespace(status=status)

    with pytest.raises(DomainError) as exc:
        ensure_run_accepts_import(run)

    assert exc.value.code == "run_import_not_allowed"
    assert exc.value.status_code == 409


def test_choose_target_run_name_prefers_report_name() -> None:
    report = ParsedJunitReport(cases=[], run_name="Nightly API", timestamp=None)

    assert choose_target_run_name(report, "fallback.xml") == "Nightly API"


def test_choose_target_run_name_uses_filename_stem_when_report_name_missing() -> None:
    report = ParsedJunitReport(cases=[], run_name=None, timestamp=None)

    assert choose_target_run_name(report, "nightly-browser.xml") == "nightly-browser"


def test_choose_target_run_name_uses_default_when_inputs_missing() -> None:
    report = ParsedJunitReport(cases=[], run_name=None, timestamp=None)

    assert choose_target_run_name(report, None) == "JUnit Import"
    assert choose_target_run_name(report, "   ") == "JUnit Import"


async def test_find_matching_run_returns_none_when_no_active_candidates() -> None:
    db = AsyncMock()
    archived = SimpleNamespace(status=TestRunStatus.archived)

    with patch(
        "app.modules.report_import.target_run.test_run_repo.list_by_project_and_name",
        new_callable=AsyncMock,
        return_value=[archived],
    ):
        out = await find_matching_run(db, project_id="p1", run_name="Nightly", report_timestamp=None)

    assert out is None


async def test_find_matching_run_without_timestamp_returns_first_candidate() -> None:
    db = AsyncMock()
    first = SimpleNamespace(status=TestRunStatus.not_started)
    second = SimpleNamespace(status=TestRunStatus.in_progress)

    with patch(
        "app.modules.report_import.target_run.test_run_repo.list_by_project_and_name",
        new_callable=AsyncMock,
        return_value=[first, second],
    ):
        out = await find_matching_run(db, project_id="p1", run_name="Nightly", report_timestamp=None)

    assert out is first


async def test_find_matching_run_with_timestamp_prefers_eligible_nearest() -> None:
    db = AsyncMock()
    report_ts = datetime(2026, 4, 1, 12, 0, tzinfo=timezone.utc)
    near = SimpleNamespace(
        status=TestRunStatus.not_started,
        created_at=datetime(2026, 4, 1, 12, 30, tzinfo=timezone.utc),
    )
    far_but_eligible = SimpleNamespace(
        status=TestRunStatus.in_progress,
        created_at=datetime(2026, 3, 31, 13, 0, tzinfo=timezone.utc),
    )
    out_of_window = SimpleNamespace(
        status=TestRunStatus.not_started,
        created_at=datetime(2026, 3, 29, 10, 0, tzinfo=timezone.utc),
    )

    with patch(
        "app.modules.report_import.target_run.test_run_repo.list_by_project_and_name",
        new_callable=AsyncMock,
        return_value=[out_of_window, far_but_eligible, near],
    ):
        out = await find_matching_run(db, project_id="p1", run_name="Nightly", report_timestamp=report_ts)

    assert out is near


async def test_find_matching_run_with_timestamp_uses_all_candidates_if_no_eligible() -> None:
    db = AsyncMock()
    report_ts = datetime(2026, 4, 1, 12, 0, tzinfo=timezone.utc)
    older = SimpleNamespace(
        status=TestRunStatus.not_started,
        created_at=datetime(2026, 3, 29, 10, 0, tzinfo=timezone.utc),
    )
    newer = SimpleNamespace(
        status=TestRunStatus.in_progress,
        created_at=datetime(2026, 3, 30, 11, 0, tzinfo=timezone.utc),
    )

    with patch(
        "app.modules.report_import.target_run.test_run_repo.list_by_project_and_name",
        new_callable=AsyncMock,
        return_value=[older, newer],
    ):
        out = await find_matching_run(db, project_id="p1", run_name="Nightly", report_timestamp=report_ts)

    assert out is newer


async def test_find_matching_run_supports_naive_timestamps() -> None:
    db = AsyncMock()
    report_ts = datetime(2026, 4, 1, 12, 0)
    candidate = SimpleNamespace(
        status=TestRunStatus.not_started,
        created_at=datetime(2026, 4, 1, 12, 10),
    )

    with patch(
        "app.modules.report_import.target_run.test_run_repo.list_by_project_and_name",
        new_callable=AsyncMock,
        return_value=[candidate],
    ):
        out = await find_matching_run(db, project_id="p1", run_name="Nightly", report_timestamp=report_ts)

    assert out is candidate


async def test_create_target_run_creates_and_publishes_event() -> None:
    db = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    current_user = SimpleNamespace(id="u-1")

    with patch("app.modules.report_import.target_run.application_events.publish", new_callable=AsyncMock) as publish:
        run = await create_target_run(db, project_id="p-1", run_name="Nightly", current_user=current_user)

    assert run.project_id == "p-1"
    assert run.name == "Nightly"
    assert run.created_by == "u-1"
    db.add.assert_called_once_with(run)
    db.flush.assert_awaited_once()
    db.refresh.assert_awaited_once_with(run)
    publish.assert_awaited_once()
