from app.models.enums import ProjectMemberRole
from app.modules.projects.models import Project, ProjectMember, User
from sqlalchemy.ext.asyncio import AsyncSession


async def test_environment_read_includes_registry_summaries(
    client,
    db_session: AsyncSession,
    auth_headers,
    auth_user: User,
):
    project = Project(id="proj_env_registry_summary", name="Environment Registry")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    db_session.add_all([project, membership])
    await db_session.commit()

    create_resp = await client.post(
        "/api/v1/environments",
        json={
            "project_id": project.id,
            "name": "Registry Env A",
            "status": "active",
            "use_cases": ["functional", "performance"],
            "topology": {
                "load_generators": [
                    {
                        "name": "k6",
                        "component_type": "generator",
                        "nodes": [
                            {
                                "name": "k6-node",
                                "host_type": "container",
                                "provider": "kubernetes",
                                "region": "eu-central-1",
                                "count": 3,
                            }
                        ],
                    }
                ],
                "system_under_test": [
                    {
                        "name": "api",
                        "component_type": "service",
                        "nodes": [
                            {
                                "name": "api-vm",
                                "host_type": "vm",
                                "provider": "aws",
                                "region": "eu-central-1",
                                "count": 2,
                            }
                        ],
                        "endpoints": ["/health", "/checkout"],
                    }
                ],
                "supporting_services": [],
            },
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["current_revision_number"] == 1
    assert created["topology_component_count"] == 2
    assert created["topology_node_count"] == 5
    assert created["topology_endpoint_count"] == 2
    assert created["infra_host_types"] == ["container", "vm"]
    assert created["infra_providers"] == ["aws", "kubernetes"]
    assert created["infra_regions"] == ["eu-central-1"]
    assert created["entities_count"] >= 2
    assert created["edges_count"] >= 0

    get_resp = await client.get(f"/api/v1/environments/{created['id']}", headers=auth_headers)
    assert get_resp.status_code == 200
    fetched = get_resp.json()
    assert fetched["topology_component_count"] == 2
    assert fetched["topology_node_count"] == 5
    assert fetched["infra_providers"] == ["aws", "kubernetes"]


async def test_run_creation_pins_environment_revision_and_snapshot(
    client,
    db_session: AsyncSession,
    auth_headers,
    auth_user: User,
):
    project = Project(id="proj_run_env_pin", name="Run Environment Pinning")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.lead)
    db_session.add_all([project, membership])
    await db_session.commit()

    create_env = await client.post(
        "/api/v1/environments",
        json={
            "project_id": project.id,
            "name": "Pinned Env v1",
            "status": "active",
            "topology": {"load_generators": [], "system_under_test": [], "supporting_services": []},
        },
        headers=auth_headers,
    )
    assert create_env.status_code == 201
    environment = create_env.json()

    create_run = await client.post(
        "/api/v1/test-runs",
        json={
            "project_id": project.id,
            "name": "Pinned Run",
            "environment_id": environment["id"],
        },
        headers=auth_headers,
    )
    assert create_run.status_code == 201
    run = create_run.json()
    assert run["environment_id"] == environment["id"]
    assert run["environment_revision_number"] == 1
    assert run["environment_name"] == "Pinned Env v1"
    assert run["environment_snapshot"]["environment"]["name"] == "Pinned Env v1"

    patch_env = await client.patch(
        f"/api/v1/environments/{environment['id']}",
        json={"name": "Pinned Env v2"},
        headers=auth_headers,
    )
    assert patch_env.status_code == 200
    assert patch_env.json()["current_revision_number"] == 2

    get_run = await client.get(f"/api/v1/test-runs/{run['id']}", headers=auth_headers)
    assert get_run.status_code == 200
    fetched_run = get_run.json()
    assert fetched_run["environment_revision_number"] == 1
    assert fetched_run["environment_name"] == "Pinned Env v1"
    assert fetched_run["environment_snapshot"]["environment"]["name"] == "Pinned Env v1"

    list_runs = await client.get(f"/api/v1/test-runs?project_id={project.id}", headers=auth_headers)
    assert list_runs.status_code == 200
    listed = list_runs.json()["items"]
    assert len(listed) == 1
    assert listed[0]["environment_revision_number"] == 1
    assert listed[0]["environment_name"] == "Pinned Env v1"


async def test_run_creation_without_environment_is_allowed(
    client,
    db_session: AsyncSession,
    auth_headers,
    auth_user: User,
):
    project = Project(id="proj_run_no_env", name="Run Without Environment")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    create_run = await client.post(
        "/api/v1/test-runs",
        json={
            "project_id": project.id,
            "name": "Run Without Env",
        },
        headers=auth_headers,
    )
    assert create_run.status_code == 201
    run = create_run.json()
    assert run["environment_id"] is None
    assert run["environment_revision_id"] is None
    assert run["environment_revision_number"] is None
    assert run["environment_name"] is None
    assert run["environment_snapshot"] == {}
