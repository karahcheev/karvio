from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from app.modules.notifications.services import notification_rules as service


def test_normalize_rule_payload_defaults() -> None:
    out = service.normalize_rule_payload(None)
    assert out.enabled is False
    assert out.email.enabled is False


def test_to_read_model_maps_payloads() -> None:
    now = datetime.now(timezone.utc)
    entity = SimpleNamespace(
        id="ns1",
        project_id="p1",
        test_run_report={"enabled": True, "email": {"enabled": True, "recipients": ["qa@example.com"]}},
        alerting={},
        created_at=now,
        updated_at=now,
    )
    out = service.to_read_model(entity)
    assert out.id == "ns1"
    assert out.test_run_report.enabled is True
