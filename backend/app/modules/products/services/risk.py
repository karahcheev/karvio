"""Risk scoring helpers for components."""

from __future__ import annotations

from app.models.enums import ComponentRiskLevel, TestCasePriority
from app.modules.products.models import Component
from app.modules.products.schemas.components import ComponentCreate, ComponentPatch

RISK_RANK: dict[ComponentRiskLevel, int] = {
    ComponentRiskLevel.low: 1,
    ComponentRiskLevel.medium: 2,
    ComponentRiskLevel.high: 3,
    ComponentRiskLevel.critical: 4,
}
PRIORITY_RANK: dict[TestCasePriority | None, int] = {
    TestCasePriority.low: 1,
    TestCasePriority.medium: 2,
    TestCasePriority.high: 3,
    TestCasePriority.critical: 4,
    None: 0,
}
STRENGTH_SCORE: dict[str, int] = {
    "smoke": 1,
    "regression": 2,
    "deep": 3,
}
REQUIRED_COMPONENT_COVERAGE_SCORE: dict[ComponentRiskLevel, int] = {
    ComponentRiskLevel.low: 1,
    ComponentRiskLevel.medium: 2,
    ComponentRiskLevel.high: 4,
    ComponentRiskLevel.critical: 6,
}


def compute_risk_score_and_level(component: Component) -> tuple[int, ComponentRiskLevel]:
    weighted_sum = (
        component.business_criticality * 3
        + component.change_frequency * 2
        + component.integration_complexity * 2
        + component.defect_density * 2
        + component.production_incident_score * 3
        + (5 - component.automation_confidence)
    )
    risk_score = round(weighted_sum / 65 * 100)
    if risk_score <= 24:
        return risk_score, ComponentRiskLevel.low
    if risk_score <= 49:
        return risk_score, ComponentRiskLevel.medium
    if risk_score <= 74:
        return risk_score, ComponentRiskLevel.high
    return risk_score, ComponentRiskLevel.critical


def _apply_component_risk_updates(component: Component, payload: ComponentCreate | ComponentPatch) -> None:
    for field in (
        "business_criticality",
        "change_frequency",
        "integration_complexity",
        "defect_density",
        "production_incident_score",
        "automation_confidence",
    ):
        if hasattr(payload, field):
            value = getattr(payload, field)
            if value is not None:
                setattr(component, field, value)
    component.risk_score, component.risk_level = compute_risk_score_and_level(component)


def _required_coverage_score(risk_level: ComponentRiskLevel) -> int:
    return REQUIRED_COMPONENT_COVERAGE_SCORE.get(risk_level, 1)


def _risk_threshold_allowed(risk_level: ComponentRiskLevel, minimum: ComponentRiskLevel | None) -> bool:
    if minimum is None:
        return True
    return RISK_RANK[risk_level] >= RISK_RANK[minimum]
