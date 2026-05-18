from __future__ import annotations

from app.modules.environments.models import Environment, EnvironmentRevision
from app.modules.environments.schemas.environments import (
    EnvironmentEdgeRead,
    EnvironmentEntityRead,
    EnvironmentRead,
    EnvironmentRevisionRead,
    EnvironmentTopology,
)


def _topology_sections(topology_data: dict) -> list[list[dict]]:
    return [
        topology_data.get("load_generators") or [],
        topology_data.get("system_under_test") or [],
        topology_data.get("supporting_services") or [],
    ]


def _topology_counts(topology_data: dict) -> tuple[int, int, int]:
    component_count = 0
    node_count = 0
    endpoint_count = 0
    for section in _topology_sections(topology_data):
        for component in section:
            if not isinstance(component, dict):
                continue
            component_count += 1
            nodes = component.get("nodes") if isinstance(component.get("nodes"), list) else []
            endpoint_count += len(component.get("endpoints") or []) if isinstance(component.get("endpoints"), list) else 0
            for node in nodes:
                if isinstance(node, dict):
                    node_count += int(node.get("count") or 1)
                else:
                    node_count += 1
    return component_count, node_count, endpoint_count


def _topology_infra(topology_data: dict) -> tuple[list[str], list[str], list[str]]:
    host_types: set[str] = set()
    providers: set[str] = set()
    regions: set[str] = set()
    for section in _topology_sections(topology_data):
        for component in section:
            if not isinstance(component, dict):
                continue
            nodes = component.get("nodes") if isinstance(component.get("nodes"), list) else []
            for node in nodes:
                if not isinstance(node, dict):
                    continue
                host_type = node.get("host_type")
                provider = node.get("provider")
                region = node.get("region")
                if isinstance(host_type, str) and host_type.strip():
                    host_types.add(host_type.strip())
                if isinstance(provider, str) and provider.strip():
                    providers.add(provider.strip())
                if isinstance(region, str) and region.strip():
                    regions.add(region.strip())
    return sorted(host_types, key=str.lower), sorted(providers, key=str.lower), sorted(regions, key=str.lower)


def revision_to_read(revision: EnvironmentRevision) -> EnvironmentRevisionRead:
    return EnvironmentRevisionRead.model_validate(revision).model_copy(
        update={
            "entities": [EnvironmentEntityRead.model_validate(item) for item in revision.entities],
            "edges": [EnvironmentEdgeRead.model_validate(item) for item in revision.edges],
        }
    )


def environment_to_read(environment: Environment, revision: EnvironmentRevision | None) -> EnvironmentRead:
    environment_data = revision.full_snapshot.get("environment", {}) if revision else {}
    topology_data = revision.full_snapshot.get("topology", {}) if revision else {}
    topology = EnvironmentTopology.model_validate(topology_data or {})
    component_count, node_count, endpoint_count = _topology_counts(topology_data)
    infra_host_types, infra_providers, infra_regions = _topology_infra(topology_data)
    return EnvironmentRead.model_validate(environment).model_copy(
        update={
            "name": environment_data.get("name", environment.name),
            "kind": environment_data.get("kind", environment.kind),
            "status": environment_data.get("status", environment.status),
            "description": environment_data.get("description", environment.description),
            "tags": environment_data.get("tags", environment.tags),
            "use_cases": environment_data.get("use_cases", environment.use_cases),
            "schema_version": environment_data.get("schema_version", environment.schema_version),
            "topology": topology,
            "meta": environment_data.get("meta", environment.meta),
            "extra": environment_data.get("extra", environment.extra),
            "current_revision_number": revision.revision_number if revision else environment.current_revision_number,
            "current_revision_id": revision.id if revision else None,
            "snapshot_hash": revision.snapshot_hash if revision else None,
            "entities_count": len(revision.entities) if revision else 0,
            "edges_count": len(revision.edges) if revision else 0,
            "topology_component_count": component_count,
            "topology_node_count": node_count,
            "topology_endpoint_count": endpoint_count,
            "infra_host_types": infra_host_types,
            "infra_providers": infra_providers,
            "infra_regions": infra_regions,
        }
    )
