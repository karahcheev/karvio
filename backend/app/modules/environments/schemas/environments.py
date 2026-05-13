from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.core.domain_strings import MSG_VALIDATION_MUST_NOT_BE_EMPTY


def _normalize_string_list(values: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        stripped = value.strip()
        if not stripped:
            continue
        key = stripped.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(stripped)
    return normalized


def _strip_optional_string(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


class EnvironmentNode(BaseModel):
    name: str | None = None
    host_type: str = Field(
        ...,
        description="Examples: baremetal, vm, container, cloud_service, managed_service",
    )
    role: str | None = None
    provider: str | None = None
    region: str | None = None
    endpoint: str | None = None
    count: int = Field(default=1, ge=1)
    resources: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {"extra": "allow"}

    @field_validator("name", "role", "provider", "region", "endpoint", mode="before")
    @classmethod
    def _strip_optional_fields(cls, value: Any) -> Any:
        if isinstance(value, str):
            return _strip_optional_string(value)
        return value

    @field_validator("host_type")
    @classmethod
    def _validate_host_type(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("host_type must not be empty")
        return stripped

    @field_validator("tags")
    @classmethod
    def _normalize_tags(cls, values: list[str]) -> list[str]:
        return _normalize_string_list(values)


class EnvironmentComponent(BaseModel):
    name: str
    component_type: str | None = None
    nodes: list[EnvironmentNode] = Field(default_factory=list)
    endpoints: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {"extra": "allow"}

    @field_validator("name", "component_type", mode="before")
    @classmethod
    def _strip_names(cls, value: Any) -> Any:
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                raise ValueError(MSG_VALIDATION_MUST_NOT_BE_EMPTY)
            return stripped
        return value

    @field_validator("endpoints")
    @classmethod
    def _normalize_endpoints(cls, values: list[str]) -> list[str]:
        return _normalize_string_list(values)

    @field_validator("tags")
    @classmethod
    def _normalize_tags(cls, values: list[str]) -> list[str]:
        return _normalize_string_list(values)


class EnvironmentTopology(BaseModel):
    load_generators: list[EnvironmentComponent] = Field(default_factory=list)
    system_under_test: list[EnvironmentComponent] = Field(default_factory=list)
    supporting_services: list[EnvironmentComponent] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {"extra": "allow"}


class EnvironmentCreate(BaseModel):
    project_id: str
    name: str
    kind: str = "custom"
    status: str = "active"
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    use_cases: list[str] = Field(default_factory=list)
    topology: EnvironmentTopology = Field(default_factory=EnvironmentTopology)
    meta: dict[str, Any] = Field(default_factory=dict)
    extra: dict[str, Any] = Field(default_factory=dict)

    model_config = {"extra": "forbid"}

    @field_validator("name", "kind", "status")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError(MSG_VALIDATION_MUST_NOT_BE_EMPTY)
        return stripped

    @field_validator("description", mode="before")
    @classmethod
    def _strip_description(cls, value: Any) -> Any:
        if isinstance(value, str):
            return _strip_optional_string(value)
        return value

    @field_validator("tags", "use_cases")
    @classmethod
    def _normalize_string_fields(cls, values: list[str]) -> list[str]:
        return _normalize_string_list(values)


class EnvironmentPatch(BaseModel):
    name: str | None = None
    kind: str | None = None
    status: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    use_cases: list[str] | None = None
    topology: EnvironmentTopology | None = None
    meta: dict[str, Any] | None = None
    extra: dict[str, Any] | None = None

    model_config = {"extra": "forbid"}

    @field_validator("name", "kind", "status", mode="before")
    @classmethod
    def _strip_name(cls, value: Any) -> Any:
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                raise ValueError(MSG_VALIDATION_MUST_NOT_BE_EMPTY)
            return stripped
        return value

    @field_validator("description", mode="before")
    @classmethod
    def _strip_description(cls, value: Any) -> Any:
        if isinstance(value, str):
            return _strip_optional_string(value)
        return value

    @field_validator("tags", "use_cases")
    @classmethod
    def _normalize_string_fields(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        return _normalize_string_list(values)


class EnvironmentRead(BaseModel):
    id: str
    project_id: str
    name: str
    kind: str = "custom"
    status: str = "active"
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    use_cases: list[str] = Field(default_factory=list)
    schema_version: int = 1
    topology: EnvironmentTopology = Field(default_factory=EnvironmentTopology)
    meta: dict[str, Any] = Field(default_factory=dict)
    extra: dict[str, Any] = Field(default_factory=dict)
    current_revision_number: int = 0
    current_revision_id: str | None = None
    snapshot_hash: str | None = None
    entities_count: int = 0
    edges_count: int = 0
    topology_component_count: int = 0
    topology_node_count: int = 0
    topology_endpoint_count: int = 0
    infra_host_types: list[str] = Field(default_factory=list)
    infra_providers: list[str] = Field(default_factory=list)
    infra_regions: list[str] = Field(default_factory=list)
    created_by: str | None = None
    updated_by: str | None = None
    archived_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EnvironmentsList(BaseModel):
    items: list[EnvironmentRead] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_next: bool = False
    total: int = 0


class EnvironmentUseCasesList(BaseModel):
    items: list[str] = Field(default_factory=list)


class EnvironmentEntityRead(BaseModel):
    id: str
    entity_key: str
    entity_type: str
    name: str | None = None
    role: str | None = None
    spec: dict[str, Any] = Field(default_factory=dict)
    extra: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = {"from_attributes": True}


class EnvironmentEdgeRead(BaseModel):
    id: str
    from_entity_key: str
    to_entity_key: str
    relation_type: str
    spec: dict[str, Any] = Field(default_factory=dict)
    extra: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = {"from_attributes": True}


class EnvironmentRevisionRead(BaseModel):
    id: str
    environment_id: str
    revision_number: int
    schema_version: int
    is_current: bool
    revision_note: str | None = None
    full_snapshot: dict[str, Any] = Field(default_factory=dict)
    snapshot_hash: str
    extra: dict[str, Any] = Field(default_factory=dict)
    entities: list[EnvironmentEntityRead] = Field(default_factory=list)
    edges: list[EnvironmentEdgeRead] = Field(default_factory=list)
    created_by: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EnvironmentRevisionsList(BaseModel):
    items: list[EnvironmentRevisionRead] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_next: bool = False
