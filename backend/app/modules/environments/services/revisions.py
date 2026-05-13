from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.environments.models import (
    Environment,
    EnvironmentEdge,
    EnvironmentEntity,
    EnvironmentRevision,
)
from app.modules.environments.repositories import environments as environment_repo
from app.modules.environments.services.snapshot import (
    ENVIRONMENT_DATA_SCHEMA_VERSION,
    derive_entities_and_edges,
    snapshot_hash,
)
from app.modules.projects.models import User


async def create_revision(
    db: AsyncSession,
    *,
    environment: Environment,
    snapshot_payload: dict[str, Any],
    current_user: User,
    revision_note: str | None = None,
) -> EnvironmentRevision:
    await environment_repo.mark_all_revisions_not_current(db, environment.id)
    next_revision_number = max(0, environment.current_revision_number) + 1
    env_section = dict(snapshot_payload.get("environment", {}))
    env_section["schema_version"] = environment.schema_version
    snapshot_payload = {**snapshot_payload, "environment": env_section}
    environment_data = env_section
    environment.schema_version = int(environment_data.get("schema_version") or ENVIRONMENT_DATA_SCHEMA_VERSION)
    environment.tags = list(environment_data.get("tags") or [])
    environment.use_cases = list(environment_data.get("use_cases") or [])
    environment.topology = snapshot_payload.get("topology", {})
    environment.meta = environment_data.get("meta") or {}
    environment.extra = environment_data.get("extra") or {}
    environment.current_revision_number = next_revision_number

    revision = EnvironmentRevision(
        environment_id=environment.id,
        revision_number=next_revision_number,
        schema_version=environment.schema_version,
        is_current=True,
        revision_note=revision_note,
        full_snapshot=snapshot_payload,
        snapshot_hash=snapshot_hash(snapshot_payload),
        extra={},
        created_by=current_user.id,
    )
    db.add(revision)
    await db.flush()

    entities_payload, edges_payload = derive_entities_and_edges(snapshot_payload)
    for item in entities_payload:
        db.add(
            EnvironmentEntity(
                environment_revision_id=revision.id,
                entity_key=item["entity_key"],
                entity_type=item["entity_type"],
                name=item.get("name"),
                role=item.get("role"),
                spec=item.get("spec") or {},
                extra=item.get("extra") or {},
            )
        )
    for item in edges_payload:
        db.add(
            EnvironmentEdge(
                environment_revision_id=revision.id,
                from_entity_key=item["from_entity_key"],
                to_entity_key=item["to_entity_key"],
                relation_type=item["relation_type"],
                spec=item.get("spec") or {},
                extra=item.get("extra") or {},
            )
        )
    await db.flush()
    # Eager-load collections for AsyncSession (avoid lazy IO in presenters).
    await db.refresh(revision, attribute_names=["entities", "edges"])
    return revision
