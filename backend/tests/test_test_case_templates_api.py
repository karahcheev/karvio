
from app.modules.projects.models import Project, ProjectMember, User
from app.models.enums import ProjectMemberRole, TestCaseTemplateType, TestCaseType
from app.modules.test_cases.models import TestCase
from sqlalchemy.ext.asyncio import AsyncSession


async def test_test_case_text_template_flow(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_case_text_tpl_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    created = await client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project.id,
            "title": "Text case",
            "template_type": "text",
            "preconditions": "User exists",
            "steps_text": "1. Open page\n2. Submit form",
            "expected": "Form is submitted",
            "tags": ["smoke"],
        },
        headers=auth_headers,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["template_type"] == "text"
    assert body["preconditions"] == "User exists"
    assert body["steps_text"] == "1. Open page\n2. Submit form"
    assert body["expected"] == "Form is submitted"
    assert body["test_case_type"] == "manual"

    fetched = await client.get(f"/api/v1/test-cases/{body['id']}", headers=auth_headers)
    assert fetched.status_code == 200
    assert fetched.json()["template_type"] == "text"
    assert fetched.json()["steps_text"] == "1. Open page\n2. Submit form"


async def test_test_case_automated_template_sets_automated_type(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_case_automated_tpl_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    created = await client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project.id,
            "title": "Automated case",
            "template_type": "automated",
            "automation_id": "AUTO-TPL-1",
            "raw_test": "def test_api_case():\n    assert response.status_code == 200",
            "raw_test_language": "python",
            "tags": ["api"],
        },
        headers=auth_headers,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["template_type"] == "automated"
    assert body["automation_id"] == "AUTO-TPL-1"
    assert body["raw_test"] == "def test_api_case():\n    assert response.status_code == 200"
    assert body["raw_test_language"] == "python"
    assert body["test_case_type"] == "automated"
    assert body["preconditions"] is None


async def test_test_case_automated_template_allows_missing_automation_id(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_case_automated_tpl_2", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    response = await client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project.id,
            "title": "Automated case",
            "template_type": "automated",
            "raw_test": "assert something",
            "tags": [],
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["template_type"] == "automated"
    assert body["automation_id"] is None
    assert body["raw_test"] == "assert something"
    assert body["test_case_type"] == "automated"


async def test_patch_automated_template_ignores_legacy_steps_text_field(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_case_automated_tpl_legacy_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    test_case = TestCase(
        id="tc_case_automated_tpl_legacy_1",
        project_id=project.id,
        key="AUTO-TPL-LEGACY-1",
        title="Automated legacy case",
        template_type=TestCaseTemplateType.automated,
        automation_id="AUTO-LEGACY-1",
        template_payload={"steps_text": "legacy execution flow"},
        test_case_type=TestCaseType.automated,
        tags=[],
    )
    db_session.add_all([project, membership, test_case])
    await db_session.commit()

    response = await client.patch(
        f"/api/v1/test-cases/{test_case.id}",
        json={
            "template_type": "automated",
            "raw_test": "def test_legacy_case():\n    assert True",
            "raw_test_language": "python",
            "steps_text": "legacy execution flow",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["raw_test"] == "def test_legacy_case():\n    assert True"
    assert body["raw_test_language"] == "python"


async def test_structured_steps_endpoint_rejects_non_steps_template(
    client,
    db_session: AsyncSession,
    auth_user: User,
    auth_headers,
):
    project = Project(id="proj_steps_tpl_guard_1", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    test_case = TestCase(
        id="tc_steps_tpl_guard_1",
        project_id=project.id,
        key="TPL-TC-1",
        title="Text case",
        template_type=TestCaseTemplateType.text,
        template_payload={"steps_text": "Do something", "expected": "Works"},
        tags=[],
    )
    db_session.add_all([project, membership, test_case])
    await db_session.commit()

    response = await client.put(
        f"/api/v1/test-cases/{test_case.id}/steps",
        json={"steps": [{"position": 1, "action": "New", "expected_result": "Done"}]},
        headers=auth_headers,
    )
    assert response.status_code == 409
    assert response.json()["code"] == "invalid_template_operation"
