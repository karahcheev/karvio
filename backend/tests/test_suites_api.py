"""Tests for suites API."""


from app.models.enums import ProjectMemberRole
from app.modules.projects.models import Project, ProjectMember, Suite
from app.modules.test_cases.models import TestCase as TmsTestCase
from sqlalchemy.ext.asyncio import AsyncSession


async def test_list_suites_includes_active_test_cases_count(client, db_session: AsyncSession, auth_headers):
    from app.models.enums import TestCaseStatus
    project = Project(id="proj_suites_count_1", name="Suites Count")
    parent = Suite(id="suite_count_parent", project_id=project.id, name="Parent")
    child = Suite(id="suite_count_child", project_id=project.id, name="Child", parent_id=parent.id)
    empty = Suite(id="suite_count_empty", project_id=project.id, name="Empty")
    membership = ProjectMember(
        project_id=project.id,
        user_id="user_auth_1",
        role=ProjectMemberRole.viewer,
    )
    tc_active = TmsTestCase(
        id="tc_count_active",
        project_id=project.id,
        suite_id=parent.id,
        key="CNT-1",
        title="Active",
        status=TestCaseStatus.active,
        tags=[],
    )
    tc_draft = TmsTestCase(
        id="tc_count_draft",
        project_id=project.id,
        suite_id=parent.id,
        key="CNT-2",
        title="Draft",
        status=TestCaseStatus.draft,
        tags=[],
    )
    tc_child = TmsTestCase(
        id="tc_count_child",
        project_id=project.id,
        suite_id=child.id,
        key="CNT-3",
        title="In child",
        status=TestCaseStatus.active,
        tags=[],
    )
    db_session.add_all(
        [project, parent, child, empty, membership, tc_active, tc_draft, tc_child]
    )
    await db_session.commit()

    response = await client.get(
        f"/api/v1/suites?project_id={project.id}&page=1&page_size=50",
        headers=auth_headers,
    )
    assert response.status_code == 200
    payload = response.json()
    by_id = {item["id"]: item for item in payload["items"]}
    assert by_id[parent.id]["test_cases_count"] == 2
    assert by_id[child.id]["test_cases_count"] == 1
    assert by_id[empty.id]["test_cases_count"] == 0
    assert by_id[parent.id]["active_test_cases_count"] == 1
    assert by_id[child.id]["active_test_cases_count"] == 1
    assert by_id[empty.id]["active_test_cases_count"] == 0
