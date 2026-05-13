"""Tests for test plans API."""

from app.models.enums import ProjectMemberRole, TestCaseStatus
from app.modules.environments.models import Environment, EnvironmentRevision
from app.modules.projects.models import Project, ProjectMember, Suite, User
from app.modules.test_cases.models import TestCase
from app.modules.test_cases.models import TestCaseDatasetBinding, TestDataset
from app.modules.test_plans.models import TestPlan, TestPlanCase, TestPlanSuite
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession


def seed_environment(project_id: str, environment_id: str, name: str) -> tuple[Environment, EnvironmentRevision]:
    environment = Environment(
        id=environment_id,
        project_id=project_id,
        name=name,
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
        id=f"{environment_id}_rev_1",
        environment_id=environment_id,
        revision_number=1,
        schema_version=1,
        is_current=True,
        full_snapshot={
            "project_id": project_id,
            "environment": {"name": name, "status": "active", "kind": "custom"},
            "topology": {},
        },
        snapshot_hash=f"hash_{environment_id}_1",
        extra={},
    )
    return environment, revision


@pytest_asyncio.fixture
async def seeded_test_plan(db_session: AsyncSession, auth_user: User) -> TestPlan:
    project = Project(id="proj_tp_1", name="Test Plans Project")
    suite1 = Suite(id="suite_tp_1", project_id=project.id, name="Suite 1")
    suite2 = Suite(id="suite_tp_2", project_id=project.id, name="Suite 2", parent_id=suite1.id)
    tc1 = TestCase(
        id="tc_tp_1",
        project_id=project.id,
        suite_id=suite1.id,
        key="TP-TC-1",
        title="Active Case",
        status=TestCaseStatus.active,
        tags=[],
    )
    tc2 = TestCase(
        id="tc_tp_2",
        project_id=project.id,
        suite_id=suite2.id,
        key="TP-TC-2",
        title="Nested Case",
        status=TestCaseStatus.active,
        tags=[],
    )
    plan = TestPlan(
        id="plan_tp_1",
        project_id=project.id,
        name="Regression Plan",
        description="Full regression",
        created_by=auth_user.id,
    )
    tps1 = TestPlanSuite(test_plan_id=plan.id, suite_id=suite1.id)
    environment, revision = seed_environment(project.id, "env_tp_1", "Test Plan Env")
    membership = ProjectMember(
        project_id=project.id,
        user_id=auth_user.id,
        role=ProjectMemberRole.lead,
    )
    db_session.add_all([project, suite1, suite2, tc1, tc2, plan, tps1, membership, environment, revision])
    await db_session.commit()
    return plan


async def test_list_test_plans_bulk_read_enrichment(client, db_session: AsyncSession, auth_headers):
    """Regression: list endpoint enriches suite_names/case_keys via bulk lookups (not per-row get_by_id)."""
    project = Project(id="proj_tp_bulk", name="Bulk Read")
    suite_a = Suite(id="suite_tp_bulk_a", project_id=project.id, name="Suite Alpha")
    suite_b = Suite(id="suite_tp_bulk_b", project_id=project.id, name="Suite Beta")
    tc_x = TestCase(
        id="tc_tp_bulk_x",
        project_id=project.id,
        suite_id=suite_a.id,
        key="BULK-X",
        title="Case X",
        status=TestCaseStatus.active,
        tags=[],
    )
    tc_y = TestCase(
        id="tc_tp_bulk_y",
        project_id=project.id,
        suite_id=suite_b.id,
        key="BULK-Y",
        title="Case Y",
        status=TestCaseStatus.active,
        tags=[],
    )
    plan = TestPlan(
        id="plan_tp_bulk",
        project_id=project.id,
        name="Bulk Plan",
        created_by="user_auth_1",
    )
    tps_a = TestPlanSuite(test_plan_id=plan.id, suite_id=suite_a.id)
    tps_b = TestPlanSuite(test_plan_id=plan.id, suite_id=suite_b.id)
    tpc_x = TestPlanCase(test_plan_id=plan.id, test_case_id=tc_x.id)
    tpc_y = TestPlanCase(test_plan_id=plan.id, test_case_id=tc_y.id)
    membership = ProjectMember(
        project_id=project.id,
        user_id="user_auth_1",
        role=ProjectMemberRole.viewer,
    )
    db_session.add_all(
        [project, suite_a, suite_b, tc_x, tc_y, plan, tps_a, tps_b, tpc_x, tpc_y, membership]
    )
    await db_session.commit()

    list_resp = await client.get(f"/api/v1/test-plans?project_id={project.id}", headers=auth_headers)
    assert list_resp.status_code == 200
    plan_item = next(p for p in list_resp.json()["items"] if p["id"] == plan.id)
    assert dict(zip(plan_item["suite_ids"], plan_item["suite_names"])) == {
        suite_a.id: "Suite Alpha",
        suite_b.id: "Suite Beta",
    }
    assert dict(zip(plan_item["case_ids"], plan_item["case_keys"])) == {
        tc_x.id: "BULK-X",
        tc_y.id: "BULK-Y",
    }

    get_resp = await client.get(f"/api/v1/test-plans/{plan.id}", headers=auth_headers)
    assert get_resp.status_code == 200
    body = get_resp.json()
    assert dict(zip(body["suite_ids"], body["suite_names"])) == {
        suite_a.id: "Suite Alpha",
        suite_b.id: "Suite Beta",
    }
    assert dict(zip(body["case_ids"], body["case_keys"])) == {
        tc_x.id: "BULK-X",
        tc_y.id: "BULK-Y",
    }


async def test_test_plans_crud(client, db_session: AsyncSession, auth_headers, seeded_test_plan: TestPlan):
    project_id = seeded_test_plan.project_id

    list_resp = await client.get(f"/api/v1/test-plans?project_id={project_id}", headers=auth_headers)
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert len(data["items"]) >= 1
    plan_item = next(p for p in data["items"] if p["id"] == seeded_test_plan.id)
    assert plan_item["name"] == "Regression Plan"
    assert plan_item["suite_ids"] == ["suite_tp_1"]
    assert "suite_names" in plan_item

    get_resp = await client.get(f"/api/v1/test-plans/{seeded_test_plan.id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Regression Plan"

    patch_resp = await client.patch(
        f"/api/v1/test-plans/{seeded_test_plan.id}",
        json={
            "name": "Updated Plan",
            "tags": ["regression", "smoke"],
            "suite_ids": ["suite_tp_1", "suite_tp_2"],
        },
        headers=auth_headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "Updated Plan"
    assert patch_resp.json()["tags"] == ["regression", "smoke"]
    assert len(patch_resp.json()["suite_ids"]) == 2

    delete_resp = await client.delete(f"/api/v1/test-plans/{seeded_test_plan.id}", headers=auth_headers)
    assert delete_resp.status_code == 204

    get_after = await client.get(f"/api/v1/test-plans/{seeded_test_plan.id}", headers=auth_headers)
    assert get_after.status_code == 404


async def test_create_test_plan_empty_suites_is_allowed(client, db_session: AsyncSession, auth_headers):
    project = Project(id="proj_tp_empty", name="Empty")
    membership = ProjectMember(
        project_id=project.id,
        user_id="user_auth_1",
        role=ProjectMemberRole.tester,
    )
    db_session.add_all([project, membership])
    await db_session.commit()

    resp = await client.post(
        "/api/v1/test-plans",
        json={
            "project_id": project.id,
            "name": "Empty Plan",
            "suite_ids": [],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Empty Plan"
    assert data["suite_ids"] == []
    assert data["case_ids"] == []


async def test_create_test_plan_with_cases_only(client, db_session: AsyncSession, auth_headers):
    project = Project(id="proj_tp_cases", name="Cases Only")
    suite = Suite(id="suite_tp_c", project_id=project.id, name="Suite")
    tc = TestCase(
        id="tc_tp_c",
        project_id=project.id,
        suite_id=suite.id,
        key="C-TC-1",
        title="Case",
        status=TestCaseStatus.active,
        tags=[],
    )
    membership = ProjectMember(project_id=project.id, user_id="user_auth_1", role=ProjectMemberRole.tester)
    db_session.add_all([project, suite, tc, membership])
    await db_session.commit()

    resp = await client.post(
        "/api/v1/test-plans",
        json={
            "project_id": project.id,
            "name": "Cases Plan",
            "suite_ids": [],
            "case_ids": [tc.id],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Cases Plan"
    assert data["suite_ids"] == []
    assert data["case_ids"] == [tc.id]
    assert data["case_keys"] == ["C-TC-1"]
    environment, revision = seed_environment(project.id, "env_tp_cases", "Cases Env")
    db_session.add_all([environment, revision])
    await db_session.commit()

    run_resp = await client.post(
        f"/api/v1/test-plans/{data['id']}/create-run",
        json={"name": "Run from Cases", "environment_id": "env_tp_cases", "start_immediately": False},
        headers=auth_headers,
    )
    assert run_resp.status_code == 201
    run_cases = (
        await client.get(
            f"/api/v1/run-cases?test_run_id={run_resp.json()['id']}",
            headers=auth_headers,
        )
    ).json()["items"]
    assert len(run_cases) == 1
    assert run_cases[0]["test_case_id"] == tc.id


async def test_patch_test_plan_can_clear_suites_and_cases(
    client,
    seeded_test_plan: TestPlan,
    auth_headers,
):
    resp = await client.patch(
        f"/api/v1/test-plans/{seeded_test_plan.id}",
        json={
            "suite_ids": [],
            "case_ids": [],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["suite_ids"] == []
    assert data["case_ids"] == []


async def test_create_test_plan_suite_project_mismatch(client, db_session: AsyncSession, auth_headers):
    project1 = Project(id="proj_tp_p1", name="Project 1")
    project2 = Project(id="proj_tp_p2", name="Project 2")
    suite_in_p2 = Suite(id="suite_other", project_id=project2.id, name="Other Suite")
    membership = ProjectMember(
        project_id=project1.id,
        user_id="user_auth_1",
        role=ProjectMemberRole.tester,
    )
    db_session.add_all([project1, project2, suite_in_p2, membership])
    await db_session.commit()

    resp = await client.post(
        "/api/v1/test-plans",
        json={
            "project_id": project1.id,
            "name": "Wrong Suite",
            "suite_ids": [suite_in_p2.id],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422
    assert resp.json().get("code") == "suite_project_mismatch"


async def test_create_run_from_test_plan(client, db_session: AsyncSession, auth_headers, seeded_test_plan: TestPlan):
    resp = await client.post(
        f"/api/v1/test-plans/{seeded_test_plan.id}/create-run",
        json={
            "name": "Run from Plan",
            "description": "Desc",
            "environment_id": "env_tp_1",
            "build": "1.0",
            "assignee": None,
            "start_immediately": False,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    run_data = resp.json()
    assert run_data["name"] == "Run from Plan"
    assert run_data["project_id"] == seeded_test_plan.project_id
    assert run_data["status"] == "not_started"

    run_cases_resp = await client.get(
        f"/api/v1/run-cases?test_run_id={run_data['id']}",
        headers=auth_headers,
    )
    assert run_cases_resp.status_code == 200
    items = run_cases_resp.json()["items"]
    assert len(items) == 2
    case_ids = {item["test_case_id"] for item in items}
    assert case_ids == {"tc_tp_1", "tc_tp_2"}


async def test_create_run_from_test_plan_without_environment(
    client,
    db_session: AsyncSession,
    auth_headers,
    seeded_test_plan: TestPlan,
):
    resp = await client.post(
        f"/api/v1/test-plans/{seeded_test_plan.id}/create-run",
        json={
            "name": "Run from Plan without Env",
            "description": "Desc",
            "build": "1.0",
            "assignee": None,
            "start_immediately": False,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    run_data = resp.json()
    assert run_data["name"] == "Run from Plan without Env"
    assert run_data["environment_id"] is None
    assert run_data["environment_revision_id"] is None
    assert run_data["environment_revision_number"] is None
    assert run_data["environment_name"] is None
    assert run_data["environment_snapshot"] == {}


async def test_create_run_from_plan_with_nested_suites(client, db_session: AsyncSession, auth_headers, seeded_test_plan: TestPlan):
    resp = await client.post(
        f"/api/v1/test-plans/{seeded_test_plan.id}/create-run",
        json={"name": "Nested Run", "environment_id": "env_tp_1", "start_immediately": False},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    run_id = resp.json()["id"]
    run_cases = (await client.get(f"/api/v1/run-cases?test_run_id={run_id}", headers=auth_headers)).json()["items"]
    assert len(run_cases) == 2


async def test_create_run_from_plan_deduplication(client, db_session: AsyncSession, auth_headers):
    project = Project(id="proj_dedup", name="Dedup")
    suite = Suite(id="suite_dedup", project_id=project.id, name="Suite")
    tc = TestCase(
        id="tc_dedup",
        project_id=project.id,
        suite_id=suite.id,
        key="DEDUP-1",
        title="Case",
        status=TestCaseStatus.active,
        tags=[],
    )
    plan = TestPlan(id="plan_dedup", project_id=project.id, name="Plan")
    tps = TestPlanSuite(test_plan_id=plan.id, suite_id=suite.id)
    environment, revision = seed_environment(project.id, "env_dedup", "Dedup Env")
    membership = ProjectMember(project_id=project.id, user_id="user_auth_1", role=ProjectMemberRole.tester)
    db_session.add_all([project, suite, tc, plan, tps, membership, environment, revision])
    await db_session.commit()

    resp = await client.post(
        f"/api/v1/test-plans/{plan.id}/create-run",
        json={"name": "Dedup Run", "environment_id": "env_dedup", "start_immediately": False},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    run_cases = (
        await client.get(
            f"/api/v1/run-cases?test_run_id={resp.json()['id']}",
            headers=auth_headers,
        )
    ).json()["items"]
    assert len(run_cases) == 1


async def test_create_run_from_plan_no_active_cases_422(client, db_session: AsyncSession, auth_headers):
    project = Project(id="proj_no_tc", name="No TC")
    suite = Suite(id="suite_no_tc", project_id=project.id, name="Empty Suite")
    plan = TestPlan(id="plan_no_tc", project_id=project.id, name="Empty Plan")
    tps = TestPlanSuite(test_plan_id=plan.id, suite_id=suite.id)
    environment, revision = seed_environment(project.id, "env_no_tc", "No Case Env")
    membership = ProjectMember(project_id=project.id, user_id="user_auth_1", role=ProjectMemberRole.tester)
    db_session.add_all([project, suite, plan, tps, membership, environment, revision])
    await db_session.commit()

    resp = await client.post(
        f"/api/v1/test-plans/{plan.id}/create-run",
        json={"name": "No Cases Run", "environment_id": "env_no_tc", "start_immediately": False},
        headers=auth_headers,
    )
    assert resp.status_code == 422
    assert resp.json().get("code") == "no_active_cases"


async def test_create_run_from_plan_start_immediately(client, db_session: AsyncSession, auth_headers, seeded_test_plan: TestPlan):
    resp = await client.post(
        f"/api/v1/test-plans/{seeded_test_plan.id}/create-run",
        json={"name": "Start Now", "environment_id": "env_tp_1", "start_immediately": True},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "in_progress"


async def test_create_run_from_plan_expands_datasets(client, db_session: AsyncSession, auth_headers):
    project = Project(id="proj_tp_ds", name="Datasets in Plan")
    suite = Suite(id="suite_tp_ds", project_id=project.id, name="Suite")
    test_case = TestCase(
        id="tc_tp_ds",
        project_id=project.id,
        suite_id=suite.id,
        key="TP-DS-1",
        title="Parameterized case",
        status=TestCaseStatus.active,
        tags=[],
    )
    dataset_a = TestDataset(id="ds_tp_1", project_id=project.id, name="Dataset A")
    dataset_b = TestDataset(id="ds_tp_2", project_id=project.id, name="Dataset B")
    link_a = TestCaseDatasetBinding(test_case_id=test_case.id, dataset_id=dataset_a.id, dataset_alias="a")
    link_b = TestCaseDatasetBinding(test_case_id=test_case.id, dataset_id=dataset_b.id, dataset_alias="b")
    plan = TestPlan(id="plan_tp_ds", project_id=project.id, name="Plan with datasets")
    tps = TestPlanSuite(test_plan_id=plan.id, suite_id=suite.id)
    environment, revision = seed_environment(project.id, "env_tp_ds", "Dataset Env")
    membership = ProjectMember(project_id=project.id, user_id="user_auth_1", role=ProjectMemberRole.tester)
    db_session.add_all([project, suite, test_case, dataset_a, dataset_b, link_a, link_b, plan, tps, membership, environment, revision])
    from app.modules.test_cases.repositories import datasets as test_dataset_repo

    await db_session.flush()
    await test_dataset_repo.create_revision(
        db_session,
        dataset=dataset_a,
        columns=[{"column_key": "browser", "display_name": "Browser"}],
        rows=[
            {"row_key": "chrome", "scenario_label": "chrome", "values": {"browser": "chrome"}},
            {"row_key": "firefox", "scenario_label": "firefox", "values": {"browser": "firefox"}},
        ],
        created_by="user_auth_1",
    )
    await test_dataset_repo.create_revision(
        db_session,
        dataset=dataset_b,
        columns=[{"column_key": "locale", "display_name": "Locale"}],
        rows=[{"row_key": "en", "scenario_label": "en", "values": {"locale": "en"}}],
        created_by="user_auth_1",
    )
    await db_session.commit()

    resp = await client.post(
        f"/api/v1/test-plans/{plan.id}/create-run",
        json={"name": "Dataset Run", "environment_id": "env_tp_ds", "start_immediately": False},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    run_cases = (await client.get(f"/api/v1/run-cases?test_run_id={resp.json()['id']}", headers=auth_headers)).json()["items"]
    assert len(run_cases) == 1
    rows = (
        await client.get(f"/api/v1/run-cases/{run_cases[0]['id']}/rows", headers=auth_headers)
    ).json()["items"]
    assert len(rows) == 2
