from app.models.enums import ProjectMemberRole, TestCaseTemplateType, TestCaseType
from app.modules.projects.models import Project, ProjectMember, User
from sqlalchemy.ext.asyncio import AsyncSession


async def _create_case(client, auth_headers, *, project_id: str, title: str, **extra):
    payload = {
        "project_id": project_id,
        "title": title,
        "tags": [],
        "template_type": TestCaseTemplateType.text.value,
        "steps_text": "Do something",
        **extra,
    }
    response = await client.post("/api/v1/test-cases", json=payload, headers=auth_headers)
    assert response.status_code == 201, response.text
    return response.json()


async def test_list_filters_by_test_case_type(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_type_filter", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    await _create_case(client, auth_headers, project_id=project.id, title="Manual one", test_case_type=TestCaseType.manual.value)
    await _create_case(client, auth_headers, project_id=project.id, title="Auto one", test_case_type=TestCaseType.automated.value)

    response = await client.get(
        f"/api/v1/test-cases?project_id={project.id}&test_case_type=automated",
        headers=auth_headers,
    )
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["title"] == "Auto one"
    assert items[0]["test_case_type"] == "automated"


async def test_list_filters_by_tag(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_tag_filter", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    await _create_case(client, auth_headers, project_id=project.id, title="Tagged", tags=["alpha", "beta"])
    await _create_case(client, auth_headers, project_id=project.id, title="Untagged", tags=["gamma"])

    response = await client.get(
        f"/api/v1/test-cases?project_id={project.id}&tag=alpha",
        headers=auth_headers,
    )
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["title"] == "Tagged"


async def test_list_tags_endpoint_returns_distinct_sorted(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_tags_endpoint", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    await _create_case(client, auth_headers, project_id=project.id, title="With tags A", tags=["beta", "alpha"])
    await _create_case(client, auth_headers, project_id=project.id, title="With tags B", tags=["alpha"])

    response = await client.get(f"/api/v1/test-cases/tags?project_id={project.id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["items"] == ["alpha", "beta"]
