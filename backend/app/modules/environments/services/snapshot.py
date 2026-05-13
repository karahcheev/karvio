from __future__ import annotations

import hashlib
import json
from typing import Any

from app.modules.environments.models import Environment

# Bump when environment topology / snapshot JSON contract changes incompatibly.
ENVIRONMENT_DATA_SCHEMA_VERSION = 1


def snapshot_hash(payload: dict[str, Any]) -> str:
    normalized = json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def build_snapshot_payload(
    *,
    environment: Environment,
    name: str,
    kind: str,
    status: str,
    description: str | None,
    tags: list[str],
    use_cases: list[str],
    topology: dict[str, Any],
    meta: dict[str, Any],
    extra: dict[str, Any],
) -> dict[str, Any]:
    return {
        "environment": {
            "name": name,
            "kind": kind,
            "status": status,
            "description": description,
            "tags": tags,
            "use_cases": use_cases,
            "schema_version": environment.schema_version,
            "meta": meta,
            "extra": extra,
        },
        "topology": topology,
        "project_id": environment.project_id,
    }


def _append_custom_topology_entities(topology: dict[str, Any], entities: list[dict[str, Any]]) -> None:
    custom_entities_raw = topology.get("entities")
    if not isinstance(custom_entities_raw, list):
        return
    for index, item in enumerate(custom_entities_raw):
        if not isinstance(item, dict):
            continue
        entity_key = str(item.get("entity_key") or item.get("id") or f"entity:{index}")
        entities.append(
            {
                "entity_key": entity_key,
                "entity_type": str(item.get("entity_type") or "entity"),
                "name": item.get("name"),
                "role": item.get("role"),
                "spec": item.get("spec") if isinstance(item.get("spec"), dict) else item,
                "extra": item.get("extra") if isinstance(item.get("extra"), dict) else {},
            }
        )


def _append_custom_topology_edges(topology: dict[str, Any], edges: list[dict[str, Any]]) -> None:
    custom_edges_raw = topology.get("edges")
    if not isinstance(custom_edges_raw, list):
        return
    for item in custom_edges_raw:
        if not isinstance(item, dict):
            continue
        from_key = item.get("from_entity_key") or item.get("from")
        to_key = item.get("to_entity_key") or item.get("to")
        if not from_key or not to_key:
            continue
        edges.append(
            {
                "from_entity_key": str(from_key),
                "to_entity_key": str(to_key),
                "relation_type": str(item.get("relation_type") or "depends_on"),
                "spec": item.get("spec") if isinstance(item.get("spec"), dict) else item,
                "extra": item.get("extra") if isinstance(item.get("extra"), dict) else {},
            }
        )


def _append_topology_nodes_for_component(
    component: dict[str, Any],
    *,
    component_key: str,
    role: str,
    entities: list[dict[str, Any]],
    edges: list[dict[str, Any]],
) -> None:
    nodes = component.get("nodes")
    if not isinstance(nodes, list):
        return
    for node_index, node in enumerate(nodes):
        if not isinstance(node, dict):
            continue
        node_key = str(node.get("entity_key") or f"{component_key}:node:{node_index}")
        entities.append(
            {
                "entity_key": node_key,
                "entity_type": "host",
                "name": node.get("name"),
                "role": role,
                "spec": node,
                "extra": node.get("extra") if isinstance(node.get("extra"), dict) else {},
            }
        )
        edges.append(
            {
                "from_entity_key": component_key,
                "to_entity_key": node_key,
                "relation_type": "contains",
                "spec": {},
                "extra": {},
            }
        )


def _append_section_component_entity(
    component: dict[str, Any],
    *,
    section_key: str,
    comp_index: int,
    role: str,
    entities: list[dict[str, Any]],
    edges: list[dict[str, Any]],
) -> None:
    component_name = str(component.get("name") or f"{section_key}-{comp_index + 1}")
    component_key = str(component.get("entity_key") or f"{section_key}:{comp_index}")
    entities.append(
        {
            "entity_key": component_key,
            "entity_type": str(component.get("component_type") or "component"),
            "name": component_name,
            "role": role,
            "spec": component,
            "extra": component.get("extra") if isinstance(component.get("extra"), dict) else {},
        }
    )
    _append_topology_nodes_for_component(
        component,
        component_key=component_key,
        role=role,
        entities=entities,
        edges=edges,
    )


def _append_section_topology_entities(
    topology: dict[str, Any],
    entities: list[dict[str, Any]],
    edges: list[dict[str, Any]],
) -> None:
    section_roles = {
        "load_generators": "load_generator",
        "system_under_test": "system_under_test",
        "supporting_services": "dependency",
    }
    for section_key, role in section_roles.items():
        section_value = topology.get(section_key)
        if not isinstance(section_value, list):
            continue
        for comp_index, component in enumerate(section_value):
            if not isinstance(component, dict):
                continue
            _append_section_component_entity(
                component,
                section_key=section_key,
                comp_index=comp_index,
                role=role,
                entities=entities,
                edges=edges,
            )


def _deduplicate_entities_by_key(entities: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduplicated_entities: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    for item in entities:
        key = item["entity_key"]
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduplicated_entities.append(item)
    return deduplicated_entities


def derive_entities_and_edges(
    snapshot: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    topology_raw = snapshot.get("topology")
    topology = topology_raw if isinstance(topology_raw, dict) else {}
    entities: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []

    _append_custom_topology_entities(topology, entities)
    _append_custom_topology_edges(topology, edges)
    _append_section_topology_entities(topology, entities, edges)

    return _deduplicate_entities_by_key(entities), edges
