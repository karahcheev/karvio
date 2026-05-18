from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.modules.notifications.services import message_builders


def _summary():
    return SimpleNamespace(total=10, passed=8, error=1, failure=1, blocked=0, skipped=0, pass_rate=80.0)


async def test_build_test_run_report_message_escapes_and_formats_fields() -> None:
    run = SimpleNamespace(
        id="run-1",
        name='Nightly <Run>',
        environment_name_snapshot="Staging",
        environment_revision_number=7,
        build="build-42",
        completed_at=datetime(2026, 4, 3, 10, 5, tzinfo=timezone.utc),
        status=SimpleNamespace(value="completed"),
    )
    with patch(
        "app.modules.notifications.services.message_builders.reports_service.build_run_summary_and_breakdown",
        new_callable=AsyncMock,
        return_value=(_summary(), None),
    ):
        subject, plain, html = await message_builders.build_test_run_report_message(AsyncMock(), run)

    assert subject == "Karvio report: Nightly <Run> completed"
    assert "Environment: Staging · r7" in plain
    assert "Pass rate: 80.0%" in plain
    assert "Nightly &lt;Run&gt;" in html
    assert "Status: Completed" in html


async def test_build_test_run_report_message_uses_defaults_when_optional_absent() -> None:
    run = SimpleNamespace(
        id="run-2",
        name="No metadata",
        environment_name_snapshot=None,
        environment_revision_number=None,
        build=None,
        completed_at=None,
        status=SimpleNamespace(value="in_progress"),
    )
    with patch(
        "app.modules.notifications.services.message_builders.reports_service.build_run_summary_and_breakdown",
        new_callable=AsyncMock,
        return_value=(_summary(), None),
    ):
        _subject, plain, html = await message_builders.build_test_run_report_message(AsyncMock(), run)
    assert "Completed at: N/A" in plain
    assert "Environment: Not specified" in plain
    assert "Build: Not specified" in plain
    assert "Not specified" in html


def test_build_alerting_test_message() -> None:
    subject, plain, html = message_builders.build_alerting_test_message("proj-1")
    assert "proj-1" in subject
    assert "proj-1" in plain
    assert "<code>proj-1</code>" in html
