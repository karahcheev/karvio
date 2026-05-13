"""Lightweight application events: domain actions → audit / notification side effects.

Business services emit small frozen dataclass events via publish(); mapping to audit
queue and notification queues lives here so modules stay decoupled from plumbing.

Adding a new event:
  1. Define a frozen dataclass below.
  2. Decorate a handler with @_dispatch.register(YourEventClass).
  That's it — no isinstance chain to update, no TypeError risk.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import singledispatch
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.audit.services import audit as audit_service
from app.modules.notifications.services import settings


def snapshot_entity(entity: Any) -> dict[str, Any]:
    """ORM entity → JSON-safe dict for before/after audit payloads."""
    return audit_service.snapshot_entity(entity)


# ---------------------------------------------------------------------------
# Event dataclasses
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class TestPlanCreated:
    entity: Any


@dataclass(frozen=True, slots=True)
class TestPlanUpdated:
    entity: Any
    before_state: dict[str, Any]


@dataclass(frozen=True, slots=True)
class TestPlanDeleted:
    resource_id: str
    before_state: dict[str, Any]
    tenant_id: str


@dataclass(frozen=True, slots=True)
class TestCaseCreated:
    entity: Any


@dataclass(frozen=True, slots=True)
class TestCaseUpdated:
    entity: Any
    before_state: dict[str, Any]


@dataclass(frozen=True, slots=True)
class TestCaseDeleted:
    resource_id: str
    before_state: dict[str, Any]
    tenant_id: str


@dataclass(frozen=True, slots=True)
class TestRunCreated:
    entity: Any


@dataclass(frozen=True, slots=True)
class TestRunUpdated:
    entity: Any
    before_state: dict[str, Any]
    audit_action: str
    queue_report_notifications: bool


@dataclass(frozen=True, slots=True)
class TestRunDeleted:
    resource_id: str
    before_state: dict[str, Any]
    tenant_id: str


# ---------------------------------------------------------------------------
# Dispatch registry
# ---------------------------------------------------------------------------


@singledispatch
async def _dispatch(event: object, db: AsyncSession) -> None:
    raise TypeError(f"Unsupported application event type: {type(event)!r}")


@_dispatch.register(TestPlanCreated)
async def _(event: TestPlanCreated, db: AsyncSession) -> None:
    await audit_service.queue_create_event(
        db,
        action="test_plan.create",
        resource_type="test_plan",
        entity=event.entity,
        tenant_id=event.entity.project_id,
    )


@_dispatch.register(TestPlanUpdated)
async def _(event: TestPlanUpdated, db: AsyncSession) -> None:
    await audit_service.queue_update_event(
        db,
        action="test_plan.update",
        resource_type="test_plan",
        entity=event.entity,
        before=event.before_state,
        tenant_id=event.entity.project_id,
    )


@_dispatch.register(TestPlanDeleted)
async def _(event: TestPlanDeleted, db: AsyncSession) -> None:
    await audit_service.queue_delete_event(
        db,
        action="test_plan.delete",
        resource_type="test_plan",
        resource_id=event.resource_id,
        before=event.before_state,
        tenant_id=event.tenant_id,
    )


@_dispatch.register(TestCaseCreated)
async def _(event: TestCaseCreated, db: AsyncSession) -> None:
    await audit_service.queue_create_event(
        db,
        action="test_case.create",
        resource_type="test_case",
        entity=event.entity,
        tenant_id=event.entity.project_id,
    )


@_dispatch.register(TestCaseUpdated)
async def _(event: TestCaseUpdated, db: AsyncSession) -> None:
    await audit_service.queue_update_event(
        db,
        action="test_case.update",
        resource_type="test_case",
        entity=event.entity,
        before=event.before_state,
        tenant_id=event.entity.project_id,
    )


@_dispatch.register(TestCaseDeleted)
async def _(event: TestCaseDeleted, db: AsyncSession) -> None:
    await audit_service.queue_delete_event(
        db,
        action="test_case.delete",
        resource_type="test_case",
        resource_id=event.resource_id,
        before=event.before_state,
        tenant_id=event.tenant_id,
    )


@_dispatch.register(TestRunCreated)
async def _(event: TestRunCreated, db: AsyncSession) -> None:
    await audit_service.queue_create_event(
        db,
        action="test_run.create",
        resource_type="test_run",
        entity=event.entity,
        tenant_id=event.entity.project_id,
    )


@_dispatch.register(TestRunUpdated)
async def _(event: TestRunUpdated, db: AsyncSession) -> None:
    await audit_service.queue_update_event(
        db,
        action=event.audit_action,
        resource_type="test_run",
        entity=event.entity,
        before=event.before_state,
        tenant_id=event.entity.project_id,
    )
    if event.queue_report_notifications:
        await settings.queue_test_run_report_notifications(db, test_run_id=event.entity.id)


@_dispatch.register(TestRunDeleted)
async def _(event: TestRunDeleted, db: AsyncSession) -> None:
    await audit_service.queue_delete_event(
        db,
        action="test_run.delete",
        resource_type="test_run",
        resource_id=event.resource_id,
        before=event.before_state,
        tenant_id=event.tenant_id,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def publish(db: AsyncSession, event: object) -> None:
    """Apply cross-cutting side effects for one application event (same transaction)."""
    await _dispatch(event, db)
