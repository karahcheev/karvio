"""Tests for run-cases API (replaces test_run_results_api)."""

from app.models.enums import ProjectMemberRole, TestCaseStatus, TestRunStatus
from app.modules.projects.models import Project, ProjectMember, Suite, User
from app.modules.test_cases.models import TestCase
from app.modules.test_cases.models import TestCaseDatasetBinding, TestDataset
from app.modules.test_runs.models import RunCaseRow, RunItem, TestRun
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession


@pytest_asyncio.fixture
async def seeded_run_case(db_session: AsyncSession, auth_user: User) -> RunItem:
    project = Project(id="proj_run_cases_1", name="Run Cases")
    test_case = TestCase(
        id="tc_run_cases_1",
        project_id=project.id,
        suite_id=None,
        key="RC-TC-1",
        title="Case",
        tags=[],
    )
    run = TestRun(id="run_run_cases_1", project_id=project.id, name="Run", status=TestRunStatus.in_progress)
    item = RunItem(id="ri_run_cases_1", test_run_id=run.id, test_case_id=test_case.id, rows_total=1)
    row = RunCaseRow(
        id="rcr_run_cases_1",
        run_case_id=item.id,
        row_order=1,
        scenario_label="default",
        row_snapshot={"datasets": []},
    )
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.tester,
    )
    db_session.add_all([project, test_case, run, item, row, membership])
    await db_session.commit()
    return item


async def test_run_cases_crud_flow(client, db_session: AsyncSession, auth_headers, seeded_run_case: RunItem):
    rows_resp = await client.get(f"/api/v1/run-cases/{seeded_run_case.id}/rows", headers=auth_headers)
    assert rows_resp.status_code == 200
    run_row_id = rows_resp.json()["items"][0]["id"]

    patch_response = await client.patch(
        f"/api/v1/run-cases/rows/{run_row_id}",
        json={
            "status": "passed",
            "comment": "Looks good",
            "defect_ids": ["BUG-1"],
            "system_out": "captured stdout",
            "system_err": "captured stderr",
            "executed_by_id": "user_auth_1",
        },
        headers=auth_headers,
    )

    assert patch_response.status_code == 200
    patched = patch_response.json()
    assert patched["id"] == run_row_id
    assert patched["status"] == "passed"
    assert patched["comment"] == "Looks good"
    assert patched["defect_ids"] == ["BUG-1"]
    assert patched["system_out"] == "captured stdout"
    assert patched["system_err"] == "captured stderr"

    await db_session.refresh(seeded_run_case)
    assert seeded_run_case.status.value == "passed"
    assert seeded_run_case.rows_passed == 1

    list_response = await client.get(
        f"/api/v1/run-cases?test_run_id={seeded_run_case.test_run_id}",
        headers=auth_headers,
    )
    assert list_response.status_code == 200
    assert len(list_response.json()["items"]) >= 1

    get_response = await client.get(f"/api/v1/run-cases/{seeded_run_case.id}", headers=auth_headers)
    assert get_response.status_code == 200
    assert get_response.json()["id"] == seeded_run_case.id

    patch_reopen = await client.patch(
        f"/api/v1/run-cases/rows/{run_row_id}",
        json={"status": "in_progress"},
        headers=auth_headers,
    )
    assert patch_reopen.status_code == 200

    patch2_response = await client.patch(
        f"/api/v1/run-cases/rows/{run_row_id}",
        json={
            "status": "failure",
            "comment": "Actually failed",
            "defect_ids": ["BUG-2"],
        },
        headers=auth_headers,
    )
    assert patch2_response.status_code == 200
    patched2 = patch2_response.json()
    assert patched2["status"] == "failure"
    assert patched2["comment"] == "Actually failed"
    assert patched2["defect_ids"] == ["BUG-2"]

    await db_session.refresh(seeded_run_case)
    assert seeded_run_case.status.value == "failure"
    assert seeded_run_case.rows_failed == 1


async def test_run_case_history_embedded_in_get(client, db_session: AsyncSession, auth_headers, seeded_run_case: RunItem):
    """GET /run-cases/{id} returns run case with embedded history."""
    rows_resp = await client.get(f"/api/v1/run-cases/{seeded_run_case.id}/rows", headers=auth_headers)
    row_id = rows_resp.json()["items"][0]["id"]
    await client.patch(
        f"/api/v1/run-cases/rows/{row_id}",
        json={"status": "passed", "comment": "ok", "defect_ids": [], "executed_by_id": "user_auth_1"},
        headers=auth_headers,
    )

    get_response = await client.get(f"/api/v1/run-cases/{seeded_run_case.id}", headers=auth_headers)
    assert get_response.status_code == 200
    body = get_response.json()
    assert body["id"] == seeded_run_case.id
    assert "history" in body
    history = body["history"]
    assert "items" in history
    assert len(history["items"]) >= 1
    first = history["items"][0]
    assert first["to_status"] == "passed"
    assert first["from_status"] == "untested"
    assert first["comment"] == "ok"


async def test_run_case_history_keeps_logs(client, db_session: AsyncSession, auth_headers, seeded_run_case: RunItem):
    rows_resp = await client.get(f"/api/v1/run-cases/{seeded_run_case.id}/rows", headers=auth_headers)
    row_id = rows_resp.json()["items"][0]["id"]
    await client.patch(
        f"/api/v1/run-cases/rows/{row_id}",
        json={
            "status": "passed",
            "comment": "ok",
            "system_out": "stdout line",
            "system_err": "stderr line",
            "defect_ids": [],
            "executed_by_id": "user_auth_1",
        },
        headers=auth_headers,
    )

    get_response = await client.get(f"/api/v1/run-cases/{seeded_run_case.id}", headers=auth_headers)
    assert get_response.status_code == 200
    body = get_response.json()
    rows = await client.get(f"/api/v1/run-cases/{seeded_run_case.id}/rows", headers=auth_headers)
    assert rows.status_code == 200
    assert rows.json()["items"][0]["system_out"] == "stdout line"
    assert rows.json()["items"][0]["system_err"] == "stderr line"
    assert body["history"]["items"][0]["system_out"] == "stdout line"
    assert body["history"]["items"][0]["system_err"] == "stderr line"


async def test_run_case_attachments(client, db_session: AsyncSession, auth_headers, seeded_run_case: RunItem):
    """Attachments API supports run_case owner_type."""
    rows_resp = await client.get(f"/api/v1/run-cases/{seeded_run_case.id}/rows", headers=auth_headers)
    row_id = rows_resp.json()["items"][0]["id"]
    await client.patch(
        f"/api/v1/run-cases/rows/{row_id}",
        json={"status": "passed", "comment": "ok", "defect_ids": [], "executed_by_id": "user_auth_1"},
        headers=auth_headers,
    )

    uploaded = await client.post(
        "/api/v1/attachments",
        data={"run_case_id": seeded_run_case.id},
        files={"file": ("evidence.png", b"png-data", "image/png")},
        headers=auth_headers,
    )
    assert uploaded.status_code == 201
    attachment = uploaded.json()
    assert attachment["id"]
    assert attachment["filename"] == "evidence.png"

    list_response = await client.get(
        f"/api/v1/attachments?run_case_id={seeded_run_case.id}",
        headers=auth_headers,
    )
    assert list_response.status_code == 200
    assert len(list_response.json()["items"]) == 1

    download_response = await client.get(f"/api/v1/attachments/{attachment['id']}", headers=auth_headers)
    assert download_response.status_code == 200
    assert download_response.content == b"png-data"

    delete_response = await client.delete(f"/api/v1/attachments/{attachment['id']}", headers=auth_headers)
    assert delete_response.status_code == 204

    list_after = await client.get(
        f"/api/v1/attachments?run_case_id={seeded_run_case.id}",
        headers=auth_headers,
    )
    assert list_after.status_code == 200
    assert len(list_after.json()["items"]) == 0


async def test_list_run_cases_by_project_and_test_case_history(
    client, db_session: AsyncSession, auth_headers, auth_user: User
):
    project = Project(id="proj_run_cases_hist_1", name="History Project")
    test_case = TestCase(
        id="tc_run_cases_hist_1",
        project_id=project.id,
        suite_id=None,
        key="HIST-TC-1",
        title="History case",
        tags=["smoke"],
    )
    run_old = TestRun(
        id="run_hist_1",
        project_id=project.id,
        name="Nightly #1",
        status=TestRunStatus.in_progress,
        environment_name_snapshot="staging",
        environment_revision_number=1,
        environment_snapshot={"environment": {"name": "staging"}, "topology": {}},
        build="1.0.0",
    )
    run_new = TestRun(
        id="run_hist_2",
        project_id=project.id,
        name="Nightly #2",
        status=TestRunStatus.in_progress,
        environment_name_snapshot="prod-like",
        environment_revision_number=2,
        environment_snapshot={"environment": {"name": "prod-like"}, "topology": {}},
        build="1.0.1",
    )
    item_old = RunItem(id="ri_hist_1", test_run_id=run_old.id, test_case_id=test_case.id)
    item_new = RunItem(id="ri_hist_2", test_run_id=run_new.id, test_case_id=test_case.id)
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.tester,
    )
    row_old = RunCaseRow(id="rcr_hist_1", run_case_id=item_old.id, row_order=1, scenario_label="old", row_snapshot={"datasets": []})
    row_new = RunCaseRow(id="rcr_hist_2", run_case_id=item_new.id, row_order=1, scenario_label="new", row_snapshot={"datasets": []})
    db_session.add_all([project, test_case, run_old, run_new, item_old, item_new, row_old, row_new, membership])
    await db_session.commit()

    item_old_id = item_old.id
    item_new_id = item_new.id
    row_old_id = row_old.id
    row_new_id = row_new.id
    auth_user_id = auth_user.id

    await client.patch(
        f"/api/v1/run-cases/rows/{row_old_id}",
        json={"status": "passed", "comment": "old result", "executed_by_id": auth_user_id},
        headers=auth_headers,
    )
    await client.patch(
        f"/api/v1/run-cases/rows/{row_new_id}",
        json={"status": "error", "comment": "new result", "executed_by_id": auth_user_id},
        headers=auth_headers,
    )

    response = await client.get(
        f"/api/v1/run-cases?project_id={project.id}&test_case_id={test_case.id}&sort_by=last_executed_at&sort_order=desc",
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 2
    assert body["items"][0]["id"] == item_new_id
    assert body["items"][0]["test_run_name"] == "Nightly #2"
    assert body["items"][0]["test_run_status"] == "in_progress"
    assert body["items"][0]["test_run_environment_name"] == "prod-like"
    assert body["items"][0]["test_run_build"] == "1.0.1"
    assert body["items"][1]["id"] == item_old_id


async def test_create_run_case_with_dataset(client, db_session: AsyncSession, auth_headers, auth_user: User):
    project = Project(id="proj_run_ds_1", name="Run Dataset")
    suite = Suite(id="suite_run_ds_1", project_id=project.id, name="Suite")
    test_case = TestCase(
        id="tc_run_ds_1",
        project_id=project.id,
        suite_id=suite.id,
        key="RUN-DS-1",
        title="Case with dataset",
        status=TestCaseStatus.active,
        tags=[],
    )
    dataset = TestDataset(id="ds_run_1", project_id=project.id, name="Dataset Run")
    link = TestCaseDatasetBinding(test_case_id=test_case.id, dataset_id=dataset.id, dataset_alias="env_data")
    run = TestRun(id="run_ds_1", project_id=project.id, name="Run", status=TestRunStatus.not_started)
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, suite, test_case, dataset, link, run, membership])
    await db_session.commit()
    from app.modules.test_cases.repositories import datasets as test_dataset_repo
    await test_dataset_repo.create_revision(
        db_session,
        dataset=dataset,
        columns=[{"column_key": "env", "display_name": "Env"}],
        rows=[{"row_key": "stage", "values": {"env": "stage"}, "scenario_label": "stage"}],
        created_by=auth_user.id,
        change_summary="seed",
    )
    await db_session.commit()

    create_resp = await client.post(
        "/api/v1/run-cases",
        json={"test_run_id": run.id, "test_case_id": test_case.id},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    body = create_resp.json()
    assert body["rows_total"] == 1


async def test_run_case_keeps_snapshot_after_test_case_delete(client, db_session: AsyncSession, auth_headers, auth_user: User):
    project = Project(id="proj_run_snapshot_1", name="Run Snapshot")
    suite = Suite(id="suite_run_snapshot_1", project_id=project.id, name="Checkout")
    test_case = TestCase(
        id="tc_run_snapshot_1",
        project_id=project.id,
        suite_id=suite.id,
        key="SNAP-TC-1",
        title="Checkout succeeds",
        status=TestCaseStatus.active,
        tags=["critical"],
    )
    run = TestRun(id="run_snapshot_1", project_id=project.id, name="Nightly", status=TestRunStatus.in_progress)
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    db_session.add_all([project, suite, test_case, run, membership])
    await db_session.commit()

    create_response = await client.post(
        "/api/v1/run-cases",
        json={"test_run_id": run.id, "test_case_id": test_case.id},
        headers=auth_headers,
    )
    assert create_response.status_code == 201
    run_case = create_response.json()

    delete_response = await client.delete(f"/api/v1/test-cases/{test_case.id}", headers=auth_headers)
    assert delete_response.status_code == 204

    list_response = await client.get(f"/api/v1/run-cases?test_run_id={run.id}", headers=auth_headers)
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()["items"]] == [run_case["id"]]
    assert list_response.json()["items"][0]["test_case_title"] == "Checkout succeeds"
    assert list_response.json()["items"][0]["test_case_key"] == "SNAP-TC-1"
    assert list_response.json()["items"][0]["suite_name"] == "Checkout"

    get_response = await client.get(f"/api/v1/run-cases/{run_case['id']}", headers=auth_headers)
    assert get_response.status_code == 200
    assert get_response.json()["test_case_id"] == test_case.id
    assert get_response.json()["test_case_title"] == "Checkout succeeds"
