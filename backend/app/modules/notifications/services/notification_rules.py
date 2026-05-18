from __future__ import annotations

from typing import Any

from app.modules.notifications.models import ProjectNotificationSettings
from app.modules.notifications.schemas.settings import ProjectNotificationRuleSettings, ProjectNotificationSettingsRead


def normalize_rule_payload(payload: dict[str, Any] | None) -> ProjectNotificationRuleSettings:
    return ProjectNotificationRuleSettings.model_validate(payload or {})


def to_read_model(entity: ProjectNotificationSettings) -> ProjectNotificationSettingsRead:
    return ProjectNotificationSettingsRead(
        id=entity.id,
        project_id=entity.project_id,
        test_run_report=normalize_rule_payload(entity.test_run_report),
        alerting=normalize_rule_payload(entity.alerting),
        created_at=entity.created_at,
        updated_at=entity.updated_at,
    )
