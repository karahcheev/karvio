from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.models.enums import AuditQueueStatus
from app.modules.audit.models import AuditLogQueueEntry
from app.modules.system.services import status as service


class _RowsResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


def _settings(**overrides):
    base = {
        "attachment_local_root": "/tmp/tms-att",
        "performance_artifact_root": "/tmp/tms-perf",
        "status_queue_backlog_warn": 5,
        "status_queue_backlog_fail": 10,
        "status_processing_stale_seconds": 120,
        "status_pending_stale_seconds": 120,
        "app_version": "test",
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_age_seconds_and_component_status_helpers() -> None:
    now = datetime(2026, 4, 3, 10, 0, tzinfo=timezone.utc)
    assert service._age_seconds(None, now) is None
    assert service._age_seconds(now - timedelta(seconds=10), now) == 10
    assert service._component_status_from_health_flags(has_failure=True, has_warning=False) == "down"
    assert service._component_status_from_health_flags(has_failure=False, has_warning=True) == "degraded"
    assert service._component_status_from_health_flags(has_failure=False, has_warning=False) == "ok"


def test_check_local_path_writable_ok(tmp_path: Path) -> None:
    result = service._check_local_path_writable(str(tmp_path / "status-dir"))
    assert result["status"] == "ok"


def test_check_local_path_writable_down_when_path_is_file(tmp_path: Path) -> None:
    file_path = tmp_path / "file.txt"
    file_path.write_text("x", encoding="utf-8")
    result = service._check_local_path_writable(str(file_path))
    assert result["status"] == "down"
    assert "error_type" in result


def test_check_storage_aggregates_component_state() -> None:
    settings = _settings()
    with patch(
        "app.modules.system.services.status._check_local_path_writable",
        side_effect=[{"status": "ok"}, {"status": "down"}],
    ):
        result = service._check_storage(settings)
    assert result["status"] == "degraded"


@pytest.mark.asyncio
async def test_check_database_success() -> None:
    db = AsyncMock()
    result = await service._check_database(db)
    assert result["status"] == "ok"
    assert "latency_ms" in result


@pytest.mark.asyncio
async def test_check_database_failure_rolls_back() -> None:
    db = AsyncMock()
    db.execute.side_effect = RuntimeError("db_down")
    result = await service._check_database(db)
    assert result["status"] == "down"
    assert result["error_type"] == "RuntimeError"
    db.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_build_queue_component_marks_degraded_with_reasons() -> None:
    db = AsyncMock()
    now = datetime(2026, 4, 3, 10, 0, tzinfo=timezone.utc)
    db.execute.return_value = _RowsResult(
        [
            (AuditQueueStatus.pending, 3),
            (AuditQueueStatus.processing, 2),
            (AuditQueueStatus.dead, 1),
        ]
    )
    db.scalar.side_effect = [now - timedelta(seconds=100), now - timedelta(seconds=200)]

    result = await service._build_queue_component(
        db=db,
        name="audit_queue",
        model=AuditLogQueueEntry,
        pending_value=AuditQueueStatus.pending,
        processing_value=AuditQueueStatus.processing,
        dead_value=AuditQueueStatus.dead,
        now=now,
        backlog_warn=5,
        backlog_fail=10,
        stale_processing_seconds=150,
        stale_pending_seconds=150,
    )

    assert result["status"] == "degraded"
    assert result["backlog"] == 6
    assert "backlog_high" in result["reasons"]
    assert "dead_letter_detected" in result["reasons"]
    assert "processing_stale" in result["reasons"]


@pytest.mark.asyncio
async def test_build_queue_component_marks_down_on_backlog_fail_and_pending_stale() -> None:
    db = AsyncMock()
    now = datetime(2026, 4, 3, 10, 0, tzinfo=timezone.utc)
    db.execute.return_value = _RowsResult(
        [
            (AuditQueueStatus.pending, 11),
            (AuditQueueStatus.processing, 0),
            (AuditQueueStatus.dead, 0),
        ]
    )
    db.scalar.side_effect = [now - timedelta(seconds=300), now - timedelta(seconds=10)]

    result = await service._build_queue_component(
        db=db,
        name="audit_queue",
        model=AuditLogQueueEntry,
        pending_value=AuditQueueStatus.pending,
        processing_value=AuditQueueStatus.processing,
        dead_value=AuditQueueStatus.dead,
        now=now,
        backlog_warn=5,
        backlog_fail=10,
        stale_processing_seconds=150,
        stale_pending_seconds=150,
    )

    assert result["status"] == "down"
    assert "backlog_too_high" in result["reasons"]
    assert "pending_stale_without_processing" in result["reasons"]


@pytest.mark.asyncio
async def test_check_workers_and_queues_aggregates_statuses() -> None:
    db = AsyncMock()
    settings = _settings()
    now = datetime.now(timezone.utc)

    with patch(
        "app.modules.system.services.status._build_queue_component",
        new_callable=AsyncMock,
        side_effect=[
            {"status": "ok"},
            {"status": "degraded"},
            {"status": "ok"},
        ],
    ):
        result = await service._check_workers_and_queues(db, settings, now=now)

    assert result["status"] == "degraded"
    assert set(result["queues"].keys()) == {"audit", "notifications", "performance_import"}


@pytest.mark.asyncio
async def test_build_system_status_db_down_skips_workers_check() -> None:
    db = AsyncMock()
    settings = _settings()

    with (
        patch("app.modules.system.services.status._check_database", new_callable=AsyncMock, return_value={"status": "down"}),
        patch("app.modules.system.services.status._check_storage", return_value={"status": "ok"}),
        patch("app.modules.system.services.status._check_workers_and_queues", new_callable=AsyncMock) as check_workers,
    ):
        result = await service.build_system_status(db, settings=settings)

    assert result["status"] == "down"
    assert result["components"]["workers"]["queues"]["audit"]["reasons"] == ["database_unavailable"]
    check_workers.assert_not_called()


@pytest.mark.asyncio
async def test_build_system_status_handles_workers_probe_error() -> None:
    db = AsyncMock()
    settings = _settings()

    with (
        patch("app.modules.system.services.status._check_database", new_callable=AsyncMock, return_value={"status": "ok"}),
        patch("app.modules.system.services.status._check_storage", return_value={"status": "ok"}),
        patch("app.modules.system.services.status._check_workers_and_queues", new_callable=AsyncMock, side_effect=RuntimeError("boom")),
    ):
        result = await service.build_system_status(db, settings=settings)

    assert result["status"] == "down"
    assert result["components"]["workers"]["status"] == "down"
    db.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_build_system_status_returns_degraded_when_no_component_is_down() -> None:
    db = AsyncMock()
    settings = _settings()

    with (
        patch("app.modules.system.services.status._check_database", new_callable=AsyncMock, return_value={"status": "ok"}),
        patch("app.modules.system.services.status._check_storage", return_value={"status": "degraded"}),
        patch("app.modules.system.services.status._check_workers_and_queues", new_callable=AsyncMock, return_value={"status": "ok", "queues": {}}),
    ):
        result = await service.build_system_status(db, settings=settings)

    assert result["status"] == "degraded"
