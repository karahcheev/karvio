
from app.models.enums import ProjectMemberRole
from app.modules.projects.models import Project, ProjectMember, User
from sqlalchemy.ext.asyncio import AsyncSession


async def test_environments_crud_with_performance_topology(
    client,
    db_session: AsyncSession,
    auth_headers,
    auth_user: User,
):
    project = Project(id="proj_env_1", name="Environments")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    db_session.add_all([project, membership])
    project_id = project.id
    await db_session.commit()

    payload = {
        "project_id": project_id,
        "name": "Prod-like Cluster A",
        "description": "Shared env for functional and performance runs",
        "tags": ["prod-like", "k8s", "perf"],
        "use_cases": ["functional", "performance"],
        "topology": {
            "load_generators": [
                {
                    "name": "k6 generator pool",
                    "component_type": "generator",
                    "nodes": [
                        {
                            "name": "k6-node-1",
                            "host_type": "container",
                            "provider": "kubernetes",
                            "count": 3,
                            "resources": {"cpu": "2", "memory": "4Gi"},
                        }
                    ],
                }
            ],
            "system_under_test": [
                {
                    "name": "checkout-api",
                    "component_type": "api",
                    "nodes": [
                        {
                            "host_type": "vm",
                            "provider": "aws",
                            "region": "eu-central-1",
                            "count": 4,
                        }
                    ],
                    "endpoints": ["/checkout", "/cart"],
                },
                {
                    "name": "primary-db",
                    "component_type": "postgres",
                    "nodes": [
                        {
                            "host_type": "cloud_service",
                            "provider": "aws-rds",
                            "region": "eu-central-1",
                        }
                    ],
                },
            ],
        },
        "meta": {"owner_team": "platform"},
    }
    create_resp = await client.post("/api/v1/environments", json=payload, headers=auth_headers)
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["name"] == payload["name"]
    assert created["use_cases"] == ["functional", "performance"]
    assert created["current_revision_number"] == 1
    assert created["entities_count"] > 0
    assert created["topology"]["load_generators"][0]["nodes"][0]["host_type"] == "container"
    assert created["topology"]["system_under_test"][1]["nodes"][0]["host_type"] == "cloud_service"

    get_resp = await client.get(f"/api/v1/environments/{created['id']}", headers=auth_headers)
    assert get_resp.status_code == 200
    fetched = get_resp.json()
    assert fetched["id"] == created["id"]
    assert fetched["topology"]["system_under_test"][0]["endpoints"] == ["/checkout", "/cart"]

    patch_resp = await client.patch(
        f"/api/v1/environments/{created['id']}",
        json={
            "name": "Prod-like Cluster A2",
            "tags": ["prod-like", "k8s", "critical"],
            "topology": {
                **fetched["topology"],
                "supporting_services": [
                    {
                        "name": "redis-cache",
                        "component_type": "cache",
                        "nodes": [{"host_type": "container", "count": 2}],
                    }
                ],
            },
        },
        headers=auth_headers,
    )
    assert patch_resp.status_code == 200
    patched = patch_resp.json()
    assert patched["name"] == "Prod-like Cluster A2"
    assert patched["current_revision_number"] == 2
    assert "critical" in patched["tags"]
    assert patched["topology"]["supporting_services"][0]["name"] == "redis-cache"

    revisions_resp = await client.get(
        f"/api/v1/environments/{created['id']}/revisions",
        headers=auth_headers,
    )
    assert revisions_resp.status_code == 200
    revisions = revisions_resp.json()["items"]
    assert len(revisions) == 2
    assert revisions[0]["revision_number"] == 2
    assert revisions[0]["is_current"] is True
    assert revisions[1]["revision_number"] == 1
    assert revisions[1]["is_current"] is False

    revision_2_resp = await client.get(
        f"/api/v1/environments/{created['id']}/revisions/2",
        headers=auth_headers,
    )
    assert revision_2_resp.status_code == 200
    revision_2 = revision_2_resp.json()
    assert revision_2["snapshot_hash"]
    assert revision_2["full_snapshot"]["environment"]["name"] == "Prod-like Cluster A2"
    assert any(entity["role"] == "system_under_test" for entity in revision_2["entities"])

    list_resp = await client.get(f"/api/v1/environments?project_id={project_id}", headers=auth_headers)
    assert list_resp.status_code == 200
    listed = list_resp.json()["items"]
    assert len(listed) == 1
    assert listed[0]["id"] == created["id"]

    delete_resp = await client.delete(f"/api/v1/environments/{created['id']}", headers=auth_headers)
    assert delete_resp.status_code == 204

    list_default = await client.get(f"/api/v1/environments?project_id={project_id}", headers=auth_headers)
    assert list_default.status_code == 200
    assert list_default.json()["items"] == []

    list_archived = await client.get(
        f"/api/v1/environments?project_id={project_id}&include_archived=true",
        headers=auth_headers,
    )
    assert list_archived.status_code == 200
    archived_items = list_archived.json()["items"]
    assert len(archived_items) == 1
    assert archived_items[0]["archived_at"] is not None


async def test_environment_create_requires_tester_role(
    client,
    db_session: AsyncSession,
    auth_headers,
    auth_user: User,
):
    project = Project(id="proj_env_2", name="Viewer only")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.viewer)
    db_session.add_all([project, membership])
    project_id = project.id
    await db_session.commit()

    response = await client.post(
        "/api/v1/environments",
        json={"project_id": project_id, "name": "Should fail"},
        headers=auth_headers,
    )
    assert response.status_code == 403
    assert response.json()["code"] == "insufficient_project_role"


async def test_environment_rejects_client_schema_version(
    client,
    db_session: AsyncSession,
    auth_headers,
    auth_user: User,
):
    project = Project(id="proj_env_schema", name="Schema guard")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    project_id = project.id
    await db_session.commit()

    create_resp = await client.post(
        "/api/v1/environments",
        json={
            "project_id": project_id,
            "name": "Env schema",
            "schema_version": 99,
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 422

    create_ok = await client.post(
        "/api/v1/environments",
        json={"project_id": project_id, "name": "Env ok"},
        headers=auth_headers,
    )
    assert create_ok.status_code == 201
    environment_id = create_ok.json()["id"]

    patch_resp = await client.patch(
        f"/api/v1/environments/{environment_id}",
        json={"schema_version": 99},
        headers=auth_headers,
    )
    assert patch_resp.status_code == 422


async def test_environment_patch_always_creates_new_revision(
    client,
    db_session: AsyncSession,
    auth_headers,
    auth_user: User,
):
    project = Project(id="proj_env_3", name="Revision project")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    project_id = project.id
    await db_session.commit()

    create_resp = await client.post(
        "/api/v1/environments",
        json={
            "project_id": project_id,
            "name": "Env A",
            "topology": {"load_generators": [], "system_under_test": [], "supporting_services": []},
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    environment_id = create_resp.json()["id"]

    patch_resp = await client.patch(f"/api/v1/environments/{environment_id}", json={}, headers=auth_headers)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["current_revision_number"] == 2

    revisions_resp = await client.get(f"/api/v1/environments/{environment_id}/revisions", headers=auth_headers)
    assert revisions_resp.status_code == 200
    assert [item["revision_number"] for item in revisions_resp.json()["items"]] == [2, 1]
