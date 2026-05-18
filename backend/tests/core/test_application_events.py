"""Unit tests for application_events.publish orchestration."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core import application_events


@pytest.mark.asyncio
async def test_publish_test_plan_created_queues_audit() -> None:
    db = AsyncMock()
    plan = MagicMock()
    plan.project_id = "proj1"
    plan.id = "tp1"
    with patch("app.modules.audit.services.audit.queue_create_event", new_callable=AsyncMock) as queue_create:
        await application_events.publish(db, application_events.TestPlanCreated(entity=plan))
        queue_create.assert_awaited_once()
        kwargs = queue_create.await_args.kwargs
        assert kwargs["action"] == "test_plan.create"
        assert kwargs["resource_type"] == "test_plan"
        assert kwargs["entity"] is plan
        assert kwargs["tenant_id"] == "proj1"


@pytest.mark.asyncio
async def test_publish_test_run_updated_with_completed_queues_report_notifications() -> None:
    db = AsyncMock()
    run = MagicMock()
    run.id = "run1"
    run.project_id = "proj1"
    before: dict[str, object] = {"status": "in_progress"}
    with (
        patch("app.modules.audit.services.audit.queue_update_event", new_callable=AsyncMock) as queue_update,
        patch(
            "app.modules.notifications.services.settings.queue_test_run_report_notifications",
            new_callable=AsyncMock,
        ) as queue_reports,
    ):
        await application_events.publish(
            db,
            application_events.TestRunUpdated(
                entity=run,
                before_state=before,
                audit_action="test_run.complete",
                queue_report_notifications=True,
            ),
        )
        queue_update.assert_awaited_once()
        assert queue_update.await_args.kwargs["action"] == "test_run.complete"
        queue_reports.assert_awaited_once_with(db, test_run_id="run1")


@pytest.mark.asyncio
async def test_publish_test_run_updated_without_flag_skips_notifications() -> None:
    db = AsyncMock()
    run = MagicMock()
    run.id = "run1"
    run.project_id = "proj1"
    with (
        patch("app.modules.audit.services.audit.queue_update_event", new_callable=AsyncMock),
        patch(
            "app.modules.notifications.services.settings.queue_test_run_report_notifications",
            new_callable=AsyncMock,
        ) as queue_reports,
    ):
        await application_events.publish(
            db,
            application_events.TestRunUpdated(
                entity=run,
                before_state={},
                audit_action="test_run.update",
                queue_report_notifications=False,
            ),
        )
        queue_reports.assert_not_called()


@pytest.mark.asyncio
async def test_publish_unknown_event_type_raises() -> None:
    with pytest.raises(TypeError, match="Unsupported application event"):
        await application_events.publish(AsyncMock(), object())


def test_snapshot_entity_delegates_to_audit() -> None:
    entity = MagicMock()
    with patch("app.modules.audit.services.audit.snapshot_entity", return_value={"id": "x"}) as snap:
        out = application_events.snapshot_entity(entity)
        snap.assert_called_once_with(entity)
        assert out == {"id": "x"}
