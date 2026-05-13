import pytest

from app.models.enums import ProjectMemberRole, RunItemStatus, TestRunStatus as RunStatus
from app.modules.projects.models import Project, ProjectMember, User
from app.modules.test_cases.models import TestCase as CaseModel
from app.modules.test_runs.models import RunCaseRow, RunItem, TestRun as RunModel
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession


@pytest_asyncio.fixture
async def seeded_test_run(db_session: AsyncSession, auth_user: User) -> RunModel:
    project = Project(id="proj_report_export_1", name="Export Project")
    assignee = User(id="user_report_assignee_1", username="report_assignee", password_hash="hash")
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.viewer,
    )
    run = RunModel(
        id="run_report_export_1",
        project_id=project.id,
        name="Regression",
        description="Run for export coverage",
        environment_name_snapshot="staging",
        environment_revision_number=3,
        environment_snapshot={"environment": {"name": "staging"}, "topology": {}},
        build="2026.03.16",
        status=RunStatus.in_progress,
        created_by=auth_user.id,
        assignee=assignee.id,
    )
    first_case = CaseModel(
        id="tc_report_export_1",
        project_id=project.id,
        suite_id=None,
        key="RPT-1",
        title="Login works",
        tags=["smoke"],
    )
    second_case = CaseModel(
        id="tc_report_export_2",
        project_id=project.id,
        suite_id=None,
        key="RPT-2",
        title="Checkout validation",
        tags=["regression"],
    )
    passed_item = RunItem(
        id="ri_report_export_1",
        test_run_id=run.id,
        test_case_id=first_case.id,
        status=RunItemStatus.passed,
        assignee_id=assignee.id,
        executed_by=auth_user.id,
        execution_count=1,
        defect_ids=[],
        comment="All good",
    )
    failed_item = RunItem(
        id="ri_report_export_2",
        test_run_id=run.id,
        test_case_id=second_case.id,
        status=RunItemStatus.failure,
        assignee_id=assignee.id,
        executed_by=auth_user.id,
        execution_count=2,
        defect_ids=["BUG-101"],
        comment="Validation message missing",
    )
    passed_row = RunCaseRow(
        id="rir_report_export_1",
        run_case_id=passed_item.id,
        row_order=1,
        scenario_label="row_1",
        row_snapshot={"datasets": []},
        status=RunItemStatus.passed,
    )
    failed_row = RunCaseRow(
        id="rir_report_export_2",
        run_case_id=failed_item.id,
        row_order=1,
        scenario_label="row_1",
        row_snapshot={"datasets": []},
        status=RunItemStatus.blocked,
        defect_ids=["BUG-101"],
    )
    passed_item.rows_total = 1
    passed_item.rows_passed = 1
    passed_item.rows_failed = 0
    failed_item.rows_total = 1
    failed_item.rows_passed = 0
    failed_item.rows_failed = 1
    db_session.add_all(
        [project, assignee, membership, run, first_case, second_case, passed_item, failed_item, passed_row, failed_row]
    )
    await db_session.commit()
    return run


@pytest.mark.parametrize(
    ("report_format", "expected_content_type", "expected_extension"),
    [
        ("json", "application/json", ".json"),
        ("xml", "application/xml", ".xml"),
        ("pdf", "application/pdf", ".pdf"),
    ],
)
async def test_export_run_report_formats(client, auth_headers, seeded_test_run: RunModel, report_format, expected_content_type, expected_extension):
    response = await client.get(
        f"/api/v1/test-runs/{seeded_test_run.id}/export?format={report_format}",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(expected_content_type)
    disposition = response.headers.get("content-disposition", "")
    assert "attachment;" in disposition
    assert expected_extension in disposition

    if report_format == "json":
        body = response.json()
        assert body["test_run"]["id"] == seeded_test_run.id
        assert body["summary"]["total"] == 2
        assert body["summary"]["error"] == 0
        assert body["summary"]["failure"] == 1
        assert len(body["items"]) == 2
        assert len(body["failures"]) == 1
    elif report_format == "xml":
        assert response.text.startswith("<?xml")
        assert "<test_run_report>" in response.text
        assert "<summary>" in response.text
        assert "<failures>" in response.text
    else:
        assert response.content.startswith(b"%PDF-1.")
        assert b"Test Run Report" in response.content
        assert b"Status Distribution" in response.content


async def test_export_run_report_defaults_to_json(client, auth_headers, seeded_test_run: RunModel):
    response = await client.get(f"/api/v1/test-runs/{seeded_test_run.id}/export", headers=auth_headers)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json()["test_run"]["id"] == seeded_test_run.id


async def test_get_test_run_includes_summary_and_status_breakdown(client, auth_headers, seeded_test_run: RunModel):
    """GET /test-runs/{id} returns summary and status_breakdown (migrated from /overview)."""
    response = await client.get(f"/api/v1/test-runs/{seeded_test_run.id}", headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == seeded_test_run.id
    assert "summary" in body
    assert body["summary"]["total"] == 2
    assert body["summary"]["passed"] == 1
    assert body["summary"]["error"] == 0
    assert body["summary"]["failure"] == 1
    assert body["summary"]["blocked"] == 0
    assert body["summary"]["skipped"] == 0
    assert body["summary"]["pass_rate"] == 50.0
    assert "status_breakdown" in body
    assert "items" in body["status_breakdown"]
    items = {item["status"]: item["count"] for item in body["status_breakdown"]["items"]}
    assert items.get("passed", 0) == 1
    assert items.get("failure", 0) == 1


async def test_export_run_report_rejects_unsupported_format(client, auth_headers, seeded_test_run: RunModel):
    response = await client.get(
        f"/api/v1/test-runs/{seeded_test_run.id}/export?format=csv",
        headers=auth_headers,
    )

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
