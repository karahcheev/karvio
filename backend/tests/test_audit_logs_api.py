
from procrastinate.testing import InMemoryConnector
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import AuditActorType, AuditQueueStatus, AuditResult, ProjectMemberRole
from app.modules.audit.models import AuditLog, AuditLogQueueEntry
from app.modules.audit.services import audit as audit_service
from app.modules.audit.tasks import process_audit_queue_entry_task
from app.modules.projects.models import Project, ProjectMember, User


async def test_audit_logs_endpoint_requires_project_scope_for_non_admin(client, auth_headers):
    response = await client.get("/api/v1/audit-logs", headers=auth_headers)
    assert response.status_code == 400
    assert response.json()["code"] == "missing_project_id"


async def test_audit_logs_non_admin_is_scoped_to_member_project(
    client,
    db_session: AsyncSession,
    auth_user: User,
    auth_headers,
):
    project_allowed = Project(id="audit_scope_project_a", name="Audit Scope A")
    project_denied = Project(id="audit_scope_project_b", name="Audit Scope B")
    membership = ProjectMember(
        project_id=project_allowed.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.viewer,
    )
    log_allowed = AuditLog(
        event_id="audit_scope_event_a",
        actor_id=auth_user.id,
        actor_type=AuditActorType.user,
        action="test_case.update",
        resource_type="test_case",
        resource_id="tc_1",
        result=AuditResult.success,
        tenant_id=project_allowed.id,
        request_id="req-allow",
    )
    log_denied = AuditLog(
        event_id="audit_scope_event_b",
        actor_id=auth_user.id,
        actor_type=AuditActorType.user,
        action="test_case.update",
        resource_type="test_case",
        resource_id="tc_2",
        result=AuditResult.success,
        tenant_id=project_denied.id,
        request_id="req-deny",
    )
    db_session.add_all([project_allowed, project_denied, membership, log_allowed, log_denied])
    await db_session.commit()

    allowed = await client.get("/api/v1/audit-logs", params={"project_id": project_allowed.id}, headers=auth_headers)
    assert allowed.status_code == 200
    assert [item["event_id"] for item in allowed.json()["items"]] == [log_allowed.event_id]

    denied = await client.get("/api/v1/audit-logs", params={"project_id": project_denied.id}, headers=auth_headers)
    assert denied.status_code == 403
    assert denied.json()["code"] == "project_access_denied"


async def test_audit_logs_capture_user_create_with_masked_sensitive_fields(
    client,
    db_session: AsyncSession,
    admin_user: User,
    admin_headers,
    _in_memory_queue: InMemoryConnector,
):
    created = await client.post(
        "/api/v1/users",
        json={
            "username": "audited_user",
            "password": "Password123!",
            "email": "audited@example.com",
        },
        headers=admin_headers,
    )
    assert created.status_code == 201
    created_user = created.json()

    queue_entry = await db_session.scalar(
        select(AuditLogQueueEntry)
        .where(AuditLogQueueEntry.status == AuditQueueStatus.pending)
        .order_by(AuditLogQueueEntry.created_at)
    )
    assert queue_entry is not None

    # The after-commit callback must defer a procrastinate job for this queue entry.
    # If the queue app is not opened (or the callback raised silently), no job is
    # enqueued — and the UI will show no audit logs even though events accumulate.
    audit_jobs = [
        job
        for job in _in_memory_queue.jobs.values()
        if job["task_name"] == process_audit_queue_entry_task.name
    ]
    assert len(audit_jobs) >= 1
    assert any(job["args"] == {"queue_id": queue_entry.id} for job in audit_jobs)

    processed = await audit_service.process_queue_entry(db_session, queue_id=queue_entry.id)
    assert processed is True

    listed = await client.get(
        "/api/v1/audit-logs",
        params={"action": "user.create", "resource_id": created_user["id"]},
        headers=admin_headers,
    )
    assert listed.status_code == 200
    items = listed.json()["items"]
    assert len(items) == 1

    event = items[0]
    assert event["action"] == "user.create"
    assert event["actor_id"] == admin_user.id
    assert event["resource_type"] == "user"
    assert event["resource_id"] == created_user["id"]
    assert event["result"] == "success"
    assert event["request_id"] is not None
    assert event["after"]["password_hash"] == "***"


async def test_audit_logs_support_sorting_and_page_pagination(client, db_session: AsyncSession, admin_headers):
    actor_alpha = User(id="audit_sort_user_alpha", username="alpha", password_hash="hash")
    actor_bravo = User(id="audit_sort_user_bravo", username="bravo", password_hash="hash")
    log_alpha = AuditLog(
        event_id="audit_sort_1",
        actor_id=actor_alpha.id,
        actor_type=AuditActorType.user,
        action="project.create",
        resource_type="project",
        resource_id="proj_a",
        result=AuditResult.success,
        request_id="req-3",
    )
    log_bravo = AuditLog(
        event_id="audit_sort_2",
        actor_id=actor_bravo.id,
        actor_type=AuditActorType.user,
        action="project.delete",
        resource_type="project",
        resource_id="proj_b",
        result=AuditResult.fail,
        request_id="req-1",
    )
    log_system = AuditLog(
        event_id="audit_sort_3",
        actor_id=None,
        actor_type=AuditActorType.system,
        action="user.create",
        resource_type="user",
        resource_id="user_a",
        result=AuditResult.success,
        request_id="req-2",
    )
    db_session.add_all([actor_alpha, actor_bravo, log_alpha, log_bravo, log_system])
    await db_session.commit()

    first_page = await client.get(
        "/api/v1/audit-logs?sort_by=request_id&sort_order=asc&page=1&page_size=2",
        headers=admin_headers,
    )
    assert first_page.status_code == 200
    first_body = first_page.json()
    assert [item["request_id"] for item in first_body["items"]] == ["req-1", "req-2"]
    assert first_body["has_next"] is True

    second_page = await client.get(
        "/api/v1/audit-logs?sort_by=request_id&sort_order=asc&page=2&page_size=2",
        headers=admin_headers,
    )
    assert second_page.status_code == 200
    assert [item["request_id"] for item in second_page.json()["items"]] == ["req-3"]

    by_actor = await client.get("/api/v1/audit-logs?sort_by=actor&sort_order=asc", headers=admin_headers)
    assert by_actor.status_code == 200
    assert [item["actor_id"] for item in by_actor.json()["items"]] == [None, actor_alpha.id, actor_bravo.id]
