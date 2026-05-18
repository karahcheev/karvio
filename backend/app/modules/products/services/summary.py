"""Product summary / analytics computation."""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ComponentRiskLevel, TestCaseStatus
from app.modules.products.repositories import products as product_repo
from app.modules.products.schemas.summary import (
    ProductSummaryComponentBreakdown,
    ProductSummaryRead,
)
from app.modules.products.services.risk import STRENGTH_SCORE, _required_coverage_score


async def _build_product_summary(
    db: AsyncSession,
    product_id: str,
) -> ProductSummaryRead:
    """Compute the coverage summary for a product (no auth — caller must check access)."""
    rows = await product_repo.build_product_summary_rows(db, product_id)
    component_breakdown: dict[str, ProductSummaryComponentBreakdown] = {}
    covered_components: set[str] = set()
    total_cases: set[str] = set()
    mandatory_cases: set[str] = set()
    smoke_cases: set[str] = set()
    regression_cases: set[str] = set()
    deep_cases: set[str] = set()
    manual_cases: set[str] = set()
    automated_cases: set[str] = set()
    core_components = 0
    component_case_strength_score: dict[str, dict[str, int]] = defaultdict(dict)
    component_case_strength_label: dict[str, dict[str, str]] = defaultdict(dict)

    for (
        component_id,
        component_key,
        component_name,
        risk_level,
        risk_score,
        is_core,
        test_case_id,
        coverage_strength,
        is_mandatory_for_release,
        test_case_type,
        test_case_status,
    ) in rows:
        if component_id not in component_breakdown:
            component_breakdown[component_id] = ProductSummaryComponentBreakdown(
                component_id=component_id,
                component_key=component_key,
                component_name=component_name,
                risk_level=risk_level,
                risk_score=int(risk_score),
                coverage_score=0,
                required_coverage_score=_required_coverage_score(risk_level),
                adequately_covered=False,
                smoke_case_count=0,
                regression_case_count=0,
                deep_case_count=0,
                covered_case_ids=[],
                uncovered=True,
            )
            if is_core:
                core_components += 1

        if test_case_id and test_case_status == TestCaseStatus.active:
            covered_components.add(component_id)
            breakdown = component_breakdown[component_id]
            if test_case_id not in breakdown.covered_case_ids:
                breakdown.covered_case_ids.append(test_case_id)
            total_cases.add(test_case_id)
            if is_mandatory_for_release:
                mandatory_cases.add(test_case_id)
            if coverage_strength.value == "smoke":
                smoke_cases.add(test_case_id)
                regression_cases.add(test_case_id)
                deep_cases.add(test_case_id)
            elif coverage_strength.value == "regression":
                regression_cases.add(test_case_id)
                deep_cases.add(test_case_id)
            else:
                deep_cases.add(test_case_id)
            if test_case_type and test_case_type.value == "automated":
                automated_cases.add(test_case_id)
            else:
                manual_cases.add(test_case_id)

            strength_label = coverage_strength.value
            strength_score = STRENGTH_SCORE.get(strength_label, 1)
            previous_score = component_case_strength_score[component_id].get(test_case_id, 0)
            if strength_score > previous_score:
                previous_label = component_case_strength_label[component_id].get(test_case_id)
                if previous_label == "smoke":
                    breakdown.smoke_case_count = max(0, breakdown.smoke_case_count - 1)
                elif previous_label == "regression":
                    breakdown.regression_case_count = max(0, breakdown.regression_case_count - 1)
                elif previous_label == "deep":
                    breakdown.deep_case_count = max(0, breakdown.deep_case_count - 1)

                if strength_label == "smoke":
                    breakdown.smoke_case_count += 1
                elif strength_label == "regression":
                    breakdown.regression_case_count += 1
                elif strength_label == "deep":
                    breakdown.deep_case_count += 1

                breakdown.coverage_score += strength_score - previous_score
                component_case_strength_score[component_id][test_case_id] = strength_score
                component_case_strength_label[component_id][test_case_id] = strength_label

    for breakdown in component_breakdown.values():
        breakdown.adequately_covered = breakdown.coverage_score >= breakdown.required_coverage_score
        breakdown.uncovered = not breakdown.adequately_covered

    total_components = len(component_breakdown)
    components_with_cases = len(covered_components)
    adequately_covered_components = sum(1 for row in component_breakdown.values() if row.adequately_covered)
    uncovered_components = total_components - adequately_covered_components
    high_risk_uncovered_components = sum(
        1
        for row in component_breakdown.values()
        if row.uncovered and row.risk_level in {ComponentRiskLevel.high, ComponentRiskLevel.critical}
    )
    coverage_score_total = sum(row.coverage_score for row in component_breakdown.values())
    required_coverage_score_total = sum(row.required_coverage_score for row in component_breakdown.values())

    return ProductSummaryRead(
        product_id=product_id,
        total_components=total_components,
        core_components=core_components,
        components_with_cases=components_with_cases,
        adequately_covered_components=adequately_covered_components,
        inadequately_covered_components=uncovered_components,
        uncovered_components=uncovered_components,
        high_risk_uncovered_components=high_risk_uncovered_components,
        coverage_score_total=coverage_score_total,
        required_coverage_score_total=required_coverage_score_total,
        total_cases=len(total_cases),
        mandatory_release_cases=len(mandatory_cases),
        smoke_cases=len(smoke_cases),
        regression_cases=len(regression_cases),
        deep_cases=len(deep_cases),
        manual_cases=len(manual_cases),
        automated_cases=len(automated_cases),
        per_component_breakdown=sorted(component_breakdown.values(), key=lambda item: item.component_name.lower()),
    )
