"""Integration tests for the attachments API (/api/v1/attachments)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ProjectMemberRole
from app.modules.attachments.models import Attachment
from app.modules.projects.models import Project, ProjectMember, User
from app.modules.test_cases.models import TestCase, TestCaseStep

from tests.async_db_helpers import session_scalar


async def test_test_case_attachment_flow(client, db_session: AsyncSession, auth_user: User, auth_headers, tmp_path):
    project = Project(id="proj_attach_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    test_case = TestCase(id="tc_attach_1", project_id=project.id, suite_id=None, key="PAT-TC-1", title="Case", tags=[])
    db_session.add_all([project, membership, test_case])
    await db_session.commit()

    uploaded = await client.post(
        "/api/v1/attachments",
        data={"test_case_id": test_case.id},
        files={"file": ("evidence.txt", b"hello", "text/plain")},
        headers=auth_headers,
    )
    assert uploaded.status_code == 201
    attachment = uploaded.json()
    assert attachment["filename"] == "evidence.txt"
    assert attachment["size"] == 5

    listed = await client.get(
        f"/api/v1/attachments?test_case_id={test_case.id}",
        headers=auth_headers,
    )
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1

    downloaded = await client.get(
        f"/api/v1/attachments/{attachment['id']}",
        headers=auth_headers,
    )
    assert downloaded.status_code == 200
    assert downloaded.content == b"hello"
    assert "evidence.txt" in downloaded.headers["content-disposition"]

    stored = await session_scalar(db_session, select(Attachment).where(Attachment.id == attachment["id"]))
    assert stored is not None
    assert (tmp_path / stored.storage_key).is_file()

    deleted = await client.delete(
        f"/api/v1/attachments/{attachment['id']}",
        headers=auth_headers,
    )
    assert deleted.status_code == 204
    assert await session_scalar(db_session, select(Attachment).where(Attachment.id == attachment["id"])) is None
    assert not (tmp_path / stored.storage_key).exists()


async def test_step_attachment_is_deleted_on_steps_replace(
    client,
    db_session: AsyncSession,
    auth_user: User,
    auth_headers,
    tmp_path,
):
    project = Project(id="proj_steps_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    test_case = TestCase(id="tc_steps_1", project_id=project.id, suite_id=None, key="PST-TC-1", title="Case", tags=[])
    step = TestCaseStep(id="step_old_1", test_case_id=test_case.id, position=1, action="Open", expected_result="Opened")
    db_session.add_all([project, membership, test_case, step])
    await db_session.commit()

    uploaded = await client.post(
        "/api/v1/attachments",
        data={"step_id": step.id},
        files={"file": ("step.txt", b"step-file", "text/plain")},
        headers=auth_headers,
    )
    assert uploaded.status_code == 201
    attachment_id = uploaded.json()["id"]
    stored = await session_scalar(db_session, select(Attachment).where(Attachment.id == attachment_id))
    assert stored is not None
    stored_path = tmp_path / stored.storage_key
    assert stored_path.is_file()

    replaced = await client.put(
        f"/api/v1/test-cases/{test_case.id}/steps",
        json={"steps": [{"position": 1, "action": "New", "expected_result": "Done"}]},
        headers=auth_headers,
    )
    assert replaced.status_code == 200
    assert await session_scalar(db_session, select(Attachment).where(Attachment.id == attachment_id)) is None
    assert not stored_path.exists()


async def test_attachment_size_limits(client, db_session: AsyncSession, auth_user: User, auth_headers, monkeypatch):
    project = Project(id="proj_limits_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    test_case = TestCase(
        id="tc_limits_1",
        project_id=project.id,
        suite_id=None,
        key="PLM-TC-1",
        title="Case",
        tags=[],
    )
    step = TestCaseStep(id="step_limits_1", test_case_id=test_case.id, position=1, action="A", expected_result="B")
    db_session.add_all([project, membership, test_case, step])
    tc_id = test_case.id
    step_id = step.id
    await db_session.commit()

    from app.models.enums import AttachmentOwnerType
    from app.modules.attachments.services import attachments

    monkeypatch.setitem(attachments.ATTACHMENT_MAX_BYTES, AttachmentOwnerType.test_case, 4)
    monkeypatch.setitem(attachments.ATTACHMENT_MAX_BYTES, AttachmentOwnerType.step, 4)
    monkeypatch.setitem(attachments.ATTACHMENT_MAX_BYTES, AttachmentOwnerType.run_case, 4)

    too_large_case = await client.post(
        "/api/v1/attachments",
        data={"test_case_id": tc_id},
        files={"file": ("big.txt", b"12345", "text/plain")},
        headers=auth_headers,
    )
    assert too_large_case.status_code == 413
    assert too_large_case.json()["code"] == "attachment_too_large"

    too_large_step = await client.post(
        "/api/v1/attachments",
        data={"step_id": step_id},
        files={"file": ("big.txt", b"12345", "text/plain")},
        headers=auth_headers,
    )
    assert too_large_step.status_code == 413
    assert too_large_step.json()["code"] == "attachment_too_large"


async def test_draft_step_attachment_is_bound_on_steps_replace(
    client,
    db_session: AsyncSession,
    auth_user: User,
    auth_headers,
):
    project = Project(id="proj_draft_steps_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    test_case = TestCase(id="tc_draft_steps_1", project_id=project.id, suite_id=None, key="PDS-TC-1", title="Case", tags=[])
    db_session.add_all([project, membership, test_case])
    await db_session.commit()

    uploaded = await client.post(
        "/api/v1/attachments",
        data={"test_case_id": test_case.id, "draft_step_client_id": "local-step-1"},
        files={"file": ("screen.png", b"png-data", "image/png")},
        headers=auth_headers,
    )
    assert uploaded.status_code == 201
    attachment = uploaded.json()

    replaced = await client.put(
        f"/api/v1/test-cases/{test_case.id}/steps",
        json={
            "steps": [
                {
                    "position": 1,
                    "client_id": "local-step-1",
                    "action": f"![screen](/attachments/{attachment['id']})",
                    "expected_result": "",
                }
            ]
        },
        headers=auth_headers,
    )
    assert replaced.status_code == 200
    saved_step = replaced.json()["steps"][0]
    assert f"/attachments/{attachment['id']}" in saved_step["action"]

    stored = await session_scalar(db_session, select(Attachment).where(Attachment.id == attachment["id"]))
    assert stored is not None
    assert stored.owner_type.value == "step"
    assert stored.owner_id == saved_step["id"]

    downloaded = await client.get(
        f"/api/v1/attachments/{attachment['id']}",
        headers=auth_headers,
    )
    assert downloaded.status_code == 200
    assert downloaded.content == b"png-data"


async def test_attachments_list_requires_target(client, auth_headers):
    """GET /attachments without target returns 422."""
    response = await client.get("/api/v1/attachments", headers=auth_headers)
    assert response.status_code == 422
    assert response.json()["code"] == "attachment_target_required"


async def test_attachments_list_rejects_mixed_target(client, auth_headers):
    """GET /attachments with mixed target params returns 422."""
    response = await client.get(
        "/api/v1/attachments?test_case_id=tc1&step_id=step1",
        headers=auth_headers,
    )
    assert response.status_code == 422
    assert response.json()["code"] == "attachment_target_invalid"


async def test_attachments_post_requires_target(client, auth_headers):
    """POST /attachments without target returns 422."""
    response = await client.post(
        "/api/v1/attachments",
        files={"file": ("x.txt", b"data", "text/plain")},
        headers=auth_headers,
    )
    assert response.status_code == 422
    assert response.json()["code"] == "attachment_target_required"


async def test_attachments_post_rejects_draft_step_without_test_case(client, auth_headers):
    """POST /attachments with draft_step_client_id but no test_case_id returns 422."""
    response = await client.post(
        "/api/v1/attachments",
        data={"draft_step_client_id": "local-1"},
        files={"file": ("x.txt", b"data", "text/plain")},
        headers=auth_headers,
    )
    assert response.status_code == 422
