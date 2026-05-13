
from app.models.enums import ProjectMemberRole, TestCaseTemplateType, TestCaseType
from app.modules.projects.models import Project, ProjectMember, User
from sqlalchemy.ext.asyncio import AsyncSession


async def test_create_test_case_defaults_owner_to_current_user(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_owner_default", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    created = await client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project.id,
            "title": "Auto owner",
        },
        headers=auth_headers,
    )

    assert created.status_code == 201
    body = created.json()
    assert body["owner_id"] == auth_user.id
    assert body["owner_name"] == auth_user.username


async def test_create_test_case_defaults_status_draft(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_status_default", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    response = await client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project.id,
            "title": "Status default",
            "tags": [],
            "template_type": TestCaseTemplateType.steps.value,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["status"] == "draft"


async def test_create_test_case_status_active_forbidden_for_tester(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_status_tester", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    response = await client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project.id,
            "title": "Active case",
            "tags": [],
            "template_type": TestCaseTemplateType.text.value,
            "steps_text": "Do something",
            "status": "active",
            "test_case_type": TestCaseType.manual.value,
        },
        headers=auth_headers,
    )
    assert response.status_code == 403


async def test_create_test_case_status_active_allowed_for_lead(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_status_lead", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    db_session.add_all([project, membership])
    await db_session.commit()

    response = await client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project.id,
            "title": "Active from create",
            "tags": [],
            "template_type": TestCaseTemplateType.text.value,
            "steps_text": "Step",
            "status": "active",
            "test_case_type": TestCaseType.manual.value,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["status"] == "active"


async def test_create_test_case_explicit_null_owner_unassigned(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_owner_null", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    response = await client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project.id,
            "title": "No owner",
            "tags": [],
            "owner_id": None,
            "template_type": TestCaseTemplateType.steps.value,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["owner_id"] is None
