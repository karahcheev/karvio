from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.enums import ProjectMemberRole, RunItemStatus, TestCaseStatus, TestRunStatus
from app.modules.environments.models import Environment, EnvironmentRevision
from app.modules.projects.models import Project, ProjectMember, Suite, User
from app.modules.attachments.models import Attachment
from app.modules.test_cases.models import TestCase
from app.modules.test_runs.models import RunCaseRow, RunItem, TestRun
from sqlalchemy.ext.asyncio import AsyncSession

from tests.async_db_helpers import session_get, session_scalar


def _assert_extra_field_validation(response, field_name: str) -> None:
    assert response.status_code == 422
    body = response.json()
    assert body.get("code") == "validation_error"
    errors = body.get("errors", {})
    assert any(key == field_name or key.endswith(f".{field_name}") for key in errors)


async def test_version_endpoint(client):
    response = await client.get("/api/v1/version")

    assert response.status_code == 200
    assert response.json() == {"version": get_settings().app_version}


async def test_projects_flow(client, auth_headers):
    created = await client.post(
        "/api/v1/projects",
        json={"name": "E-commerce"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    project = created.json()
    project_id = project["id"]
    assert len(project_id) == 16
    assert all(ch in "0123456789abcdef" for ch in project_id)
    assert "key" not in project

    listed = await client.get("/api/v1/projects", headers=auth_headers)
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1

    got = await client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert got.status_code == 200
    assert "key" not in got.json()


async def test_create_project_rejects_id_field(client, auth_headers):
    response = await client.post(
        "/api/v1/projects",
        json={"id": "project_client_id", "name": "E-commerce"},
        headers=auth_headers,
    )
    _assert_extra_field_validation(response, "id")


async def test_create_project_member_rejects_id_field(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_member_reject_id_1", name="Proj")
    target_user = User(id="user_member_reject_id_1", username="target_member", password_hash="hash")
    manager_membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.manager,
    )
    db_session.add_all([project, target_user, manager_membership])
    await db_session.commit()

    response = await client.post(
        "/api/v1/project-members",
        json={
            "id": "project_member_client_id",
            "project_id": project.id,
            "user_id": target_user.id,
            "role": "tester",
        },
        headers=auth_headers,
    )
    _assert_extra_field_validation(response, "id")


async def test_create_suite_rejects_id_field(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_suite_reject_id_1", name="Proj")
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.tester,
    )
    db_session.add_all([project, membership])
    await db_session.commit()

    response = await client.post(
        "/api/v1/suites",
        json={
            "id": "suite_client_id",
            "project_id": project.id,
            "name": "Smoke",
            "parent_id": None,
        },
        headers=auth_headers,
    )
    _assert_extra_field_validation(response, "id")


async def test_create_test_case_rejects_id_field(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_test_case_reject_id_1", name="Proj")
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.tester,
    )
    db_session.add_all([project, membership])
    await db_session.commit()

    response = await client.post(
        "/api/v1/test-cases",
        json={
            "id": "test_case_client_id",
            "project_id": project.id,
            "title": "Case",
            "tags": [],
        },
        headers=auth_headers,
    )
    _assert_extra_field_validation(response, "id")


async def test_create_test_run_rejects_id_field(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_test_run_reject_id_1", name="Proj")
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.tester,
    )
    db_session.add_all([project, membership])
    await db_session.commit()

    response = await client.post(
        "/api/v1/test-runs",
        json={
            "id": "test_run_client_id",
            "project_id": project.id,
            "name": "Regression #1",
        },
        headers=auth_headers,
    )
    _assert_extra_field_validation(response, "id")


async def test_create_user_rejects_id_field(client, admin_headers):
    response = await client.post(
        "/api/v1/users",
        json={
            "id": "user_client_id",
            "username": "new_user",
            "password": "password123",
        },
        headers=admin_headers,
    )
    _assert_extra_field_validation(response, "id")


async def test_add_run_cases_rejects_id_field(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_run_cases_reject_id_1", name="Proj")
    run = TestRun(id="run_cases_reject_id_1", project_id=project.id, name="Run", status=TestRunStatus.not_started)
    test_case = TestCase(
        id="tc_run_cases_reject_id_1",
        project_id=project.id,
        suite_id=None,
        key="RIR-TC-1",
        title="Case",
        tags=[],
    )
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.tester,
    )
    db_session.add_all([project, run, test_case, membership])
    await db_session.commit()

    response = await client.post(
        "/api/v1/run-cases/bulk",
        json={"id": "run_case_client_id", "test_run_id": run.id, "test_case_ids": [test_case.id]},
        headers=auth_headers,
    )
    _assert_extra_field_validation(response, "id")


async def test_replace_steps_rejects_step_id_field(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_steps_reject_id_1", name="Proj")
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.tester,
    )
    test_case = TestCase(
        id="tc_steps_reject_id_1",
        project_id=project.id,
        suite_id=None,
        key="RSI-TC-1",
        title="Case",
        tags=[],
    )
    db_session.add_all([project, membership, test_case])
    await db_session.commit()

    response = await client.put(
        f"/api/v1/test-cases/{test_case.id}/steps",
        json={
            "steps": [
                {
                    "id": "step_client_id",
                    "position": 1,
                    "action": "Open",
                    "expected_result": "Opened",
                }
            ]
        },
        headers=auth_headers,
    )
    _assert_extra_field_validation(response, "id")


async def test_run_case_status_endpoint(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_123", name="Proj")
    test_case = TestCase(
        id="tc_1",
        project_id=project.id,
        suite_id=None,
        key="PRJ-TC-1",
        title="Case",
        tags=[],
    )
    run = TestRun(id="run_1", project_id=project.id, name="Run", status=TestRunStatus.in_progress)
    item = RunItem(id="ri_1", test_run_id=run.id, test_case_id=test_case.id)
    row = RunCaseRow(id="rir_1", run_case_id=item.id, row_order=1, scenario_label="row_1", row_snapshot={"datasets": []})
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.tester,
    )
    db_session.add_all([project, test_case, run, item, row, membership])
    await db_session.commit()

    response = await client.patch(
        "/api/v1/run-cases/rows/rir_1",
        json={"status": "passed", "comment": "ok", "defect_ids": [], "executed_by_id": auth_user.id},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "passed"


@pytest.mark.parametrize("run_status", [TestRunStatus.completed, TestRunStatus.archived])
async def test_run_case_status_endpoint_rejects_completed_or_archived_test_run(
    client,
    db_session: AsyncSession,
    auth_user: User,
    auth_headers,
    run_status: TestRunStatus,
):
    project = Project(id=f"proj_locked_{run_status.value}", name="Proj")
    test_case = TestCase(
        id=f"tc_locked_{run_status.value}",
        project_id=project.id,
        suite_id=None,
        key=f"PRJ-TC-{run_status.value}",
        title="Case",
        tags=[],
    )
    run = TestRun(id=f"run_locked_{run_status.value}", project_id=project.id, name="Run", status=run_status)
    item = RunItem(id=f"ri_locked_{run_status.value}", test_run_id=run.id, test_case_id=test_case.id)
    row = RunCaseRow(
        id=f"rir_locked_{run_status.value}",
        run_case_id=item.id,
        row_order=1,
        scenario_label="row_1",
        row_snapshot={"datasets": []},
    )
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.tester,
    )
    db_session.add_all([project, test_case, run, item, row, membership])
    await db_session.commit()

    response = await client.patch(
        f"/api/v1/run-cases/rows/{row.id}",
        json={"status": "passed", "comment": "ok", "defect_ids": [], "executed_by_id": auth_user.id},
        headers=auth_headers,
    )
    assert response.status_code == 409
    assert response.json()["code"] == "invalid_status_transition"
    assert "completed or archived" in response.json()["detail"]


@pytest.mark.parametrize("run_status", [TestRunStatus.completed, TestRunStatus.archived])
async def test_delete_run_case_rejects_completed_or_archived_test_run(
    client,
    db_session: AsyncSession,
    auth_user: User,
    auth_headers,
    run_status: TestRunStatus,
):
    project = Project(id=f"proj_delete_locked_{run_status.value}", name="Proj")
    test_case = TestCase(
        id=f"tc_delete_locked_{run_status.value}",
        project_id=project.id,
        suite_id=None,
        key=f"PRJ-DEL-{run_status.value}",
        title="Case",
        tags=[],
    )
    run = TestRun(id=f"run_delete_locked_{run_status.value}", project_id=project.id, name="Run", status=run_status)
    item = RunItem(id=f"ri_delete_locked_{run_status.value}", test_run_id=run.id, test_case_id=test_case.id)
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.lead,
    )
    db_session.add_all([project, test_case, run, item, membership])
    await db_session.commit()

    response = await client.delete(f"/api/v1/run-cases/{item.id}", headers=auth_headers)
    assert response.status_code == 409
    assert response.json()["code"] == "invalid_status_transition"
    assert "completed or archived" in response.json()["detail"]


async def test_create_test_run_sets_created_by(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_run_create_1", name="Proj")
    environment = Environment(
        id="env_run_create_1",
        project_id=project.id,
        name="Staging",
        status="active",
        kind="custom",
        current_revision_number=1,
        topology={},
        tags=[],
        use_cases=[],
        meta={},
        extra={},
    )
    revision = EnvironmentRevision(
        id="env_run_create_1_rev_1",
        environment_id=environment.id,
        revision_number=1,
        schema_version=1,
        is_current=True,
        full_snapshot={
            "project_id": project.id,
            "environment": {"name": "Staging", "status": "active", "kind": "custom"},
            "topology": {},
        },
        snapshot_hash="hash_env_run_create_1_rev_1",
        extra={},
    )
    run_default_assignee = User(id="user_run_create_assignee_1", username="run_create_assignee", password_hash="hash")
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.tester,
    )
    db_session.add_all([project, membership, run_default_assignee, environment, revision])
    await db_session.commit()

    response = await client.post(
        "/api/v1/test-runs",
        json={
            "project_id": project.id,
            "name": "Regression #1",
            "description": "Nightly regression",
            "environment_id": environment.id,
            "build": "1.0.0",
            "assignee": run_default_assignee.id,
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["created_by"] == auth_user.id
    assert body["assignee"] == run_default_assignee.id
    assert body["environment_id"] == environment.id
    assert body["environment_revision_number"] == 1
    assert body["environment_name"] == "Staging"


async def test_patch_test_run_planned_item_count(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_run_planned_1", name="Proj")
    run = TestRun(id="run_planned_1", project_id=project.id, name="Run", status=TestRunStatus.in_progress)
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.tester,
    )
    db_session.add_all([project, run, membership])
    await db_session.commit()

    response = await client.patch(
        f"/api/v1/test-runs/{run.id}",
        json={"planned_item_count": 42},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["planned_item_count"] == 42
    assert body["summary"] is not None


async def test_start_test_run_without_payload(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_run_start_1", name="Proj")
    run = TestRun(id="run_start_1", project_id=project.id, name="Run", status=TestRunStatus.not_started)
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.tester,
    )
    db_session.add_all([project, run, membership])
    await db_session.commit()

    response = await client.patch(
        f"/api/v1/test-runs/{run.id}",
        json={"status": "in_progress"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "in_progress"
    assert body["started_at"] is not None


async def test_add_run_cases_rejects_unknown_test_case(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_run_cases_1", name="Proj")
    run = TestRun(id="run_cases_1", project_id=project.id, name="Run", status=TestRunStatus.not_started)
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.tester,
    )
    db_session.add_all([project, run, membership])
    await db_session.commit()

    response = await client.post(
        "/api/v1/run-cases/bulk",
        json={"test_run_id": run.id, "test_case_ids": ["unknown_case"]},
        headers=auth_headers,
    )
    assert response.status_code == 404
    assert response.json()["code"] == "test_case_not_found"


@pytest.mark.parametrize("run_status", [TestRunStatus.completed, TestRunStatus.archived])
async def test_add_run_cases_rejects_completed_or_archived_test_run(
    client,
    db_session: AsyncSession,
    auth_user: User,
    auth_headers,
    run_status: TestRunStatus,
):
    project = Project(id=f"proj_run_cases_locked_{run_status.value}", name="Proj")
    run = TestRun(id=f"run_cases_locked_{run_status.value}", project_id=project.id, name="Run", status=run_status)
    test_case = TestCase(
        id=f"tc_run_cases_locked_{run_status.value}",
        project_id=project.id,
        suite_id=None,
        key=f"RUN-LOCK-{run_status.value}",
        title="Case",
        tags=[],
    )
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.tester,
    )
    db_session.add_all([project, run, test_case, membership])
    await db_session.commit()

    response = await client.post(
        "/api/v1/run-cases/bulk",
        json={"test_run_id": run.id, "test_case_ids": [test_case.id]},
        headers=auth_headers,
    )
    assert response.status_code == 409
    assert response.json()["code"] == "invalid_status_transition"
    assert "not_started or in_progress" in response.json()["detail"]


async def test_add_run_cases_allows_in_progress_test_run(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_run_cases_in_progress_1", name="Proj")
    run = TestRun(id="run_cases_in_progress_1", project_id=project.id, name="Run", status=TestRunStatus.in_progress)
    test_case = TestCase(
        id="tc_run_cases_in_progress_1",
        project_id=project.id,
        suite_id=None,
        key="RIP-TC-1",
        title="Case",
        status=TestCaseStatus.active,
        tags=[],
    )
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.tester,
    )
    db_session.add_all([project, run, test_case, membership])
    await db_session.commit()

    response = await client.post(
        "/api/v1/run-cases/bulk",
        json={"test_run_id": run.id, "test_case_ids": [test_case.id]},
        headers=auth_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["test_case_id"] == test_case.id


async def test_add_run_cases_inherit_assignee_from_test_run(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_run_cases_assignee_1", name="Proj")
    default_assignee = User(id="user_run_assignee_default", username="run_assignee_default", password_hash="hash")
    override_assignee = User(id="user_run_assignee_override", username="run_assignee_override", password_hash="hash")
    run = TestRun(
        id="run_cases_assignee_1",
        project_id=project.id,
        name="Run",
        status=TestRunStatus.not_started,
        assignee=default_assignee.id,
    )
    first_case = TestCase(
        id="tc_run_assignee_1",
        project_id=project.id,
        suite_id=None,
        key="RSA-TC-1",
        title="Case 1",
        status=TestCaseStatus.active,
        tags=[],
    )
    second_case = TestCase(
        id="tc_run_assignee_2",
        project_id=project.id,
        suite_id=None,
        key="RSA-TC-2",
        title="Case 2",
        status=TestCaseStatus.active,
        tags=[],
    )
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.tester,
    )
    db_session.add_all(
        [
            project,
            default_assignee,
            override_assignee,
            run,
            first_case,
            second_case,
            membership,
        ]
    )
    await db_session.commit()

    created = await client.post(
        "/api/v1/run-cases/bulk",
        json={"test_run_id": run.id, "test_case_ids": [first_case.id]},
        headers=auth_headers,
    )
    assert created.status_code == 201
    body = created.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["assignee_id"] == default_assignee.id

    patched = await client.patch(
        f"/api/v1/run-cases/{body['items'][0]['id']}",
        json={"assignee_id": override_assignee.id},
        headers=auth_headers,
    )
    assert patched.status_code == 200
    assert patched.json()["assignee_id"] == override_assignee.id

    second_created = await client.post(
        "/api/v1/run-cases/bulk",
        json={"test_run_id": run.id, "test_case_ids": [second_case.id]},
        headers=auth_headers,
    )
    assert second_created.status_code == 201
    assert len(second_created.json()["items"]) == 1
    assert second_created.json()["items"][0]["assignee_id"] == default_assignee.id


async def test_archive_test_run_requires_completed_status(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_run_archive_1", name="Proj")
    run = TestRun(id="run_archive_1", project_id=project.id, name="Run", status=TestRunStatus.not_started)
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.lead,
    )
    db_session.add_all([project, run, membership])
    await db_session.commit()

    response = await client.patch(
        f"/api/v1/test-runs/{run.id}",
        json={"status": "archived"},
        headers=auth_headers,
    )
    assert response.status_code == 409
    assert response.json()["code"] == "invalid_status_transition"


async def test_archive_test_run_from_completed(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_run_archive_2", name="Proj")
    run = TestRun(id="run_archive_2", project_id=project.id, name="Run", status=TestRunStatus.completed)
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.lead,
    )
    db_session.add_all([project, run, membership])
    await db_session.commit()

    response = await client.patch(
        f"/api/v1/test-runs/{run.id}",
        json={"status": "archived"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "archived"


async def test_project_members_flow(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_123", name="Proj")
    user = User(id="user_456", username="tester", password_hash="hash")
    acting_membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.manager,
    )
    db_session.add_all([project, user, acting_membership])
    await db_session.commit()

    created = await client.post(
        "/api/v1/project-members",
        json={"project_id": project.id, "user_id": user.id, "role": "tester"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    project_member = created.json()
    project_member_id = project_member["id"]
    assert project_member["project_id"] == project.id
    assert project_member["user_id"] == user.id
    assert project_member["role"] == "tester"

    listed = await client.get(f"/api/v1/project-members?project_id={project.id}", headers=auth_headers)
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 2

    got = await client.get(f"/api/v1/project-members/{project_member_id}", headers=auth_headers)
    assert got.status_code == 200
    assert got.json()["id"] == project_member_id

    patched = await client.patch(f"/api/v1/project-members/{project_member_id}", json={"role": "lead"}, headers=auth_headers)
    assert patched.status_code == 200
    assert patched.json()["role"] == "lead"

    duplicate = await client.post(
        "/api/v1/project-members",
        json={"project_id": project.id, "user_id": user.id, "role": "viewer"},
        headers=auth_headers,
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "project_member_already_exists"

    deleted = await client.delete(f"/api/v1/project-members/{project_member_id}", headers=auth_headers)
    assert deleted.status_code == 204

    missing = await client.get(f"/api/v1/project-members/{project_member_id}", headers=auth_headers)
    assert missing.status_code == 404


async def test_users_list_supports_sorting_and_page_pagination(client, db_session: AsyncSession, admin_user: User, admin_headers):
    project_a = Project(id="proj_users_sort_1", name="Project A")
    project_b = Project(id="proj_users_sort_2", name="Project B")
    alpha = User(id="user_sort_alpha", username="alpha", password_hash="hash")
    bravo = User(id="user_sort_bravo", username="bravo", password_hash="hash")
    charlie = User(id="user_sort_charlie", username="charlie", password_hash="hash")
    db_session.add_all(
        [
            project_a,
            project_b,
            alpha,
            bravo,
            charlie,
            ProjectMember(project_id=project_a.id, user_id=bravo.id, role=ProjectMemberRole.viewer),
            ProjectMember(project_id=project_a.id, user_id=charlie.id, role=ProjectMemberRole.viewer),
            ProjectMember(project_id=project_b.id, user_id=charlie.id, role=ProjectMemberRole.manager),
        ]
    )
    await db_session.commit()

    first_page = await client.get("/api/v1/users?sort_by=username&sort_order=asc&page=1&page_size=2", headers=admin_headers)
    assert first_page.status_code == 200
    first_body = first_page.json()
    assert [item["username"] for item in first_body["items"]] == ["admin", "alpha"]
    assert first_body["has_next"] is True

    second_page = await client.get(
        "/api/v1/users?sort_by=username&sort_order=asc&page=2&page_size=2",
        headers=admin_headers,
    )
    assert second_page.status_code == 200
    assert [item["username"] for item in second_page.json()["items"]] == ["bravo", "charlie"]

    by_project_count = await client.get("/api/v1/users?sort_by=project_count&sort_order=desc", headers=admin_headers)
    assert by_project_count.status_code == 200
    assert [item["username"] for item in by_project_count.json()["items"][:2]] == ["charlie", "bravo"]


async def test_projects_list_supports_sorting_and_page_pagination(client, db_session: AsyncSession, admin_headers):
    project_a = Project(id="proj_sort_alpha", name="Alpha")
    project_b = Project(id="proj_sort_bravo", name="Bravo")
    project_c = Project(id="proj_sort_charlie", name="Charlie")
    user_a = User(id="proj_sort_user_a", username="user_a", password_hash="hash")
    user_b = User(id="proj_sort_user_b", username="user_b", password_hash="hash")
    db_session.add_all(
        [
            project_a,
            project_b,
            project_c,
            user_a,
            user_b,
            ProjectMember(project_id=project_a.id, user_id=user_a.id, role=ProjectMemberRole.viewer),
            ProjectMember(project_id=project_b.id, user_id=user_a.id, role=ProjectMemberRole.viewer),
            ProjectMember(project_id=project_b.id, user_id=user_b.id, role=ProjectMemberRole.manager),
        ]
    )
    await db_session.commit()

    first_page = await client.get("/api/v1/projects?sort_by=name&sort_order=asc&page=1&page_size=2", headers=admin_headers)
    assert first_page.status_code == 200
    first_body = first_page.json()
    assert [item["name"] for item in first_body["items"]] == ["Alpha", "Bravo"]
    assert first_body["has_next"] is True

    second_page = await client.get(
        "/api/v1/projects?sort_by=name&sort_order=asc&page=2&page_size=2",
        headers=admin_headers,
    )
    assert second_page.status_code == 200
    assert [item["name"] for item in second_page.json()["items"]] == ["Charlie"]

    by_member_count = await client.get("/api/v1/projects?sort_by=members_count&sort_order=desc", headers=admin_headers)
    assert by_member_count.status_code == 200
    assert [item["name"] for item in by_member_count.json()["items"]] == ["Bravo", "Alpha", "Charlie"]


async def test_project_members_list_supports_sorting_and_page_pagination(
    client,
    db_session: AsyncSession,
    auth_user: User,
    auth_headers,
):
    project = Project(id="proj_members_sort_1", name="Proj")
    alpha = User(id="member_sort_alpha", username="alpha", password_hash="hash")
    bravo = User(id="member_sort_bravo", username="bravo", password_hash="hash")
    charlie = User(id="member_sort_charlie", username="charlie", password_hash="hash")
    db_session.add_all(
        [
            project,
            alpha,
            bravo,
            charlie,
            ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.manager),
            ProjectMember(project_id=project.id, user_id=charlie.id, role=ProjectMemberRole.viewer),
            ProjectMember(project_id=project.id, user_id=alpha.id, role=ProjectMemberRole.tester),
            ProjectMember(project_id=project.id, user_id=bravo.id, role=ProjectMemberRole.lead),
        ]
    )
    await db_session.commit()

    first_page = await client.get(
        f"/api/v1/project-members?project_id={project.id}&sort_by=username&sort_order=asc&page=1&page_size=2",
        headers=auth_headers,
    )
    assert first_page.status_code == 200
    first_body = first_page.json()
    assert [item["username"] for item in first_body["items"]] == ["alpha", "auth_user"]
    assert first_body["has_next"] is True

    second_page = await client.get(
        f"/api/v1/project-members?project_id={project.id}&sort_by=username&sort_order=asc&page=2&page_size=2",
        headers=auth_headers,
    )
    assert second_page.status_code == 200
    assert [item["username"] for item in second_page.json()["items"]] == ["bravo", "charlie"]

    by_role = await client.get(
        f"/api/v1/project-members?project_id={project.id}&sort_by=role&sort_order=asc",
        headers=auth_headers,
    )
    assert by_role.status_code == 200
    assert [item["role"] for item in by_role.json()["items"]] == ["lead", "manager", "tester", "viewer"]


async def test_users_list_includes_profile_and_project_memberships(
    client,
    db_session: AsyncSession,
    auth_user: User,
    admin_headers,
):
    auth_user.first_name = "Ivan"
    auth_user.last_name = "Petrov"
    auth_user.email = "ivan.petrov@example.com"
    auth_user.team = "QA"
    project = Project(id="proj_user_meta_1", name="Billing")
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.manager,
    )
    db_session.add_all([project, membership])
    await db_session.commit()

    response = await client.get("/api/v1/users", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()

    user_item = next((item for item in body["items"] if item["id"] == auth_user.id), None)
    assert user_item is not None
    assert user_item["first_name"] == "Ivan"
    assert user_item["last_name"] == "Petrov"
    assert user_item["email"] == "ivan.petrov@example.com"
    assert user_item["team"] == "QA"
    assert user_item["project_memberships"] == [
        {
            "project_id": project.id,
            "project_name": "Billing",
            "role": "manager",
        }
    ]


async def test_non_admin_cannot_list_users(client, auth_headers):
    response = await client.get("/api/v1/users", headers=auth_headers)
    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"


async def test_non_admin_cannot_create_user(client, auth_headers):
    response = await client.post(
        "/api/v1/users",
        json={"username": "new_user", "password": "Password123!"},
        headers=auth_headers,
    )
    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"


async def test_cannot_delete_default_admin_user(client, admin_headers, admin_user: User):
    response = await client.delete(f"/api/v1/users/{admin_user.id}", headers=admin_headers)
    assert response.status_code == 403
    assert response.json()["code"] == "default_admin_protected"


async def test_disabled_user_cannot_login(client, db_session: AsyncSession):
    user = User(
        id="user_disabled_login",
        username="disabled_login",
        password_hash=hash_password("password123"),
        is_enabled=False,
    )
    db_session.add(user)
    await db_session.commit()

    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "disabled_login", "password": "password123"},
    )
    assert response.status_code == 403
    assert response.json()["code"] == "user_disabled"


async def test_login_updates_last_login_at(client, db_session: AsyncSession):
    user = User(
        id="user_login_meta_1",
        username="login_meta_user",
        password_hash=hash_password("password123"),
    )
    db_session.add(user)
    await db_session.commit()

    response = await client.post(
        "/api/v1/auth/login",
        json={"username": "login_meta_user", "password": "password123"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["last_login_at"] is not None

    await db_session.refresh(user)
    assert user.last_login_at is not None


async def test_disabled_user_token_is_rejected(client, db_session: AsyncSession):
    user = User(id="user_disabled_token", username="disabled_token", password_hash="hash", is_enabled=False)
    db_session.add(user)
    await db_session.commit()

    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {create_access_token(user.id)}"},
    )
    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token_user_disabled"


async def test_change_password_flow(client, db_session: AsyncSession, auth_user: User, auth_headers):
    wrong_current = await client.put(
        "/api/v1/users/me/password",
        json={"current_password": "wrong-password", "new_password": "NewSecret123!"},
        headers=auth_headers,
    )
    assert wrong_current.status_code == 400
    assert wrong_current.json()["code"] == "invalid_current_password"

    changed = await client.put(
        "/api/v1/users/me/password",
        json={"current_password": "password123", "new_password": "NewSecret123!"},
        headers=auth_headers,
    )
    assert changed.status_code == 204

    await db_session.refresh(auth_user)
    assert verify_password("NewSecret123!", auth_user.password_hash)


async def test_admin_can_set_user_password(client, db_session: AsyncSession, admin_headers):
    user = User(id="user_reset_pwd_1", username="reset_pwd", password_hash="hash")
    db_session.add(user)
    await db_session.commit()

    response = await client.put(
        f"/api/v1/users/{user.id}/password",
        json={"new_password": "NewSecret123!"},
        headers=admin_headers,
    )
    assert response.status_code == 204

    await db_session.refresh(user)
    assert verify_password("NewSecret123!", user.password_hash)


async def test_non_admin_cannot_set_user_password(client, db_session: AsyncSession, auth_headers):
    user = User(id="user_reset_pwd_2", username="reset_pwd_2", password_hash="hash")
    db_session.add(user)
    await db_session.commit()

    response = await client.put(
        f"/api/v1/users/{user.id}/password",
        json={"new_password": "NewSecret123!"},
        headers=auth_headers,
    )
    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"


async def test_cannot_disable_default_admin_user(client, admin_headers, admin_user: User):
    response = await client.patch(
        f"/api/v1/users/{admin_user.id}",
        json={"is_enabled": False},
        headers=admin_headers,
    )
    assert response.status_code == 403
    assert response.json()["code"] == "default_admin_protected"


async def test_cannot_delete_default_project(client, db_session: AsyncSession, admin_user: User, admin_headers):
    default_project = Project(id="proj_default_1", name="default")
    admin_membership = ProjectMember(
        project_id=default_project.id,
        user_id=admin_user.id,
        role=ProjectMemberRole.manager,
    )
    db_session.add_all([default_project, admin_membership])
    await db_session.commit()

    response = await client.delete(f"/api/v1/projects/{default_project.id}", headers=admin_headers)
    assert response.status_code == 403
    assert response.json()["code"] == "default_project_protected"


async def test_test_case_owner_and_suite_patch_flow(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_123", name="Proj")
    suite = Suite(id="suite_1", project_id=project.id, name="Smoke")
    second_user = User(id="user_456", username="tester", password_hash="hash")
    acting_membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    second_membership = ProjectMember(project_id=project.id, user_id=second_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, suite, second_user, acting_membership, second_membership])
    await db_session.commit()

    created = await client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project.id,
            "suite_id": suite.id,
            "owner_id": second_user.id,
            "title": "Case",
            "priority": "high",
            "tags": ["smoke"],
        },
        headers=auth_headers,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["suite_id"] == suite.id
    assert body["owner_id"] == second_user.id
    assert body["suite_name"] == "Smoke"
    assert body["owner_name"] == "tester"
    assert body["priority"] == "high"

    fetched = await client.get(f"/api/v1/test-cases/{body['id']}", headers=auth_headers)
    assert fetched.status_code == 200
    fetched_body = fetched.json()
    assert fetched_body["suite_name"] == "Smoke"
    assert fetched_body["owner_name"] == "tester"
    assert fetched_body["priority"] == "high"

    patched = await client.patch(
        f"/api/v1/test-cases/{body['id']}",
        json={"suite_id": None, "owner_id": None, "title": "Updated"},
        headers=auth_headers,
    )
    assert patched.status_code == 200
    patched_body = patched.json()
    assert patched_body["suite_id"] is None
    assert patched_body["owner_id"] is None
    assert patched_body["title"] == "Updated"
async def test_test_case_bulk_update_actions_flow(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_bulk_1", name="Proj")
    source_suite = Suite(id="suite_bulk_src", project_id=project.id, name="Source")
    target_suite = Suite(id="suite_bulk_dst", project_id=project.id, name="Target")
    owner_user = User(id="user_bulk_owner", username="bulk_owner", password_hash="hash")
    acting_membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    owner_membership = ProjectMember(project_id=project.id, user_id=owner_user.id, role=ProjectMemberRole.tester)
    first_case = TestCase(
        id="tc_bulk_1",
        project_id=project.id,
        suite_id=source_suite.id,
        key="BLK-TC-1",
        title="Case 1",
        tags=["smoke"],
        priority="medium",
    )
    second_case = TestCase(
        id="tc_bulk_2",
        project_id=project.id,
        suite_id=source_suite.id,
        key="BLK-TC-2",
        title="Case 2",
        tags=[],
        priority="low",
    )
    db_session.add_all(
        [
            project,
            source_suite,
            target_suite,
            owner_user,
            acting_membership,
            owner_membership,
            first_case,
            second_case,
        ]
    )
    project_id = project.id
    target_suite_id = target_suite.id
    owner_user_id = owner_user.id
    case_ids = [first_case.id, second_case.id]
    await db_session.commit()

    moved = await client.post(
        "/api/v1/test-cases/bulk",
        json={
            "project_id": project_id,
            "test_case_ids": case_ids,
            "action": "move",
            "suite_id": target_suite_id,
        },
        headers=auth_headers,
    )
    assert moved.status_code == 200
    assert moved.json()["affected_count"] == 2

    assigned = await client.post(
        "/api/v1/test-cases/bulk",
        json={
            "project_id": project_id,
            "test_case_ids": case_ids,
            "action": "set_owner",
            "owner_id": owner_user_id,
        },
        headers=auth_headers,
    )
    assert assigned.status_code == 200
    assert assigned.json()["affected_count"] == 2

    tagged = await client.post(
        "/api/v1/test-cases/bulk",
        json={
            "project_id": project_id,
            "test_case_ids": case_ids,
            "action": "add_tag",
            "tag": "regression",
        },
        headers=auth_headers,
    )
    assert tagged.status_code == 200
    assert tagged.json()["affected_count"] == 2

    prioritized = await client.post(
        "/api/v1/test-cases/bulk",
        json={
            "project_id": project_id,
            "test_case_ids": case_ids,
            "action": "set_priority",
            "priority": "high",
        },
        headers=auth_headers,
    )
    assert prioritized.status_code == 200
    assert prioritized.json()["affected_count"] == 2

    status_changed = await client.post(
        "/api/v1/test-cases/bulk",
        json={
            "project_id": project_id,
            "test_case_ids": case_ids,
            "action": "set_status",
            "status": "active",
        },
        headers=auth_headers,
    )
    assert status_changed.status_code == 200
    assert status_changed.json()["affected_count"] == 2

    db_session.expire_all()
    saved_first = await session_get(db_session, TestCase, case_ids[0])
    saved_second = await session_get(db_session, TestCase, case_ids[1])
    assert saved_first is not None
    assert saved_second is not None
    assert saved_first.suite_id == target_suite_id
    assert saved_second.suite_id == target_suite_id
    assert saved_first.owner_id == owner_user_id
    assert saved_second.owner_id == owner_user_id
    assert "regression" in saved_first.tags
    assert "regression" in saved_second.tags
    assert saved_first.priority == "high"
    assert saved_second.priority == "high"
    assert saved_first.status.value == "active"
    assert saved_second.status.value == "active"


async def test_test_case_bulk_update_multi_field_single_request(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_bulk_upd_multi", name="Proj")
    source_suite = Suite(id="suite_bulk_m_src", project_id=project.id, name="Source")
    target_suite = Suite(id="suite_bulk_m_dst", project_id=project.id, name="Target")
    owner_user = User(id="user_bulk_m_owner", username="m_owner", password_hash="hash")
    acting_membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    owner_membership = ProjectMember(project_id=project.id, user_id=owner_user.id, role=ProjectMemberRole.tester)
    tc = TestCase(
        id="tc_bulk_m_1",
        project_id=project.id,
        suite_id=source_suite.id,
        key="MUL-TC-1",
        title="Case",
        tags=["keep"],
        priority="low",
        status=TestCaseStatus.draft,
    )
    db_session.add_all(
        [project, source_suite, target_suite, owner_user, acting_membership, owner_membership, tc],
    )
    project_id = project.id
    target_suite_id = target_suite.id
    owner_user_id = owner_user.id
    tc_id = tc.id
    await db_session.commit()

    resp = await client.post(
        "/api/v1/test-cases/bulk",
        json={
            "project_id": project_id,
            "test_case_ids": [tc_id],
            "action": "update",
            "suite_id": target_suite_id,
            "owner_id": owner_user_id,
            "priority": "high",
            "status": "active",
            "tag": "multi",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["affected_count"] == 1

    db_session.expire_all()
    saved = await session_get(db_session, TestCase, tc_id)
    assert saved is not None
    assert saved.suite_id == target_suite_id
    assert saved.owner_id == owner_user_id
    assert saved.priority == "high"
    assert saved.status.value == "active"
    assert "multi" in saved.tags
    assert "keep" in saved.tags


async def test_test_case_bulk_delete_removes_attachments(
    client,
    db_session: AsyncSession,
    auth_user: User,
    auth_headers,
    tmp_path,
):
    project = Project(id="proj_bulk_delete_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    test_case = TestCase(id="tc_bulk_delete_1", project_id=project.id, suite_id=None, key="BDL-TC-1", title="Case", tags=[])
    db_session.add_all([project, membership, test_case])
    await db_session.commit()

    uploaded = await client.post(
        "/api/v1/attachments",
        data={"test_case_id": test_case.id},
        files={"file": ("bulk.txt", b"bulk-delete", "text/plain")},
        headers=auth_headers,
    )
    assert uploaded.status_code == 201
    attachment_id = uploaded.json()["id"]
    stored = await session_scalar(db_session, select(Attachment).where(Attachment.id == attachment_id))
    assert stored is not None
    stored_path = tmp_path / stored.storage_key
    assert stored_path.is_file()

    deleted = await client.post(
        "/api/v1/test-cases/bulk",
        json={
            "project_id": project.id,
            "test_case_ids": [test_case.id],
            "action": "delete",
        },
        headers=auth_headers,
    )
    assert deleted.status_code == 200
    assert deleted.json()["affected_count"] == 1

    db_session.expire_all()
    assert await session_get(db_session, TestCase, test_case.id) is None
    assert await session_scalar(db_session, select(Attachment).where(Attachment.id == attachment_id)) is None
    assert not stored_path.exists()


async def test_test_case_bulk_delete_requires_lead(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_bulk_forbidden_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    test_case = TestCase(
        id="tc_bulk_forbidden_1",
        project_id=project.id,
        suite_id=None,
        key="BFD-TC-1",
        title="Case",
        tags=[],
    )
    db_session.add_all([project, membership, test_case])
    await db_session.commit()

    response = await client.post(
        "/api/v1/test-cases/bulk",
        json={
            "project_id": project.id,
            "test_case_ids": [test_case.id],
            "action": "delete",
        },
        headers=auth_headers,
    )
    assert response.status_code == 403
    assert response.json()["code"] == "insufficient_project_role"


async def test_list_test_cases_excludes_archived_by_default(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_case_list_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.viewer)
    visible_case = TestCase(
        id="tc_case_list_visible",
        project_id=project.id,
        suite_id=None,
        key="LST-TC-1",
        title="Visible",
        status=TestCaseStatus.active,
        tags=[],
    )
    archived_case = TestCase(
        id="tc_case_list_archived",
        project_id=project.id,
        suite_id=None,
        key="LST-TC-2",
        title="Archived",
        status=TestCaseStatus.archived,
        tags=[],
    )
    db_session.add_all([project, membership, visible_case, archived_case])
    await db_session.commit()

    listed = await client.get(f"/api/v1/test-cases?project_id={project.id}", headers=auth_headers)
    assert listed.status_code == 200
    listed_body = listed.json()
    assert {item["id"] for item in listed_body["items"]} == {visible_case.id}
    assert listed_body["total"] == 1

    archived = await client.get(f"/api/v1/test-cases?project_id={project.id}&status=archived", headers=auth_headers)
    assert archived.status_code == 200
    archived_body = archived.json()
    assert [item["id"] for item in archived_body["items"]] == [archived_case.id]
    assert archived_body["total"] == 1


async def test_list_test_runs_excludes_archived_by_default(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_run_list_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.viewer)
    active_run = TestRun(
        id="run_list_active",
        project_id=project.id,
        name="Visible run",
        status=TestRunStatus.in_progress,
    )
    archived_run = TestRun(
        id="run_list_archived",
        project_id=project.id,
        name="Archived run",
        status=TestRunStatus.archived,
    )
    db_session.add_all([project, membership, active_run, archived_run])
    await db_session.commit()

    listed = await client.get(f"/api/v1/test-runs?project_id={project.id}", headers=auth_headers)
    assert listed.status_code == 200
    assert {item["id"] for item in listed.json()["items"]} == {active_run.id}

    archived = await client.get(f"/api/v1/test-runs?project_id={project.id}&status=archived", headers=auth_headers)
    assert archived.status_code == 200
    assert [item["id"] for item in archived.json()["items"]] == [archived_run.id]


async def test_list_test_runs_filters_by_created_date_range(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_run_dates_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.viewer)
    run_january = TestRun(
        id="run_dates_january",
        project_id=project.id,
        name="January run",
        status=TestRunStatus.completed,
        created_at=datetime(2026, 1, 10, 9, 0, tzinfo=timezone.utc),
    )
    run_february = TestRun(
        id="run_dates_february",
        project_id=project.id,
        name="February run",
        status=TestRunStatus.in_progress,
        created_at=datetime(2026, 2, 15, 9, 0, tzinfo=timezone.utc),
    )
    run_march = TestRun(
        id="run_dates_march",
        project_id=project.id,
        name="March run",
        status=TestRunStatus.not_started,
        created_at=datetime(2026, 3, 20, 9, 0, tzinfo=timezone.utc),
    )
    db_session.add_all([project, membership, run_january, run_february, run_march])
    await db_session.commit()

    in_february = await client.get(
        f"/api/v1/test-runs?project_id={project.id}&created_from=2026-02-01&created_to=2026-02-28",
        headers=auth_headers,
    )
    assert in_february.status_code == 200
    assert [item["id"] for item in in_february.json()["items"]] == [run_february.id]

    after_march_start = await client.get(
        f"/api/v1/test-runs?project_id={project.id}&created_from=2026-03-01",
        headers=auth_headers,
    )
    assert after_march_start.status_code == 200
    assert [item["id"] for item in after_march_start.json()["items"]] == [run_march.id]


async def test_list_test_cases_rejects_invalid_status_enum(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_case_invalid_status_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.viewer)
    db_session.add_all([project, membership])
    await db_session.commit()

    response = await client.get(
        f"/api/v1/test-cases?project_id={project.id}&status=invalid_status",
        headers=auth_headers,
    )
    assert response.status_code == 422


async def test_list_test_cases_supports_sorting_and_page_pagination(
    client,
    db_session: AsyncSession,
    auth_user: User,
    auth_headers,
):
    project = Project(id="proj_case_sort_1", name="Proj")
    suite_alpha = Suite(id="suite_case_sort_alpha", project_id=project.id, name="Alpha")
    suite_beta = Suite(id="suite_case_sort_beta", project_id=project.id, name="Beta")
    alpha = User(id="user_case_sort_alpha", username="alpha", password_hash="hash")
    zulu = User(id="user_case_sort_zulu", username="zulu", password_hash="hash")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.viewer)
    case_apple = TestCase(
        id="tc_case_sort_apple",
        project_id=project.id,
        suite_id=suite_beta.id,
        owner_id=alpha.id,
        key="SRT-TC-1",
        title="Apple",
        status=TestCaseStatus.active,
        tags=[],
    )
    case_banana = TestCase(
        id="tc_case_sort_banana",
        project_id=project.id,
        suite_id=suite_alpha.id,
        owner_id=zulu.id,
        key="SRT-TC-2",
        title="Banana",
        status=TestCaseStatus.active,
        tags=[],
    )
    case_cherry = TestCase(
        id="tc_case_sort_cherry",
        project_id=project.id,
        suite_id=None,
        owner_id=auth_user.id,
        key="SRT-TC-3",
        title="Cherry",
        status=TestCaseStatus.active,
        tags=[],
    )
    db_session.add_all([project, suite_alpha, suite_beta, alpha, zulu, membership, case_apple, case_banana, case_cherry])
    await db_session.commit()

    first_page = await client.get(
        f"/api/v1/test-cases?project_id={project.id}&sort_by=title&sort_order=asc&page=1&page_size=2",
        headers=auth_headers,
    )
    assert first_page.status_code == 200
    first_body = first_page.json()
    assert [item["title"] for item in first_body["items"]] == ["Apple", "Banana"]
    assert first_body["has_next"] is True
    assert first_body["total"] == 3

    second_page = await client.get(
        f"/api/v1/test-cases?project_id={project.id}&sort_by=title&sort_order=asc&page=2&page_size=2",
        headers=auth_headers,
    )
    assert second_page.status_code == 200
    second_body = second_page.json()
    assert [item["title"] for item in second_body["items"]] == ["Cherry"]
    assert second_body["total"] == 3

    owner_sorted = await client.get(
        f"/api/v1/test-cases?project_id={project.id}&sort_by=owner_name&sort_order=desc",
        headers=auth_headers,
    )
    assert owner_sorted.status_code == 200
    assert [item["owner_name"] for item in owner_sorted.json()["items"]] == ["zulu", "auth_user", "alpha"]

    suite_sorted = await client.get(
        f"/api/v1/test-cases?project_id={project.id}&sort_by=suite_name&sort_order=asc",
        headers=auth_headers,
    )
    assert suite_sorted.status_code == 200
    assert [item["title"] for item in suite_sorted.json()["items"]] == ["Cherry", "Banana", "Apple"]


async def test_list_test_runs_supports_sorting_and_page_pagination(
    client,
    db_session: AsyncSession,
    auth_user: User,
    auth_headers,
):
    project = Project(id="proj_run_sort_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.viewer)
    run_alpha = TestRun(id="run_sort_alpha", project_id=project.id, name="Alpha", status=TestRunStatus.completed, build="3")
    run_bravo = TestRun(id="run_sort_bravo", project_id=project.id, name="Bravo", status=TestRunStatus.in_progress, build="1")
    run_charlie = TestRun(id="run_sort_charlie", project_id=project.id, name="Charlie", status=TestRunStatus.not_started, build="2")
    db_session.add_all([project, membership, run_alpha, run_bravo, run_charlie])
    await db_session.commit()

    first_page = await client.get(
        f"/api/v1/test-runs?project_id={project.id}&sort_by=name&sort_order=asc&page=1&page_size=2",
        headers=auth_headers,
    )
    assert first_page.status_code == 200
    first_body = first_page.json()
    assert [item["name"] for item in first_body["items"]] == ["Alpha", "Bravo"]
    assert first_body["has_next"] is True
    assert first_body["total"] == 3

    second_page = await client.get(
        f"/api/v1/test-runs?project_id={project.id}&sort_by=name&sort_order=asc&page=2&page_size=2",
        headers=auth_headers,
    )
    assert second_page.status_code == 200
    assert [item["name"] for item in second_page.json()["items"]] == ["Charlie"]

    by_build = await client.get(
        f"/api/v1/test-runs?project_id={project.id}&sort_by=build&sort_order=asc",
        headers=auth_headers,
    )
    assert by_build.status_code == 200
    assert [item["name"] for item in by_build.json()["items"]] == ["Bravo", "Charlie", "Alpha"]


async def test_test_case_status_requires_transition_role(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_case_status_role_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    test_case = TestCase(
        id="tc_case_status_role_1",
        project_id=project.id,
        suite_id=None,
        key="ROL-TC-1",
        title="Case",
        status=TestCaseStatus.draft,
        tags=[],
    )
    db_session.add_all([project, membership, test_case])
    await db_session.commit()

    response = await client.patch(
        f"/api/v1/test-cases/{test_case.id}",
        json={"status": "active"},
        headers=auth_headers,
    )
    assert response.status_code == 403
    assert response.json()["code"] == "insufficient_status_transition_role"


async def test_test_case_status_lifecycle_for_lead(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_case_status_flow_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    test_case = TestCase(
        id="tc_case_status_flow_1",
        project_id=project.id,
        suite_id=None,
        key="FLW-TC-1",
        title="Case",
        status=TestCaseStatus.draft,
        tags=[],
    )
    db_session.add_all([project, membership, test_case])
    tc_id = test_case.id
    await db_session.commit()

    active = await client.patch(
        f"/api/v1/test-cases/{tc_id}",
        json={"status": "active"},
        headers=auth_headers,
    )
    assert active.status_code == 200
    assert active.json()["status"] == "active"

    invalid = await client.patch(
        f"/api/v1/test-cases/{tc_id}",
        json={"status": "draft"},
        headers=auth_headers,
    )
    assert invalid.status_code == 409
    assert invalid.json()["code"] == "invalid_status_transition"

    direct_archive = await client.patch(
        f"/api/v1/test-cases/{tc_id}",
        json={"status": "archived"},
        headers=auth_headers,
    )
    assert direct_archive.status_code == 200
    assert direct_archive.json()["status"] == "archived"

    archived_again = await client.patch(
        f"/api/v1/test-cases/{tc_id}",
        json={"status": "archived"},
        headers=auth_headers,
    )
    assert archived_again.status_code == 200
    assert archived_again.json()["status"] == "archived"

    restored = await client.patch(
        f"/api/v1/test-cases/{tc_id}",
        json={"status": "active"},
        headers=auth_headers,
    )
    assert restored.status_code == 409
    assert restored.json()["code"] == "invalid_status_transition"


async def test_test_case_status_manager_can_change_any_to_any(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_case_status_manager_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.manager)
    test_case = TestCase(
        id="tc_case_status_manager_1",
        project_id=project.id,
        suite_id=None,
        key="MGR-TC-1",
        title="Case",
        status=TestCaseStatus.draft,
        tags=[],
    )
    db_session.add_all([project, membership, test_case])
    await db_session.commit()

    archived = await client.patch(
        f"/api/v1/test-cases/{test_case.id}",
        json={"status": "archived"},
        headers=auth_headers,
    )
    assert archived.status_code == 200
    assert archived.json()["status"] == "archived"

    draft = await client.patch(
        f"/api/v1/test-cases/{test_case.id}",
        json={"status": "draft"},
        headers=auth_headers,
    )
    assert draft.status_code == 200
    assert draft.json()["status"] == "draft"


async def test_test_case_status_admin_can_change_any_to_any(client, db_session: AsyncSession, admin_user: User, admin_headers):
    project = Project(id="proj_case_status_admin_1", name="Proj")
    test_case = TestCase(
        id="tc_case_status_admin_1",
        project_id=project.id,
        suite_id=None,
        key="ADM-TC-1",
        title="Case",
        status=TestCaseStatus.archived,
        tags=[],
    )
    db_session.add_all([project, test_case])
    await db_session.commit()

    active = await client.patch(
        f"/api/v1/test-cases/{test_case.id}",
        json={"status": "active"},
        headers=admin_headers,
    )
    assert active.status_code == 200
    assert active.json()["status"] == "active"

    draft = await client.patch(
        f"/api/v1/test-cases/{test_case.id}",
        json={"status": "draft"},
        headers=admin_headers,
    )
    assert draft.status_code == 200
    assert draft.json()["status"] == "draft"


async def test_add_run_cases_rejects_non_active_test_cases(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_run_cases_status_1", name="Proj")
    run = TestRun(id="run_cases_status_1", project_id=project.id, name="Run", status=TestRunStatus.not_started)
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    draft_case = TestCase(
        id="tc_run_cases_status_1",
        project_id=project.id,
        suite_id=None,
        key="RST-TC-1",
        title="Draft case",
        status=TestCaseStatus.draft,
        tags=[],
    )
    db_session.add_all([project, run, membership, draft_case])
    await db_session.commit()

    response = await client.post(
        "/api/v1/run-cases/bulk",
        json={"test_run_id": run.id, "test_case_ids": [draft_case.id]},
        headers=auth_headers,
    )
    assert response.status_code == 422
    assert response.json()["code"] == "test_case_status_not_allowed"


async def test_suite_nesting_is_limited_to_four_levels(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_123", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    db_session.add_all([project, membership])
    await db_session.commit()

    root = await client.post(
        "/api/v1/suites",
        json={"project_id": project.id, "name": "L1", "parent_id": None},
        headers=auth_headers,
    )
    assert root.status_code == 201
    level_1 = root.json()

    level_2 = await client.post(
        "/api/v1/suites",
        json={"project_id": project.id, "name": "L2", "parent_id": level_1["id"]},
        headers=auth_headers,
    )
    assert level_2.status_code == 201

    level_3 = await client.post(
        "/api/v1/suites",
        json={"project_id": project.id, "name": "L3", "parent_id": level_2.json()["id"]},
        headers=auth_headers,
    )
    assert level_3.status_code == 201

    level_4 = await client.post(
        "/api/v1/suites",
        json={"project_id": project.id, "name": "L4", "parent_id": level_3.json()["id"]},
        headers=auth_headers,
    )
    assert level_4.status_code == 201

    level_5 = await client.post(
        "/api/v1/suites",
        json={"project_id": project.id, "name": "L5", "parent_id": level_4.json()["id"]},
        headers=auth_headers,
    )
    assert level_5.status_code == 422
    assert level_5.json()["code"] == "suite_depth_limit_exceeded"


async def test_suite_delete_requires_admin(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_suite_delete_admin_only_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.manager)
    suite = Suite(id="suite_delete_admin_only_1", project_id=project.id, name="Root", parent_id=None)
    db_session.add_all([project, membership, suite])
    await db_session.commit()

    response = await client.delete(f"/api/v1/suites/{suite.id}", headers=auth_headers)

    assert response.status_code == 403
    assert response.json()["code"] == "admin_required"


async def test_admin_can_delete_suite_with_nested_suites_and_test_cases(
    client,
    db_session: AsyncSession,
    admin_headers,
):
    project = Project(id="proj_suite_delete_cascade_1", name="Proj")
    root_suite = Suite(id="suite_delete_cascade_root_1", project_id=project.id, name="Root", parent_id=None)
    child_suite = Suite(id="suite_delete_cascade_child_1", project_id=project.id, name="Child", parent_id=root_suite.id)
    root_case = TestCase(
        id="tc_suite_delete_root_1",
        project_id=project.id,
        suite_id=root_suite.id,
        key="SDL-TC-1",
        title="Root case",
        tags=[],
    )
    child_case = TestCase(
        id="tc_suite_delete_child_1",
        project_id=project.id,
        suite_id=child_suite.id,
        key="SDL-TC-2",
        title="Child case",
        tags=[],
    )
    db_session.add_all([project, root_suite, child_suite, root_case, child_case])
    await db_session.commit()

    response = await client.delete(f"/api/v1/suites/{root_suite.id}", headers=admin_headers)

    assert response.status_code == 204
    assert await session_get(db_session, Suite, root_suite.id) is None
    assert await session_get(db_session, Suite, child_suite.id) is None
    assert await session_get(db_session, TestCase, root_case.id) is None
    assert await session_get(db_session, TestCase, child_case.id) is None
