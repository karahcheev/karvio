"""Plan generation: component resolution and preview building."""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.models.enums import ComponentRiskLevel, PlanGenerationMode, TestCaseStatus
from app.modules.products.models import Product
from app.modules.products.repositories import products as product_repo
from app.modules.products.schemas.plan import (
    ExcludedCaseReason,
    IncludedCaseReason,
    PlanGenerationConfig,
    PlanGenerationPreviewRead,
)
from app.modules.products.services.risk import PRIORITY_RANK, RISK_RANK, _risk_threshold_allowed
from app.modules.test_cases.models import TestCase


async def resolve_generation_components(
    db: AsyncSession,
    *,
    project_id: str,
    config: PlanGenerationConfig,
) -> tuple[set[str], set[str], set[str]]:
    selected_product_ids = [value for value in dict.fromkeys(config.product_ids) if value]
    selected_component_ids = [value for value in dict.fromkeys(config.component_ids) if value]

    if selected_product_ids:
        products = await db.scalars(select(Product).where(Product.id.in_(selected_product_ids)))
        products_list = list(products.all())
        if len(products_list) != len(selected_product_ids) or any(p.project_id != project_id for p in products_list):
            raise DomainError(
                status_code=422,
                code="product_project_mismatch",
                title="Validation error",
                detail="Selected products must belong to the project",
            )

    selected_components = await product_repo.list_components_by_ids(db, selected_component_ids)
    if selected_component_ids and (
        len(selected_components) != len(selected_component_ids)
        or any(component.project_id != project_id for component in selected_components)
    ):
        raise DomainError(
            status_code=422,
            code="component_project_mismatch",
            title="Validation error",
            detail="Selected components must belong to the project",
        )

    product_component_ids: set[str] = set()
    if selected_product_ids:
        links = await product_repo.list_links_for_products(db, selected_product_ids)
        product_component_ids = {item.component_id for item in links}

    base_components: set[str]
    if selected_product_ids and not selected_component_ids:
        base_components = set(product_component_ids)
    elif selected_component_ids and not selected_product_ids:
        base_components = {item.id for item in selected_components}
    elif selected_product_ids and selected_component_ids:
        base_components = set(selected_component_ids) & product_component_ids
    else:
        base_components = set()

    dependency_components: set[str] = set()
    resolved_components = set(base_components)
    if config.include_dependent_components and resolved_components:
        expanded = await product_repo.collect_dependency_expansion(db, component_ids=resolved_components)
        dependency_components = expanded - resolved_components
        resolved_components = expanded

    if config.minimum_risk_level is not None and resolved_components:
        component_rows = await product_repo.list_components_by_ids(db, list(resolved_components))
        allowed = {
            item.id
            for item in component_rows
            if _risk_threshold_allowed(item.risk_level, config.minimum_risk_level)
        }
        resolved_components = allowed
        base_components &= allowed
        dependency_components &= allowed

    return resolved_components, base_components, dependency_components


async def _build_plan_generation_preview(
    db: AsyncSession,
    *,
    project_id: str,
    config: PlanGenerationConfig,
) -> tuple[PlanGenerationPreviewRead, dict[str, list[str]]]:
    """Build plan generation preview (no auth — caller must check access)."""
    resolved_component_ids, base_component_ids, dependency_component_ids = await resolve_generation_components(
        db,
        project_id=project_id,
        config=config,
    )

    coverage_rows = await product_repo.list_case_coverages_for_components(
        db,
        component_ids=list(resolved_component_ids),
    )

    case_meta: dict[str, dict[str, object]] = {}
    include_reasons: dict[str, set[str]] = defaultdict(set)
    included_by_rules: set[str] = set()

    for coverage, component, test_case in coverage_rows:
        if test_case.project_id != project_id or test_case.status != TestCaseStatus.active:
            continue
        meta = case_meta.setdefault(
            test_case.id,
            {
                "case": test_case,
                "component_ids": set(),
                "highest_risk_level": ComponentRiskLevel.low,
                "highest_risk_score": 0,
                "mandatory": False,
                "has_smoke": False,
            },
        )
        component_ids = meta["component_ids"]
        assert isinstance(component_ids, set)
        component_ids.add(component.id)

        if component.id in base_component_ids:
            include_reasons[test_case.id].add("component_match")
        if component.id in dependency_component_ids:
            include_reasons[test_case.id].add("dependency_match")
        if config.product_ids:
            include_reasons[test_case.id].add("product_match")
        if config.minimum_risk_level is not None:
            include_reasons[test_case.id].add("risk_threshold")

        current_risk_level = meta["highest_risk_level"]
        current_risk_score = meta["highest_risk_score"]
        if (
            RISK_RANK[component.risk_level] > RISK_RANK[current_risk_level]
            or (
                component.risk_level == current_risk_level
                and component.risk_score > current_risk_score
            )
        ):
            meta["highest_risk_level"] = component.risk_level
            meta["highest_risk_score"] = component.risk_score

        if coverage.is_mandatory_for_release:
            meta["mandatory"] = True
            include_reasons[test_case.id].add("mandatory_release")
        if coverage.coverage_strength.value == "smoke":
            meta["has_smoke"] = True

    for case_id, meta in case_meta.items():
        mandatory = bool(meta["mandatory"])
        has_smoke = bool(meta["has_smoke"])
        risk_level = meta["highest_risk_level"]

        include = False
        if config.generation_mode == PlanGenerationMode.full:
            include = True
        elif config.generation_mode == PlanGenerationMode.regression:
            include = True
            include_reasons[case_id].add("regression_rule")
        elif config.generation_mode == PlanGenerationMode.smoke:
            include = mandatory or has_smoke or risk_level in {ComponentRiskLevel.high, ComponentRiskLevel.critical}
            if include:
                include_reasons[case_id].add("smoke_rule")

        if include:
            included_by_rules.add(case_id)

    explicit_includes = [value for value in dict.fromkeys(config.explicit_include_case_ids) if value]
    if explicit_includes:
        include_rows = await db.scalars(
            select(TestCase).where(
                TestCase.id.in_(explicit_includes),
                TestCase.project_id == project_id,
                TestCase.status == TestCaseStatus.active,
            )
        )
        for case in include_rows.all():
            case_meta.setdefault(
                case.id,
                {
                    "case": case,
                    "component_ids": set(),
                    "highest_risk_level": ComponentRiskLevel.low,
                    "highest_risk_score": 0,
                    "mandatory": False,
                    "has_smoke": False,
                },
            )
            included_by_rules.add(case.id)
            include_reasons[case.id].add("explicit_include")

    excluded_case_ids = [value for value in dict.fromkeys(config.explicit_exclude_case_ids) if value]
    excluded_set = set(excluded_case_ids)

    final_included = [case_id for case_id in included_by_rules if case_id not in excluded_set]

    def ordering_key(case_id: str) -> tuple[int, int, int, str]:
        meta = case_meta[case_id]
        case = meta["case"]
        mandatory = 1 if meta["mandatory"] else 0
        risk_score = int(meta["highest_risk_score"])
        priority_rank = PRIORITY_RANK.get(case.priority, 0)
        return (-mandatory, -risk_score, -priority_rank, case.key)

    final_included_sorted = sorted(final_included, key=ordering_key)

    included_payload: list[IncludedCaseReason] = []
    for case_id in final_included_sorted:
        meta = case_meta[case_id]
        included_payload.append(
            IncludedCaseReason(
                test_case_id=case_id,
                reason_codes=sorted(include_reasons[case_id]),
                matched_component_ids=sorted(meta["component_ids"]),
                highest_component_risk_level=meta["highest_risk_level"],
                highest_component_risk_score=int(meta["highest_risk_score"]),
            )
        )

    excluded_payload = [
        ExcludedCaseReason(test_case_id=case_id, reason="explicit_exclude")
        for case_id in excluded_case_ids
        if case_id in included_by_rules
    ]

    reason_map = {item.test_case_id: item.reason_codes for item in included_payload}
    preview = PlanGenerationPreviewRead(
        resolved_component_ids=sorted(resolved_component_ids),
        resolved_case_ids=final_included_sorted,
        included_cases=included_payload,
        excluded_cases=excluded_payload,
        summary={
            "resolved_components": len(resolved_component_ids),
            "candidate_cases": len(case_meta),
            "included_cases": len(final_included_sorted),
            "excluded_cases": len(excluded_payload),
        },
    )
    return preview, reason_map
