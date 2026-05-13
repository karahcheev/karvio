from __future__ import annotations

from datetime import datetime, timezone

import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.core.security import create_access_token
from app.core.token_crypto import encrypt_secret
from app.main import app
from app.models.enums import ProjectMemberRole, RunItemStatus, TestRunStatus as EnumTestRunStatus
from app.modules.integrations.jira.models import ExternalIssueLink, JiraConnection, JiraProjectMapping
from app.modules.integrations.jira.router import get_jira_client
from app.modules.projects.models import Project, ProjectMember, User
from app.modules.test_runs.models import RunCaseRow, RunItem


def _adf_to_plain_text(adf: dict) -> str:
    paragraphs: list[str] = []
    for paragraph in adf.get("content", []):
        if paragraph.get("type") != "paragraph":
            continue
        chunks: list[str] = []
        for node in paragraph.get("content", []):
            if node.get("type") == "text":
                chunks.append(str(node.get("text") or ""))
            elif node.get("type") == "hardBreak":
                chunks.append("\n")
        paragraphs.append("".join(chunks))
    return "\n\n".join(paragraphs)


class _FakeJiraClient:
    def __init__(self) -> None:
        self.issue_create_calls = 0
        self.last_issue_create_fields: dict | None = None
        self.api_token_email = "qa@example.com"
        self.api_token_site_url = "https://example.atlassian.net"
        self.api_token = "token_current"
        self.enabled = True

    async def get_myself_by_site(self, *, site_url: str, email: str, api_token: str) -> dict:
        return {"accountId": "acct_api_token", "emailAddress": email}

    async def get_project_by_site(self, *, site_url: str, email: str, api_token: str, project_key: str) -> dict:
        if email != "qa@example.com":
            raise DomainError(
                status_code=401,
                code="jira_auth_failed",
                title="Unauthorized",
                detail="API token email mismatch",
            )
        return {"id": "20000", "key": project_key}

    async def get_issue_by_site(self, *, site_url: str, email: str, api_token: str, issue_key: str) -> dict:
        return {
            "key": issue_key,
            "fields": {
                "summary": f"Issue {issue_key}",
                "status": {"name": "In Progress"},
                "priority": {"name": "High"},
                "assignee": {"displayName": "QA Bot", "accountId": "acct_qa_bot"},
            },
        }

    async def create_issue_by_site(self, *, site_url: str, email: str, api_token: str, fields: dict) -> dict:
        self.issue_create_calls += 1
        self.last_issue_create_fields = fields
        return {"id": "10001", "key": "QA-900"}


@pytest_asyncio.fixture
async def jira_seed(db_session: AsyncSession, auth_user: User) -> dict[str, str]:
    from app.modules.test_cases.models import TestCase, TestCaseStep
    from app.modules.test_runs.models import TestRun

    project = Project(id="proj_jira_1", name="Jira project")
    test_case = TestCase(
        id="tc_jira_1",
        project_id=project.id,
        key="TC-JIRA-1",
        title="Case with jira",
        tags=[],
    )
    run = TestRun(id="run_jira_1", project_id=project.id, name="Run Jira", status=EnumTestRunStatus.in_progress)
    run_case = RunItem(
        id="ri_jira_1",
        test_run_id=run.id,
        test_case_id=test_case.id,
        status=RunItemStatus.failure,
        rows_total=1,
        rows_failed=1,
    )
    step_1 = TestCaseStep(
        id="step_jira_1",
        test_case_id=test_case.id,
        position=1,
        action="Open checkout page",
        expected_result="Checkout page is opened",
    )
    step_2 = TestCaseStep(
        id="step_jira_2",
        test_case_id=test_case.id,
        position=2,
        action="Click Place order",
        expected_result="Order is successfully created",
    )
    run_case_row = RunCaseRow(
        id="rcr_jira_1",
        run_case_id=run_case.id,
        row_order=1,
        scenario_label="default",
        row_snapshot={"datasets": []},
        status=RunItemStatus.failure,
        comment="Checkout button returns an error",
        actual_result="HTTP 500 is displayed instead of success message",
        last_executed_at=datetime.now(timezone.utc),
    )
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    connection = JiraConnection(
        id="jira_conn_1",
        workspace_id="workspace_default",
        cloud_id="site::example.atlassian.net",
        site_url="https://example.atlassian.net",
        account_id="qa@example.com",
        access_token_encrypted=encrypt_secret("token_current"),
        connected_at=datetime.now(timezone.utc),
    )
    mapping = JiraProjectMapping(
        id="jira_map_1",
        project_id=project.id,
        jira_connection_id=connection.id,
        jira_project_key="QA",
        default_issue_type_id="10001",
        default_labels=["auto"],
        default_components=["web"],
        active=True,
    )
    db_session.add_all([project, test_case, step_1, step_2, run, run_case, run_case_row, membership, connection, mapping])
    await db_session.commit()
    return {"project_id": project.id, "test_case_id": test_case.id, "run_case_id": run_case.id}


async def test_link_existing_issue_for_run_case(client, auth_headers, jira_seed):
    app.dependency_overrides[get_jira_client] = lambda: _FakeJiraClient()
    try:
        response = await client.post(
            "/api/v1/integrations/jira/issues/link",
            json={
                "owner_type": "run_case",
                "owner_id": jira_seed["run_case_id"],
                "issue_key_or_url": "https://example.atlassian.net/browse/QA-123",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        body = response.json()
        assert body["external_key"] == "QA-123"
        assert body["snapshot_status"] == "In Progress"

        run_case_response = await client.get(f"/api/v1/run-cases/{jira_seed['run_case_id']}", headers=auth_headers)
        assert run_case_response.status_code == 200
        assert len(run_case_response.json()["external_issues"]) == 1
        assert run_case_response.json()["external_issues"][0]["external_key"] == "QA-123"
    finally:
        app.dependency_overrides.pop(get_jira_client, None)


async def test_create_issue_from_run_case_is_idempotent(client, db_session: AsyncSession, auth_headers, jira_seed):
    fake_client = _FakeJiraClient()
    app.dependency_overrides[get_jira_client] = lambda: fake_client
    try:
        payload = {"run_case_id": jira_seed["run_case_id"], "idempotency_key": "create_once_1"}
        first = await client.post(
            "/api/v1/integrations/jira/issues/create-from-run-case",
            json=payload,
            headers=auth_headers,
        )
        second = await client.post(
            "/api/v1/integrations/jira/issues/create-from-run-case",
            json=payload,
            headers=auth_headers,
        )
        assert first.status_code == 201
        assert second.status_code == 201
        assert first.json()["id"] == second.json()["id"]

        link_count = await db_session.scalar(
            select(func.count()).select_from(ExternalIssueLink).where(ExternalIssueLink.owner_id == jira_seed["run_case_id"])
        )
        assert link_count == 1
        assert fake_client.last_issue_create_fields is not None
        description = fake_client.last_issue_create_fields["description"]
        paragraph_text = _adf_to_plain_text(description)
        assert "Description:\nCheckout button returns an error" in paragraph_text
        assert "Actual result:\nHTTP 500 is displayed instead of success message" in paragraph_text
        assert "Expected result:\n1. Checkout page is opened" in paragraph_text
        assert "Steps:\n1. Open checkout page" in paragraph_text
        assert "Run case link:\nhttp://localhost:5173/projects/proj_jira_1/test-runs/run_jira_1?run_case_id=ri_jira_1" in paragraph_text
    finally:
        app.dependency_overrides.pop(get_jira_client, None)


async def test_disable_connection_blocks_issue_linking(client, auth_headers, admin_headers, jira_seed):
    app.dependency_overrides[get_jira_client] = lambda: _FakeJiraClient()
    try:
        patch_resp = await client.patch(
            "/api/v1/integrations/jira/connections/jira_conn_1",
            json={"enabled": False},
            headers=admin_headers,
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["enabled"] is False

        link_resp = await client.post(
            "/api/v1/integrations/jira/issues/link",
            json={
                "owner_type": "run_case",
                "owner_id": jira_seed["run_case_id"],
                "issue_key_or_url": "QA-321",
            },
            headers=auth_headers,
        )
        assert link_resp.status_code == 409
        assert link_resp.json()["code"] == "jira_integration_disabled"
    finally:
        app.dependency_overrides.pop(get_jira_client, None)


async def test_mapping_create_requires_lead_or_manager(
    client,
    db_session: AsyncSession,
    auth_user: User,
):
    project = Project(id="proj_jira_forbidden_1", name="Forbidden Jira")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    connection = JiraConnection(
        id="jira_conn_forbidden_1",
        workspace_id="workspace_default",
        cloud_id="site::forbidden.atlassian.net",
        site_url="https://forbidden.atlassian.net",
        account_id="qa@example.com",
        access_token_encrypted=encrypt_secret("token"),
        connected_at=datetime.now(timezone.utc),
    )
    db_session.add_all([project, membership, connection])
    await db_session.commit()

    headers = {"Authorization": f"Bearer {create_access_token(auth_user.id)}"}
    app.dependency_overrides[get_jira_client] = lambda: _FakeJiraClient()
    try:
        response = await client.post(
            "/api/v1/integrations/jira/mappings",
            json={
                "project_id": project.id,
                "jira_connection_id": connection.id,
                "jira_project_key": "QA",
            },
            headers=headers,
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_jira_client, None)


async def test_list_mappings_without_project_id_scopes_to_visible_projects(
    client,
    db_session: AsyncSession,
    auth_headers,
    jira_seed,
):
    hidden_project = Project(id="proj_jira_hidden_1", name="Hidden Jira")
    hidden_mapping = JiraProjectMapping(
        id="jira_map_hidden_1",
        project_id=hidden_project.id,
        jira_connection_id="jira_conn_1",
        jira_project_key="HIDE",
        active=True,
    )
    db_session.add_all([hidden_project, hidden_mapping])
    await db_session.commit()

    response = await client.get("/api/v1/integrations/jira/mappings", headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert [item["project_id"] for item in body["items"]] == [jira_seed["project_id"]]


async def test_jira_system_settings_can_be_saved_and_read(client, admin_headers):
    payload = {
        "enabled": True,
        "api_token_site_url": "https://example.atlassian.net",
        "api_token_email": "admin@example.com",
        "api_token": "secret_token_123",
        "api_base_url": "https://api.atlassian.com",
        "http_timeout_seconds": 20,
        "http_max_retries": 4,
        "sync_default_interval_seconds": 300,
    }
    put_response = await client.put("/api/v1/integrations/jira/settings", json=payload, headers=admin_headers)
    assert put_response.status_code == 200
    put_body = put_response.json()
    assert put_body["enabled"] is True
    assert put_body["api_token_site_url"] == "https://example.atlassian.net"
    assert put_body["api_token_email"] == "admin@example.com"
    assert put_body["api_token_configured"] is True

    get_response = await client.get("/api/v1/integrations/jira/settings", headers=admin_headers)
    assert get_response.status_code == 200
    body = get_response.json()
    assert body["api_token_site_url"] == "https://example.atlassian.net"
    assert body["api_token_configured"] is True


async def test_jira_api_token_connects_and_creates_connection(client, admin_headers):
    fake_client = _FakeJiraClient()
    fake_client.enabled = True
    fake_client.api_token_site_url = "https://example.atlassian.net"
    fake_client.api_token_email = "qa@example.com"
    fake_client.api_token = "token_123"
    app.dependency_overrides[get_jira_client] = lambda: fake_client
    try:
        connect_response = await client.post("/api/v1/integrations/jira/connect/api-token", headers=admin_headers)
        assert connect_response.status_code == 200
        body = connect_response.json()
        assert body["connected"] is True
        assert body["connection"]["site_url"] == "https://example.atlassian.net"
        assert body["connection"]["account_id"] == "qa@example.com"
    finally:
        app.dependency_overrides.pop(get_jira_client, None)


async def test_mapping_create_uses_settings_email_for_api_token_connection(
    client,
    db_session: AsyncSession,
    auth_user: User,
):
    project = Project(id="proj_jira_api_token_map_1", name="Jira API token map")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    connection = JiraConnection(
        id="jira_conn_api_token_1",
        workspace_id="workspace_default",
        cloud_id="site::example.atlassian.net",
        site_url="https://example.atlassian.net",
        # Simulate existing rows created before email fallback fix: accountId stored instead of email.
        account_id="acct_api_token",
        access_token_encrypted=encrypt_secret("token_api"),
        connected_at=datetime.now(timezone.utc),
    )
    db_session.add_all([project, membership, connection])
    await db_session.commit()

    fake_client = _FakeJiraClient()
    fake_client.api_token_email = "qa@example.com"
    app.dependency_overrides[get_jira_client] = lambda: fake_client
    try:
        response = await client.post(
            "/api/v1/integrations/jira/mappings",
            json={
                "project_id": project.id,
                "jira_connection_id": connection.id,
                "jira_project_key": "QA",
            },
            headers={"Authorization": f"Bearer {create_access_token(auth_user.id)}"},
        )
        assert response.status_code == 201
        assert response.json()["jira_project_key"] == "QA"
    finally:
        app.dependency_overrides.pop(get_jira_client, None)


async def test_bulk_create_issue_for_run_cases_creates_single_jira_issue(
    client,
    db_session: AsyncSession,
    auth_headers,
    jira_seed,
):
    from app.modules.test_cases.models import TestCase

    extra_case = TestCase(
        id="tc_jira_2",
        project_id=jira_seed["project_id"],
        key="TC-JIRA-2",
        title="Second case with jira",
        tags=[],
    )
    extra_run_case = RunItem(
        id="ri_jira_2",
        test_run_id="run_jira_1",
        test_case_id=extra_case.id,
        status=RunItemStatus.failure,
        rows_total=1,
        rows_failed=1,
    )
    db_session.add_all([extra_case, extra_run_case])
    await db_session.commit()

    fake_client = _FakeJiraClient()
    app.dependency_overrides[get_jira_client] = lambda: fake_client
    try:
        response = await client.post(
            "/api/v1/integrations/jira/issues/create-from-run-cases",
            json={
                "run_case_ids": [jira_seed["run_case_id"], extra_run_case.id],
                "idempotency_key": "bulk_create_1",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        body = response.json()
        assert len(body["items"]) == 2
        assert {item["owner_id"] for item in body["items"]} == {jira_seed["run_case_id"], extra_run_case.id}
        assert {item["external_key"] for item in body["items"]} == {"QA-900"}
        assert fake_client.issue_create_calls == 1
    finally:
        app.dependency_overrides.pop(get_jira_client, None)


async def test_bulk_link_existing_issue_for_run_cases(
    client,
    db_session: AsyncSession,
    auth_headers,
    jira_seed,
):
    from app.modules.test_cases.models import TestCase

    extra_case = TestCase(
        id="tc_jira_3",
        project_id=jira_seed["project_id"],
        key="TC-JIRA-3",
        title="Third case with jira",
        tags=[],
    )
    extra_run_case = RunItem(
        id="ri_jira_3",
        test_run_id="run_jira_1",
        test_case_id=extra_case.id,
        status=RunItemStatus.failure,
        rows_total=1,
        rows_failed=1,
    )
    db_session.add_all([extra_case, extra_run_case])
    await db_session.commit()

    app.dependency_overrides[get_jira_client] = lambda: _FakeJiraClient()
    try:
        response = await client.post(
            "/api/v1/integrations/jira/issues/link-run-cases",
            json={
                "run_case_ids": [jira_seed["run_case_id"], extra_run_case.id],
                "issue_key_or_url": "https://example.atlassian.net/browse/QA-123",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        body = response.json()
        assert len(body["items"]) == 2
        assert {item["owner_id"] for item in body["items"]} == {jira_seed["run_case_id"], extra_run_case.id}
        assert {item["external_key"] for item in body["items"]} == {"QA-123"}
    finally:
        app.dependency_overrides.pop(get_jira_client, None)
