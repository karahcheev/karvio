import json

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ProjectMemberRole, TestCasePriority, TestCaseTemplateType, TestCaseType
from app.modules.projects.models import Project, ProjectMember, Suite, User
from app.modules.test_cases.models import TestCase, TestCaseStep


@pytest_asyncio.fixture
async def seeded_cases(db_session: AsyncSession, auth_user: User) -> Project:
    project = Project(id="proj_tc_export_1", name="Export Cases Project")
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.viewer,
    )
    suite = Suite(id="suite_tc_export_1", project_id=project.id, name="Auth")
    steps_case = TestCase(
        id="tc_export_steps_1",
        project_id=project.id,
        suite_id=suite.id,
        owner_id=auth_user.id,
        key="EXP-1",
        title="Login works",
        preconditions="User exists",
        template_type=TestCaseTemplateType.steps,
        template_payload={},
        priority=TestCasePriority.high,
        test_case_type=TestCaseType.manual,
        tags=["smoke", "auth"],
    )
    text_case = TestCase(
        id="tc_export_text_1",
        project_id=project.id,
        suite_id=None,
        key="EXP-2",
        title="Password reset",
        template_type=TestCaseTemplateType.text,
        template_payload={"steps_text": "Open reset page", "expected": "Email sent"},
        priority=TestCasePriority.medium,
        test_case_type=TestCaseType.manual,
        tags=[],
    )
    step_one = TestCaseStep(
        id="step_exp_1",
        test_case_id=steps_case.id,
        position=1,
        action="Open login page",
        expected_result="Login form visible",
    )
    step_two = TestCaseStep(
        id="step_exp_2",
        test_case_id=steps_case.id,
        position=2,
        action="Submit valid credentials",
        expected_result="Dashboard shown",
    )
    db_session.add_all([project, membership, suite, steps_case, text_case, step_one, step_two])
    await db_session.commit()
    return project


@pytest.mark.parametrize(
    ("export_format", "expected_content_type", "expected_extension"),
    [
        ("csv", "text/csv", ".csv"),
        ("testlink_xml", "application/xml", ".xml"),
        ("xray_json", "application/json", ".json"),
        ("native_json", "application/json", ".json"),
        ("junit_xml", "application/xml", ".xml"),
    ],
)
async def test_export_single_test_case_formats(
    client, auth_headers, seeded_cases: Project, export_format, expected_content_type, expected_extension
):
    response = await client.get(
        f"/api/v1/test-cases/tc_export_steps_1/export?format={export_format}",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(expected_content_type)
    disposition = response.headers.get("content-disposition", "")
    assert "attachment;" in disposition
    assert expected_extension in disposition
    assert "EXP-1" in response.text


async def test_export_single_csv_contains_steps(client, auth_headers, seeded_cases: Project):
    response = await client.get(
        "/api/v1/test-cases/tc_export_steps_1/export?format=csv",
        headers=auth_headers,
    )
    assert response.status_code == 200
    text = response.text
    assert "Key" in text and "Expected Result" in text
    assert "Open login page" in text
    assert "Login form visible" in text


async def test_export_native_json_round_trip_fields(client, auth_headers, seeded_cases: Project):
    response = await client.get(
        "/api/v1/test-cases/tc_export_steps_1/export?format=native_json",
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = json.loads(response.content)
    assert body["schema"] == "karvio.test_cases.v1"
    assert body["count"] == 1
    case = body["test_cases"][0]
    assert case["key"] == "EXP-1"
    assert case["suite_name"] == "Auth"
    assert [s["action"] for s in case["steps"]] == ["Open login page", "Submit valid credentials"]


async def test_export_bulk_all_filtered(client, auth_headers, seeded_cases: Project):
    response = await client.get(
        f"/api/v1/test-cases/export?project_id={seeded_cases.id}&format=native_json",
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = json.loads(response.content)
    assert body["count"] == 2
    keys = {case["key"] for case in body["test_cases"]}
    assert keys == {"EXP-1", "EXP-2"}


async def test_export_bulk_selected_ids(client, auth_headers, seeded_cases: Project):
    response = await client.get(
        f"/api/v1/test-cases/export?project_id={seeded_cases.id}&format=csv"
        "&test_case_id=tc_export_text_1",
        headers=auth_headers,
    )
    assert response.status_code == 200
    text = response.text
    assert "EXP-2" in text
    assert "EXP-1" not in text


async def test_export_bulk_filter_by_priority(client, auth_headers, seeded_cases: Project):
    response = await client.get(
        f"/api/v1/test-cases/export?project_id={seeded_cases.id}&format=native_json"
        "&priority=high",
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = json.loads(response.content)
    assert body["count"] == 1
    assert body["test_cases"][0]["key"] == "EXP-1"


async def test_export_rejects_unsupported_format(client, auth_headers, seeded_cases: Project):
    response = await client.get(
        "/api/v1/test-cases/tc_export_steps_1/export?format=pdf",
        headers=auth_headers,
    )
    assert response.status_code == 422


async def test_export_requires_membership(client, auth_headers, db_session: AsyncSession):
    project = Project(id="proj_tc_export_no_member", name="No Member")
    case = TestCase(
        id="tc_export_no_member_1",
        project_id=project.id,
        key="NOM-1",
        title="Hidden",
        template_type=TestCaseTemplateType.text,
        template_payload={"steps_text": "x", "expected": "y"},
    )
    db_session.add_all([project, case])
    await db_session.commit()

    response = await client.get(
        "/api/v1/test-cases/tc_export_no_member_1/export?format=csv",
        headers=auth_headers,
    )
    assert response.status_code in (403, 404)
