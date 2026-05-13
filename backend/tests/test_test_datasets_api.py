
from app.models.enums import ProjectMemberRole, TestCaseStatus
from app.modules.projects.models import Project, ProjectMember, Suite, User
from app.modules.test_cases.models import TestCase, TestDataset
from sqlalchemy.ext.asyncio import AsyncSession


async def test_test_datasets_crud_and_binding_flow(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_ds_1", name="Datasets")
    suite = Suite(id="suite_ds_1", project_id=project.id, name="Suite")
    test_case = TestCase(
        id="tc_ds_1",
        project_id=project.id,
        suite_id=suite.id,
        key="DS-1",
        title="Dataset case",
        status=TestCaseStatus.active,
        tags=[],
    )
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    db_session.add_all([project, suite, test_case, membership])
    await db_session.commit()

    create_resp = await client.post(
        "/api/v1/datasets",
        json={
            "project_id": project.id,
            "name": "Dataset A",
            "description": "Initial payload",
            "columns": [
                {"column_key": "browser", "display_name": "Browser"},
                {"column_key": "locale", "display_name": "Locale"},
            ],
            "rows": [{"row_key": "row-1", "values": {"browser": "chrome", "locale": "en"}}],
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    dataset = create_resp.json()
    assert dataset["name"] == "Dataset A"
    assert dataset["test_case_ids"] == []

    bind_resp = await client.post(
        f"/api/v1/test-cases/{test_case.id}/dataset-bindings",
        json={"dataset_id": dataset["id"], "dataset_alias": "credentials", "sort_order": 10},
        headers=auth_headers,
    )
    assert bind_resp.status_code == 201
    assert bind_resp.json()["dataset_id"] == dataset["id"]

    list_resp = await client.get(f"/api/v1/datasets?project_id={project.id}", headers=auth_headers)
    assert list_resp.status_code == 200
    listed = list_resp.json()["items"]
    assert len(listed) == 1
    assert listed[0]["test_case_ids"] == [test_case.id]
    assert listed[0]["test_cases_count"] == 1
    assert listed[0]["current_revision_number"] == 1

    test_case_resp = await client.get(f"/api/v1/test-cases/{test_case.id}", headers=auth_headers)
    assert test_case_resp.status_code == 200
    assert len(test_case_resp.json()["dataset_bindings"]) == 1
    assert test_case_resp.json()["dataset_bindings"][0]["dataset_alias"] == "credentials"

    patch_resp = await client.patch(
        f"/api/v1/datasets/{dataset['id']}",
        json={
            "name": "Dataset A2",
            "source_type": "pytest_parametrize",
            "source_ref": "tests/test_ui.py::test_login[chrome]",
        },
        headers=auth_headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "Dataset A2"
    assert patch_resp.json()["source_type"] == "pytest_parametrize"
    assert patch_resp.json()["current_revision_number"] == 2

    binding_id = bind_resp.json()["id"]
    unbind_resp = await client.delete(
        f"/api/v1/test-cases/{test_case.id}/dataset-bindings/{binding_id}",
        headers=auth_headers,
    )
    assert unbind_resp.status_code == 204

    delete_resp = await client.delete(f"/api/v1/datasets/{dataset['id']}", headers=auth_headers)
    assert delete_resp.status_code == 204


async def test_dataset_binding_rejects_cross_project_dataset(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project_a = Project(id="proj_ds_a", name="A")
    project_b = Project(id="proj_ds_b", name="B")
    suite = Suite(id="suite_ds_a", project_id=project_a.id, name="Suite")
    test_case = TestCase(
        id="tc_ds_a",
        project_id=project_a.id,
        suite_id=suite.id,
        key="DS-A",
        title="Case A",
        status=TestCaseStatus.active,
        tags=[],
    )
    membership = ProjectMember(project_id=project_a.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    membership_b = ProjectMember(project_id=project_b.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project_a, project_b, suite, test_case, membership, membership_b])
    await db_session.commit()

    dataset_resp = await client.post(
        "/api/v1/datasets",
        json={
            "project_id": project_b.id,
            "name": "Foreign Dataset",
            "columns": [{"column_key": "x", "display_name": "x"}],
            "rows": [{"row_key": "r1", "values": {"x": "1"}}],
        },
        headers=auth_headers,
    )
    assert dataset_resp.status_code == 201

    bind_resp = await client.post(
        f"/api/v1/test-cases/{test_case.id}/dataset-bindings",
        json={"dataset_id": dataset_resp.json()["id"], "dataset_alias": "foreign"},
        headers=auth_headers,
    )
    assert bind_resp.status_code == 422
    assert bind_resp.json()["code"] == "dataset_project_mismatch"


async def test_datasets_bulk_delete_removes_all(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_ds_bulk_1", name="Bulk Datasets")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    db_session.add_all([project, membership])
    await db_session.commit()

    d1 = (
        await client.post(
            "/api/v1/datasets",
            json={
                "project_id": project.id,
                "name": "Bulk D1",
                "columns": [{"column_key": "x", "display_name": "x"}],
                "rows": [{"row_key": "r1", "values": {"x": "1"}}],
            },
            headers=auth_headers,
        )
    ).json()
    d2 = (
        await client.post(
            "/api/v1/datasets",
            json={
                "project_id": project.id,
                "name": "Bulk D2",
                "columns": [{"column_key": "x", "display_name": "x"}],
                "rows": [{"row_key": "r1", "values": {"x": "2"}}],
            },
            headers=auth_headers,
        )
    ).json()

    bulk_resp = await client.post(
        "/api/v1/datasets/bulk",
        json={"project_id": project.id, "dataset_ids": [d1["id"], d2["id"]], "action": "delete"},
        headers=auth_headers,
    )
    assert bulk_resp.status_code == 200
    assert bulk_resp.json()["affected_count"] == 2

    assert await db_session.get(TestDataset, d1["id"]) is None
    assert await db_session.get(TestDataset, d2["id"]) is None

    list_resp = await client.get(f"/api/v1/datasets?project_id={project.id}", headers=auth_headers)
    assert list_resp.status_code == 200
    assert list_resp.json()["items"] == []


async def test_datasets_bulk_delete_requires_lead(client, db_session: AsyncSession, auth_user: User, auth_headers):
    project = Project(id="proj_ds_bulk_forbidden", name="Proj")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()
    created = await client.post(
        "/api/v1/datasets",
        json={
            "project_id": project.id,
            "name": "Protected",
            "columns": [{"column_key": "x", "display_name": "x"}],
            "rows": [{"row_key": "r1", "values": {"x": "1"}}],
        },
        headers=auth_headers,
    )
    assert created.status_code == 201
    dataset_id = created.json()["id"]

    bulk_resp = await client.post(
        "/api/v1/datasets/bulk",
        json={"project_id": project.id, "dataset_ids": [dataset_id], "action": "delete"},
        headers=auth_headers,
    )
    assert bulk_resp.status_code == 403
    assert bulk_resp.json()["code"] == "insufficient_project_role"
    assert await db_session.get(TestDataset, dataset_id) is not None


async def test_create_dataset_returns_409_for_duplicate_name(
    client,
    db_session: AsyncSession,
    auth_user: User,
    auth_headers,
):
    project = Project(id="proj_ds_dup_create", name="Duplicate create")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    payload = {
        "project_id": project.id,
        "name": "dataset_10000",
        "columns": [{"column_key": "x", "display_name": "x"}],
        "rows": [{"row_key": "r1", "values": {"x": "1"}}],
    }

    first = await client.post("/api/v1/datasets", json=payload, headers=auth_headers)
    assert first.status_code == 201

    duplicate = await client.post("/api/v1/datasets", json=payload, headers=auth_headers)
    assert duplicate.status_code == 409
    body = duplicate.json()
    assert body["code"] == "dataset_already_exists"
    assert "name" in body["errors"]


async def test_patch_dataset_returns_409_for_duplicate_name(
    client,
    db_session: AsyncSession,
    auth_user: User,
    auth_headers,
):
    project = Project(id="proj_ds_dup_patch", name="Duplicate patch")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    first = await client.post(
        "/api/v1/datasets",
        json={
            "project_id": project.id,
            "name": "dataset_a",
            "columns": [{"column_key": "x", "display_name": "x"}],
            "rows": [{"row_key": "r1", "values": {"x": "1"}}],
        },
        headers=auth_headers,
    )
    assert first.status_code == 201
    first_id = first.json()["id"]

    second = await client.post(
        "/api/v1/datasets",
        json={
            "project_id": project.id,
            "name": "dataset_b",
            "columns": [{"column_key": "x", "display_name": "x"}],
            "rows": [{"row_key": "r1", "values": {"x": "2"}}],
        },
        headers=auth_headers,
    )
    assert second.status_code == 201

    duplicate_patch = await client.patch(
        f"/api/v1/datasets/{first_id}",
        json={"name": "dataset_b"},
        headers=auth_headers,
    )
    assert duplicate_patch.status_code == 409
    body = duplicate_patch.json()
    assert body["code"] == "dataset_already_exists"
    assert "name" in body["errors"]
