from datetime import datetime
import json

from sqlalchemy import select

from app.models.enums import ProjectMemberRole, TestCaseStatus, TestRunStatus
from app.modules.projects.models import Project, ProjectMember, Suite, User
from app.modules.test_cases.models import DatasetRevision, DatasetRow, TestCase
from app.modules.test_cases.models import TestCaseDataset, TestDataset
from app.modules.test_runs.models import RunItem, TestRun
from sqlalchemy.ext.asyncio import AsyncSession


async def _create_key(client, headers, *, name: str) -> dict:
    response = await client.post("/api/v1/users/me/api-keys", json={"name": name}, headers=headers)
    assert response.status_code == 201
    return response.json()


async def test_import_junit_xml_updates_run_items_by_automation_id(client, db_session: AsyncSession, auth_headers, auth_user: User):
    project = Project(id="proj_junit_import_1", name="JUnit Import")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    run = TestRun(id="run_junit_import_1", project_id=project.id, name="JUnit Run", status=TestRunStatus.not_started)
    login_case = TestCase(
        id="tc_junit_login_1",
        project_id=project.id,
        key="JUNIT-TC-1",
        automation_id="AUTH-LOGIN-001",
        title="Login works",
        status=TestCaseStatus.active,
        tags=[],
    )
    logout_case = TestCase(
        id="tc_junit_logout_1",
        project_id=project.id,
        key="JUNIT-TC-2",
        title="Logout works",
        status=TestCaseStatus.active,
        tags=[],
    )
    login_item = RunItem(id="ri_junit_login_1", test_run_id=run.id, test_case_id=login_case.id)
    logout_item = RunItem(id="ri_junit_logout_1", test_run_id=run.id, test_case_id=logout_case.id)
    db_session.add_all([project, membership, run, login_case, logout_case, login_item, logout_item])
    await db_session.commit()

    junit_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="suite">
  <testcase classname="tests.auth" name="Login works" time="1.5">
    <properties>
      <property name="automation_id" value="AUTH-LOGIN-001" />
    </properties>
  </testcase>
  <testcase classname="tests.auth" name="Logout works" time="0.5">
    <failure message="logout failed">Traceback</failure>
  </testcase>
</testsuite>
"""

    response = await client.post(
        f"/api/v1/test-runs/{run.id}/imports/junit",
        params={"dry_run": "false"},
        files={"file": ("report.xml", junit_xml, "application/xml")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "completed"
    assert body["summary"] == {
        "total_cases": 2,
        "matched_by_automation_id": 1,
        "matched_by_name": 1,
        "created_test_cases": 0,
        "updated": 2,
        "unmatched": 0,
        "ambiguous": 0,
        "errors": 0,
    }
    assert body["source_filename"] == "report.xml"

    await db_session.refresh(run)
    await db_session.refresh(login_item)
    await db_session.refresh(logout_item)
    assert run.status == TestRunStatus.in_progress
    assert login_item.status.value == "passed"
    assert logout_item.status.value == "failure"
    assert logout_item.comment == "logout failed\n\nTraceback"
    assert login_item.duration_ms == 1500
    assert logout_item.duration_ms == 500


async def test_import_tms_json_updates_run_items_by_automation_id(client, db_session: AsyncSession, auth_headers, auth_user: User):
    project = Project(id="proj_tms_json_import_1", name="Karvio JSON Import")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    run = TestRun(id="run_tms_json_import_1", project_id=project.id, name="JSON Run", status=TestRunStatus.not_started)
    login_case = TestCase(
        id="tc_tms_json_login_1",
        project_id=project.id,
        key="JSON-TC-1",
        automation_id="AUTH-LOGIN-JSON-001",
        title="Login works",
        status=TestCaseStatus.active,
        tags=[],
    )
    logout_case = TestCase(
        id="tc_tms_json_logout_1",
        project_id=project.id,
        key="JSON-TC-2",
        title="Logout works",
        status=TestCaseStatus.active,
        tags=[],
    )
    login_item = RunItem(id="ri_tms_json_login_1", test_run_id=run.id, test_case_id=login_case.id)
    logout_item = RunItem(id="ri_tms_json_logout_1", test_run_id=run.id, test_case_id=logout_case.id)
    db_session.add_all([project, membership, run, login_case, logout_case, login_item, logout_item])
    await db_session.commit()

    payload = {
        "run_name": "JSON suite",
        "cases": [
            {
                "name": "Login works",
                "automation_id": "AUTH-LOGIN-JSON-001",
                "status": "passed",
                "duration_ms": 1500,
            },
            {
                "name": "Logout works",
                "status": "failure",
                "duration_ms": 500,
                "message": "logout failed",
                "details": "Traceback",
            },
        ],
    }
    report_json = json.dumps(payload).encode("utf-8")

    response = await client.post(
        f"/api/v1/test-runs/{run.id}/imports/junit",
        params={"dry_run": "false"},
        files={"file": ("report.json", report_json, "application/json")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "completed"
    assert body["summary"] == {
        "total_cases": 2,
        "matched_by_automation_id": 1,
        "matched_by_name": 1,
        "created_test_cases": 0,
        "updated": 2,
        "unmatched": 0,
        "ambiguous": 0,
        "errors": 0,
    }
    assert body["source_filename"] == "report.json"

    await db_session.refresh(run)
    await db_session.refresh(login_item)
    await db_session.refresh(logout_item)
    assert run.status == TestRunStatus.in_progress
    assert login_item.status.value == "passed"
    assert logout_item.status.value == "failure"
    assert logout_item.comment == "logout failed\n\nTraceback"


async def test_import_junit_xml_persists_testcase_logs(client, db_session: AsyncSession, auth_headers, auth_user: User):
    project = Project(id="proj_junit_import_logs", name="JUnit Logs")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    run = TestRun(id="run_junit_import_logs", project_id=project.id, name="JUnit Logs", status=TestRunStatus.not_started)
    test_case = TestCase(
        id="tc_junit_logs_1",
        project_id=project.id,
        key="JUNIT-LOGS-1",
        title="Case with logs",
        status=TestCaseStatus.active,
        tags=[],
    )
    run_item = RunItem(id="ri_junit_logs_1", test_run_id=run.id, test_case_id=test_case.id)
    db_session.add_all([project, membership, run, test_case, run_item])
    await db_session.commit()

    junit_xml = b"""<testsuite name="suite">
  <testcase name="Case with logs" time="0.2">
    <system-out>stdout payload</system-out>
    <system-err>stderr payload</system-err>
  </testcase>
</testsuite>
"""

    response = await client.post(
        f"/api/v1/test-runs/{run.id}/imports/junit",
        files={"file": ("logs.xml", junit_xml, "application/xml")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    await db_session.refresh(run_item)
    assert run_item.system_out == "stdout payload"
    assert run_item.system_err == "stderr payload"

    detail_response = await client.get(f"/api/v1/run-cases/{run_item.id}", headers=auth_headers)
    assert detail_response.status_code == 200
    rows_response = await client.get(f"/api/v1/run-cases/{run_item.id}/rows", headers=auth_headers)
    assert rows_response.status_code == 200
    rows = rows_response.json()["items"]
    assert len(rows) >= 1
    assert rows[0]["system_out"] == "stdout payload"
    assert rows[0]["system_err"] == "stderr payload"


async def test_import_junit_xml_dry_run_reports_unmatched_and_ambiguous_cases(
    client, db_session: AsyncSession, auth_headers, auth_user: User
):
    project = Project(id="proj_junit_import_2", name="JUnit Import Preview")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    run = TestRun(id="run_junit_import_2", project_id=project.id, name="JUnit Preview", status=TestRunStatus.in_progress)
    unique_case = TestCase(
        id="tc_junit_preview_1",
        project_id=project.id,
        key="JUNIT-PREVIEW-1",
        title="Unique title",
        status=TestCaseStatus.active,
        tags=[],
    )
    ambiguous_case_a = TestCase(
        id="tc_junit_preview_2",
        project_id=project.id,
        key="JUNIT-PREVIEW-2",
        title="Duplicate title",
        status=TestCaseStatus.active,
        tags=[],
    )
    ambiguous_case_b = TestCase(
        id="tc_junit_preview_3",
        project_id=project.id,
        key="JUNIT-PREVIEW-3",
        title="Duplicate title",
        status=TestCaseStatus.active,
        tags=[],
    )
    items = [
        RunItem(id="ri_junit_preview_1", test_run_id=run.id, test_case_id=unique_case.id),
        RunItem(id="ri_junit_preview_2", test_run_id=run.id, test_case_id=ambiguous_case_a.id),
        RunItem(id="ri_junit_preview_3", test_run_id=run.id, test_case_id=ambiguous_case_b.id),
    ]
    db_session.add_all([project, membership, run, unique_case, ambiguous_case_a, ambiguous_case_b, *items])
    await db_session.commit()

    junit_xml = b"""<testsuite name="suite">
  <testcase name="Unique title" />
  <testcase name="Duplicate title" />
  <testcase name="Missing title" />
</testsuite>
"""

    response = await client.post(
        f"/api/v1/test-runs/{run.id}/imports/junit",
        params={"dry_run": "true"},
        files={"file": ("preview.xml", junit_xml, "application/xml")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "preview"
    assert body["summary"] == {
        "total_cases": 3,
        "matched_by_automation_id": 0,
        "matched_by_name": 1,
        "created_test_cases": 0,
        "updated": 0,
        "unmatched": 1,
        "ambiguous": 1,
        "errors": 0,
    }
    assert body["unmatched_cases"] == [
        {
            "testcase_name": "Missing title",
            "testcase_classname": None,
            "automation_id": None,
            "reason": "no matching run item found",
        }
    ]
    assert body["ambiguous_cases"] == [
        {
            "testcase_name": "Duplicate title",
            "testcase_classname": None,
            "automation_id": None,
            "reason": "multiple run items matched by name",
        }
    ]

    for item in items:
        await db_session.refresh(item)
        assert item.status.value == "untested"


async def test_import_junit_xml_matches_by_suite_path_and_title_when_names_repeat(
    client, db_session: AsyncSession, auth_headers, auth_user: User
):
    project = Project(id="proj_junit_import_suite_match", name="JUnit Suite Match")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    run = TestRun(id="run_junit_import_suite_match", project_id=project.id, name="Suite Match", status=TestRunStatus.not_started)
    api_root = Suite(id="suite_api_root", project_id=project.id, name="api")
    auth_suite = Suite(id="suite_api_auth", project_id=project.id, name="auth", parent_id=api_root.id)
    billing_suite = Suite(id="suite_api_billing", project_id=project.id, name="billing", parent_id=api_root.id)
    auth_case = TestCase(
        id="tc_suite_match_auth",
        project_id=project.id,
        key="JUNIT-SUITE-1",
        title="Login works",
        suite_id=auth_suite.id,
        status=TestCaseStatus.active,
        tags=[],
    )
    billing_case = TestCase(
        id="tc_suite_match_billing",
        project_id=project.id,
        key="JUNIT-SUITE-2",
        title="Login works",
        suite_id=billing_suite.id,
        status=TestCaseStatus.active,
        tags=[],
    )
    auth_item = RunItem(id="ri_suite_match_auth", test_run_id=run.id, test_case_id=auth_case.id)
    billing_item = RunItem(id="ri_suite_match_billing", test_run_id=run.id, test_case_id=billing_case.id)
    db_session.add_all(
        [project, membership, run, api_root, auth_suite, billing_suite, auth_case, billing_case, auth_item, billing_item]
    )
    await db_session.commit()

    junit_xml = b"""<testsuite name="suite">
  <testcase name="test_login_works">
    <properties>
      <property name="tms_test_title" value="Login works" />
      <property name="tms_suite_path" value='["api", "auth"]' />
    </properties>
  </testcase>
</testsuite>
"""

    response = await client.post(
        f"/api/v1/test-runs/{run.id}/imports/junit",
        files={"file": ("suite-match.xml", junit_xml, "application/xml")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["summary"]["matched_by_name"] == 1

    await db_session.refresh(auth_item)
    await db_session.refresh(billing_item)
    assert auth_item.status.value == "passed"
    assert billing_item.status.value == "untested"


async def test_import_junit_xml_matches_pytest_style_function_name_to_human_title(
    client, db_session: AsyncSession, auth_headers, auth_user: User
):
    project = Project(id="proj_junit_import_pytest_name", name="JUnit Pytest Name")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    run = TestRun(id="run_junit_import_pytest_name", project_id=project.id, name="Pytest Name", status=TestRunStatus.not_started)
    test_case = TestCase(
        id="tc_pytest_name_match",
        project_id=project.id,
        key="JUNIT-PYTEST-1",
        title="Login works",
        status=TestCaseStatus.active,
        tags=[],
    )
    run_item = RunItem(id="ri_pytest_name_match", test_run_id=run.id, test_case_id=test_case.id)
    db_session.add_all([project, membership, run, test_case, run_item])
    await db_session.commit()

    junit_xml = b"""<testsuite name="suite">
  <testcase name="test_login_works" />
</testsuite>
"""

    response = await client.post(
        f"/api/v1/test-runs/{run.id}/imports/junit",
        files={"file": ("pytest-name.xml", junit_xml, "application/xml")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["summary"]["matched_by_name"] == 1

    await db_session.refresh(run_item)
    assert run_item.status.value == "passed"


async def test_create_test_case_accepts_unique_automation_id(client, db_session: AsyncSession, auth_headers, auth_user: User):
    project = Project(id="proj_case_automation_1", name="Case Automation")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    existing = TestCase(
        id="tc_case_automation_existing",
        project_id=project.id,
        key="AUT-TC-1",
        title="Existing",
        automation_id="AUTO-1",
        status=TestCaseStatus.active,
        tags=[],
    )
    db_session.add_all([project, membership, existing])
    await db_session.commit()

    project_id = project.id

    duplicate = await client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project_id,
            "title": "Duplicate automation id",
            "automation_id": "AUTO-1",
            "tags": [],
        },
        headers=auth_headers,
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "automation_id_already_exists"

    created = await client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project_id,
            "title": "Unique automation id",
            "automation_id": "AUTO-2",
            "tags": [],
        },
        headers=auth_headers,
    )
    assert created.status_code == 201
    assert created.json()["automation_id"] == "AUTO-2"


async def test_project_level_import_junit_xml_creates_new_run_when_no_matching_run(
    client, db_session: AsyncSession, auth_headers, auth_user: User
):
    project = Project(id="proj_junit_project_import_1", name="JUnit Project Import")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    login_case = TestCase(
        id="tc_project_junit_login_1",
        project_id=project.id,
        key="PROJ-JUNIT-1",
        automation_id="AUTH-LOGIN-010",
        title="Login API works",
        status=TestCaseStatus.active,
        tags=[],
    )
    db_session.add_all([project, membership, login_case])
    await db_session.commit()

    junit_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="Nightly API" timestamp="2026-03-21T09:15:00+00:00">
  <testcase classname="tests.api" name="Login API works" time="0.9">
    <properties>
      <property name="automation_id" value="AUTH-LOGIN-010" />
    </properties>
  </testcase>
</testsuite>
"""

    response = await client.post(
        f"/api/v1/projects/{project.id}/imports/junit",
        files={"file": ("nightly.xml", junit_xml, "application/xml")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["target_run"]["match_mode"] == "created"
    assert body["target_run"]["name"] == "Nightly API"
    assert body["summary"]["updated"] == 1
    created_run = await db_session.get(TestRun, body["test_run_id"])
    assert created_run is not None
    assert created_run.name == "Nightly API"
    run_item = await db_session.scalar(select(RunItem).where(RunItem.test_run_id == created_run.id))
    assert run_item is not None
    assert run_item.status.value == "passed"


async def test_project_level_import_junit_xml_reuses_matching_run_by_name_and_timestamp(
    client, db_session: AsyncSession, auth_headers, auth_user: User
):
    project = Project(id="proj_junit_project_import_2", name="JUnit Project Import 2")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    test_case = TestCase(
        id="tc_project_junit_name_1",
        project_id=project.id,
        key="PROJ-JUNIT-2",
        title="Name fallback case",
        status=TestCaseStatus.active,
        tags=[],
    )
    existing_run = TestRun(
        id="run_project_junit_existing_1",
        project_id=project.id,
        name="Regression Browser",
        status=TestRunStatus.in_progress,
    )
    existing_run.created_at = existing_run.updated_at = datetime.fromisoformat("2026-03-21T09:00:00+00:00")
    db_session.add_all([project, membership, test_case, existing_run])
    await db_session.commit()

    junit_xml = b"""<testsuite name="Regression Browser" timestamp="2026-03-21T09:20:00+00:00">
  <testcase name="Name fallback case">
    <failure message="boom">stack</failure>
  </testcase>
</testsuite>
"""

    response = await client.post(
        f"/api/v1/projects/{project.id}/imports/junit",
        files={"file": ("browser.xml", junit_xml, "application/xml")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["test_run_id"] == existing_run.id
    assert body["target_run"]["match_mode"] == "existing"
    run_item = await db_session.scalar(select(RunItem).where(RunItem.test_run_id == existing_run.id))
    assert run_item is not None
    assert run_item.status.value == "failure"


async def test_project_level_import_junit_xml_creates_missing_test_cases_when_enabled(
    client, db_session: AsyncSession, auth_headers, auth_user: User
):
    project = Project(id="proj_junit_project_import_3", name="JUnit Project Import 3")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    junit_xml = b"""<testsuite name="Generated Cases">
  <testcase name="Created from junit">
    <properties>
      <property name="automation_id" value="AUTO-CREATED-001" />
    </properties>
  </testcase>
</testsuite>
"""

    response = await client.post(
        f"/api/v1/projects/{project.id}/imports/junit",
        params={"create_missing_cases": "true"},
        files={"file": ("generated.xml", junit_xml, "application/xml")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["summary"] == {
        "total_cases": 1,
        "matched_by_automation_id": 1,
        "matched_by_name": 0,
        "created_test_cases": 1,
        "updated": 1,
        "unmatched": 0,
        "ambiguous": 0,
        "errors": 0,
    }
    created_case = await db_session.scalar(
        select(TestCase).where(
            TestCase.project_id == project.id,
            TestCase.automation_id == "AUTO-CREATED-001",
        )
    )
    assert created_case is not None
    assert body["created_cases"] == [
        {
            "id": created_case.id,
            "key": created_case.key,
            "title": "Created from junit",
            "automation_id": "AUTO-CREATED-001",
        }
    ]
    assert created_case.title == "Created from junit"
    assert created_case.owner_id == auth_user.id
    assert created_case.template_type.value == "automated"
    assert created_case.test_case_type.value == "automated"
    assert created_case.status.value == "active"
    assert "auto-imported" in created_case.tags
    assert created_case.template_payload == {
        "raw_test": "Created from junit",
        "raw_test_language": "python",
    }


async def test_run_level_import_junit_xml_can_create_missing_test_cases_when_enabled(
    client, db_session: AsyncSession, auth_headers, auth_user: User
):
    project = Project(id="proj_junit_run_import_3", name="JUnit Run Import 3")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    run = TestRun(id="run_junit_import_3", project_id=project.id, name="Import Into Existing", status=TestRunStatus.not_started)
    db_session.add_all([project, membership, run])
    await db_session.commit()

    junit_xml = b"""<testsuite name="suite">
  <testcase name="Created in existing run">
    <properties>
      <property name="automation_id" value="RUN-AUTO-001" />
    </properties>
  </testcase>
</testsuite>
"""

    response = await client.post(
        f"/api/v1/test-runs/{run.id}/imports/junit",
        params={"create_missing_cases": "true"},
        files={"file": ("run-create.xml", junit_xml, "application/xml")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["summary"] == {
        "total_cases": 1,
        "matched_by_automation_id": 1,
        "matched_by_name": 0,
        "created_test_cases": 1,
        "updated": 1,
        "unmatched": 0,
        "ambiguous": 0,
        "errors": 0,
    }
    created_case = await db_session.scalar(
        select(TestCase).where(
            TestCase.project_id == project.id,
            TestCase.automation_id == "RUN-AUTO-001",
        )
    )
    assert created_case is not None
    assert created_case.owner_id == auth_user.id
    assert body["created_cases"] == [
        {
            "id": created_case.id,
            "key": created_case.key,
            "title": "Created in existing run",
            "automation_id": "RUN-AUTO-001",
        }
    ]
    run_item = await db_session.scalar(
        select(RunItem).where(
            RunItem.test_run_id == run.id,
            RunItem.test_case_id == created_case.id,
        )
    )
    assert run_item is not None


async def test_project_level_junit_import_via_api_key_defaults_owner_to_key_user(
    client, db_session: AsyncSession, auth_headers, auth_user: User
):
    created = await _create_key(client, auth_headers, name="JUnit importer")
    api_headers = {"X-API-Key": created["api_key"]}

    project = Project(id="proj_junit_project_import_key_owner", name="JUnit Project Import Key Owner")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    junit_xml = b"""<testsuite name="Generated Cases">
  <testcase name="Created from junit api key">
    <properties>
      <property name="automation_id" value="AUTO-CREATED-KEY-001" />
    </properties>
  </testcase>
</testsuite>
"""

    response = await client.post(
        f"/api/v1/projects/{project.id}/imports/junit",
        params={"create_missing_cases": "true"},
        files={"file": ("generated.xml", junit_xml, "application/xml")},
        headers=api_headers,
    )

    assert response.status_code == 201
    created_case = await db_session.scalar(
        select(TestCase).where(
            TestCase.project_id == project.id,
            TestCase.automation_id == "AUTO-CREATED-KEY-001",
        )
    )
    assert created_case is not None
    assert created_case.owner_id == auth_user.id


async def test_project_level_import_junit_xml_parses_preconditions_steps_and_assertions_for_created_cases(
    client, db_session: AsyncSession, auth_headers, auth_user: User
):
    project = Project(id="proj_junit_import_parse_sections", name="JUnit Parse Sections")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    junit_xml = b"""<testsuite name="suite">
  <testcase name="test_checkout_happy_path">
    <properties>
      <property name="automation_id" value="AUTO-PARSE-001" />
      <property name="tms_test_title" value="Checkout happy path" />
      <property name="tms_preconditions" value="User is authenticated&#10;Cart contains one item" />
      <property name="tms_steps" value="1. Open checkout&#10;2. Confirm payment" />
      <property name="tms_assertions" value="Order is created&#10;Confirmation is visible" />
    </properties>
  </testcase>
</testsuite>
"""

    response = await client.post(
        f"/api/v1/projects/{project.id}/imports/junit",
        params={"create_missing_cases": "true"},
        files={"file": ("generated.xml", junit_xml, "application/xml")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    created_case = await db_session.scalar(
        select(TestCase).where(
            TestCase.project_id == project.id,
            TestCase.automation_id == "AUTO-PARSE-001",
        )
    )
    assert created_case is not None
    assert created_case.template_payload == {
        "raw_test": "1. Open checkout\n2. Confirm payment",
        "raw_test_language": "python",
    }


async def test_run_level_dry_run_junit_xml_reports_cases_that_would_be_created(
    client, db_session: AsyncSession, auth_headers, auth_user: User
):
    project = Project(id="proj_junit_run_import_4", name="JUnit Run Import 4")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    run = TestRun(id="run_junit_import_4", project_id=project.id, name="Preview Existing", status=TestRunStatus.in_progress)
    db_session.add_all([project, membership, run])
    await db_session.commit()

    junit_xml = b"""<testsuite name="suite">
  <testcase name="Preview created case">
    <properties>
      <property name="automation_id" value="PREVIEW-AUTO-001" />
    </properties>
  </testcase>
</testsuite>
"""

    response = await client.post(
        f"/api/v1/test-runs/{run.id}/imports/junit",
        params={"dry_run": "true", "create_missing_cases": "true"},
        files={"file": ("preview-create.xml", junit_xml, "application/xml")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "preview"
    assert body["summary"]["created_test_cases"] == 1
    assert body["created_cases"] == [
        {
            "id": None,
            "key": None,
            "title": "Preview created case",
            "automation_id": "PREVIEW-AUTO-001",
        }
    ]


async def test_project_level_import_junit_xml_supports_nested_testsuites_for_case_creation(
    client, db_session: AsyncSession, auth_headers, auth_user: User
):
    project = Project(id="proj_junit_project_import_nested", name="JUnit Nested Import")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    junit_xml = b"""<?xml version="1.0" encoding="utf-8"?>
<testsuites name="acme-platform-regression" timestamp="2026-03-21T09:00:00Z">
  <testsuite name="platform-ci">
    <testsuite name="backend">
      <testsuite name="auth-service">
        <testcase name="shouldAuthenticateWithValidCredentials" classname="com.acme.AuthServiceTest">
          <properties>
            <property name="automation_id" value="AUTH-NESTED-001" />
          </properties>
        </testcase>
      </testsuite>
    </testsuite>
  </testsuite>
</testsuites>
"""

    response = await client.post(
        f"/api/v1/projects/{project.id}/imports/junit",
        params={"create_missing_cases": "true"},
        files={"file": ("nested.xml", junit_xml, "application/xml")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["summary"]["total_cases"] == 1
    assert body["summary"]["created_test_cases"] == 1
    assert body["summary"]["updated"] == 1
    created_case = await db_session.scalar(
        select(TestCase).where(
            TestCase.project_id == project.id,
            TestCase.automation_id == "AUTH-NESTED-001",
        )
    )
    assert created_case is not None
    assert created_case.title == "shouldAuthenticateWithValidCredentials"


async def test_project_level_import_junit_xml_can_create_nested_suites_for_created_case(
    client, db_session: AsyncSession, auth_headers, auth_user: User
):
    project = Project(id="proj_junit_project_import_suites", name="JUnit Suite Import")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    junit_xml = b"""<?xml version="1.0" encoding="utf-8"?>
<testsuites name="acme-platform-regression">
  <testsuite name="platform-ci">
    <testsuite name="backend">
      <testsuite name="auth-service">
        <testcase name="suite aware case">
          <properties>
            <property name="automation_id" value="SUITE-AWARE-001" />
          </properties>
        </testcase>
      </testsuite>
    </testsuite>
  </testsuite>
</testsuites>
"""

    response = await client.post(
        f"/api/v1/projects/{project.id}/imports/junit",
        params={"create_missing_cases": "true"},
        files={"file": ("nested-suites.xml", junit_xml, "application/xml")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    created_case = await db_session.scalar(
        select(TestCase).where(
            TestCase.project_id == project.id,
            TestCase.automation_id == "SUITE-AWARE-001",
        )
    )
    assert created_case is not None
    leaf_suite = await db_session.get(Suite, created_case.suite_id)
    assert leaf_suite is not None
    assert leaf_suite.name == "auth-service"
    parent_suite = await db_session.get(Suite, leaf_suite.parent_id)
    assert parent_suite is not None
    assert parent_suite.name == "backend"
    root_suite = await db_session.get(Suite, parent_suite.parent_id)
    assert root_suite is not None
    assert root_suite.name == "platform-ci"


async def test_project_level_import_junit_xml_creates_case_without_suite_if_suite_creation_fails(
    client, db_session: AsyncSession, auth_headers, auth_user: User
):
    project = Project(id="proj_junit_project_import_suite_fallback", name="JUnit Suite Fallback")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    root = Suite(id="suite_lvl_1", project_id=project.id, name="lvl1")
    lvl2 = Suite(id="suite_lvl_2", project_id=project.id, name="lvl2", parent_id=root.id)
    lvl3 = Suite(id="suite_lvl_3", project_id=project.id, name="lvl3", parent_id=lvl2.id)
    lvl4 = Suite(id="suite_lvl_4", project_id=project.id, name="lvl4", parent_id=lvl3.id)
    lvl5 = Suite(id="suite_lvl_5", project_id=project.id, name="lvl5", parent_id=lvl4.id)
    db_session.add_all([project, membership, root, lvl2, lvl3, lvl4, lvl5])
    await db_session.commit()

    junit_xml = b"""<?xml version="1.0" encoding="utf-8"?>
<testsuites>
  <testsuite name="lvl1">
    <testsuite name="lvl2">
      <testsuite name="lvl3">
        <testsuite name="lvl4">
          <testsuite name="lvl5">
            <testsuite name="lvl6">
              <testcase name="Case without suite fallback">
                <properties>
                  <property name="automation_id" value="SUITE-FALLBACK-001" />
                </properties>
              </testcase>
            </testsuite>
          </testsuite>
        </testsuite>
      </testsuite>
    </testsuite>
  </testsuite>
</testsuites>
"""

    response = await client.post(
        f"/api/v1/projects/{project.id}/imports/junit",
        params={"create_missing_cases": "true"},
        files={"file": ("suite-fallback.xml", junit_xml, "application/xml")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    created_case = await db_session.scalar(
        select(TestCase).where(
            TestCase.project_id == project.id,
            TestCase.automation_id == "SUITE-FALLBACK-001",
        )
    )
    assert created_case is not None
    assert created_case.suite_id is None


async def test_project_level_import_junit_xml_creates_datasets_for_parameterized_pytest_case(
    client, db_session: AsyncSession, auth_headers, auth_user: User
):
    project = Project(id="proj_junit_param_ds", name="JUnit Param Datasets")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    test_case = TestCase(
        id="tc_junit_param_ds",
        project_id=project.id,
        key="JUNIT-PARAM-1",
        title="Login works",
        automation_id="AUTH-LOGIN-PARAM-1",
        status=TestCaseStatus.active,
        tags=[],
    )
    db_session.add_all([project, membership, test_case])
    await db_session.commit()

    junit_xml = b"""<?xml version="1.0" encoding="utf-8"?>
<testsuite name="Pytest Param">
  <testcase name="test_login_works[admin]" time="0.1">
    <properties>
      <property name="automation_id" value="AUTH-LOGIN-PARAM-1" />
      <property name="tms_test_title" value="Login works" />
      <property name="tms_dataset_key" value="admin" />
      <property name="tms_dataset_name" value="admin" />
      <property name="tms_dataset_data" value='{"role":"admin"}' />
      <property name="tms_dataset_source_ref" value="tests/test_auth.py::test_login_works[admin]" />
    </properties>
  </testcase>
  <testcase name="test_login_works[guest]" time="0.2">
    <properties>
      <property name="automation_id" value="AUTH-LOGIN-PARAM-1" />
      <property name="tms_test_title" value="Login works" />
      <property name="tms_dataset_key" value="guest" />
      <property name="tms_dataset_name" value="guest" />
      <property name="tms_dataset_data" value='{"role":"guest"}' />
      <property name="tms_dataset_source_ref" value="tests/test_auth.py::test_login_works[guest]" />
    </properties>
  </testcase>
</testsuite>
"""

    response = await client.post(
        f"/api/v1/projects/{project.id}/imports/junit",
        params={"create_missing_cases": "true"},
        files={"file": ("param.xml", junit_xml, "application/xml")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    run_id = response.json()["test_run_id"]
    run_cases = (await client.get(f"/api/v1/run-cases?test_run_id={run_id}", headers=auth_headers)).json()["items"]
    assert len(run_cases) == 1
    assert run_cases[0]["rows_total"] == 2

    datasets = (await db_session.scalars(select(TestDataset).where(TestDataset.project_id == project.id))).all()
    assert len(datasets) == 2
    assert {dataset.source_type.value for dataset in datasets} == {"pytest_parametrize"}
    assert {dataset.current_revision_number for dataset in datasets} == {1}
    role_rows = (
        await db_session.execute(
            select(DatasetRow.values_json)
            .join(DatasetRevision, DatasetRevision.id == DatasetRow.dataset_revision_id)
            .join(TestDataset, TestDataset.id == DatasetRevision.dataset_id)
            .where(TestDataset.project_id == project.id)
        )
    ).all()
    assert {values.get("role") for (values,) in role_rows} == {"admin", "guest"}

    test_cases = (await db_session.scalars(select(TestCase).where(TestCase.project_id == project.id))).all()
    assert len(test_cases) == 1

    links = (
        await db_session.scalars(select(TestCaseDataset).where(TestCaseDataset.test_case_id == test_case.id))
    ).all()
    assert len(links) == 2
