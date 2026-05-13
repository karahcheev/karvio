from __future__ import annotations

from app.models.enums import ComponentRiskLevel

from .catalog import (
    get_component_by_id,
    get_product_by_id,
    list_all_component_dependencies_for_project,
    list_component_dependencies,
    list_components,
    list_product_components,
    list_products,
)
from .graph import (
    collect_dependency_expansion,
    list_active_cases_by_ids,
    list_component_ids_for_product,
    list_components_by_ids,
    list_coverages_for_components,
    list_dependencies_for_sources,
    list_links_for_products,
    map_component_ids_by_product,
)
from .summary import (
    build_product_summary_rows,
    count_component_links_for_products,
    list_case_coverages_for_components,
    list_product_summary_snapshots,
    risk_level_for_case_component_pairs,
)


RISK_ORDER: dict[ComponentRiskLevel, int] = {
    ComponentRiskLevel.low: 1,
    ComponentRiskLevel.medium: 2,
    ComponentRiskLevel.high: 3,
    ComponentRiskLevel.critical: 4,
}


__all__ = [
    "RISK_ORDER",
    "build_product_summary_rows",
    "collect_dependency_expansion",
    "count_component_links_for_products",
    "get_component_by_id",
    "get_product_by_id",
    "list_active_cases_by_ids",
    "list_case_coverages_for_components",
    "list_all_component_dependencies_for_project",
    "list_component_dependencies",
    "list_component_ids_for_product",
    "list_components",
    "list_components_by_ids",
    "list_coverages_for_components",
    "list_dependencies_for_sources",
    "list_links_for_products",
    "list_product_components",
    "list_product_summary_snapshots",
    "list_products",
    "map_component_ids_by_product",
    "risk_level_for_case_component_pairs",
]
