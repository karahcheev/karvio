from __future__ import annotations

import pytest

from app.models.enums import ProjectMemberRole
from app.modules.projects.models import Project, ProjectMember, User


async def _seed_project(db_session, auth_user: User, project_id: str = "proj_perf_cmp_1") -> str:
    project = Project(id=project_id, name="Perf Comparisons Project")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()
    return project_id


async def _create_run(client, project_id: str, auth_headers: dict, *, name: str, build: str) -> dict:
    response = await client.post(
        "/api/v1/perf/runs",
        json={
            "project_id": project_id,
            "name": name,
            "load_kind": "http",
            "service": "payments-api",
            "env": "staging-eu",
            "scenario": "Checkout 3DS",
            "load_profile": "ramp-200-600-vus",
            "branch": "feature/retry-token",
            "commit": "5e8a1d2",
            "build": build,
            "tool": "k6",
            "version": "v2026.03.22",
            "region": "eu-central-1",
            "cluster": "staging-eu-k8s",
            "namespace": "payments",
            "instance_type": "c6i.4xlarge",
            "cpu_cores": 16,
            "memory_gb": 32,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_create_get_patch_delete_saved_comparison(client, db_session, auth_headers, auth_user: User):
    project_id = await _seed_project(db_session, auth_user, project_id="proj_cmp_crud")
    base_run = await _create_run(client, project_id, auth_headers, name="Base run", build="b1")
    other_run = await _create_run(client, project_id, auth_headers, name="Other run", build="b2")

    create_response = await client.post(
        "/api/v1/perf/comparisons",
        json={
            "project_id": project_id,
            "name": "First comparison",
            "base_run_id": base_run["id"],
            "compare_run_ids": [other_run["id"]],
            "metric_key": "throughput",
            "public": False,
        },
        headers=auth_headers,
    )
    assert create_response.status_code == 201, create_response.text
    comparison = create_response.json()
    assert comparison["name"] == "First comparison"
    assert comparison["base_run_id"] == base_run["id"]
    assert comparison["compare_run_ids"] == [other_run["id"]]
    assert comparison["public_token"] is None
    assert comparison["snapshot"]["metric_key"] == "throughput"
    assert len(comparison["snapshot"]["runs"]) == 2
    assert comparison["snapshot"]["runs"][0]["id"] == base_run["id"]
    assert comparison["snapshot"]["runs"][1]["id"] == other_run["id"]

    get_response = await client.get(
        f"/api/v1/perf/comparisons/{comparison['id']}",
        headers=auth_headers,
    )
    assert get_response.status_code == 200
    assert get_response.json()["id"] == comparison["id"]

    patch_public = await client.patch(
        f"/api/v1/perf/comparisons/{comparison['id']}",
        json={"public": True, "name": "Renamed"},
        headers=auth_headers,
    )
    assert patch_public.status_code == 200
    patched = patch_public.json()
    assert patched["public_token"] is not None
    assert patched["name"] == "Renamed"

    patch_private = await client.patch(
        f"/api/v1/perf/comparisons/{comparison['id']}",
        json={"public": False},
        headers=auth_headers,
    )
    assert patch_private.status_code == 200
    assert patch_private.json()["public_token"] is None

    delete_response = await client.delete(
        f"/api/v1/perf/comparisons/{comparison['id']}",
        headers=auth_headers,
    )
    assert delete_response.status_code == 204

    get_after_delete = await client.get(
        f"/api/v1/perf/comparisons/{comparison['id']}",
        headers=auth_headers,
    )
    assert get_after_delete.status_code == 404


async def test_public_comparison_is_accessible_without_auth(client, db_session, auth_headers, auth_user: User):
    project_id = await _seed_project(db_session, auth_user, project_id="proj_cmp_public")
    base_run = await _create_run(client, project_id, auth_headers, name="Base", build="bp1")
    other_run = await _create_run(client, project_id, auth_headers, name="Other", build="bp2")

    create_response = await client.post(
        "/api/v1/perf/comparisons",
        json={
            "project_id": project_id,
            "base_run_id": base_run["id"],
            "compare_run_ids": [other_run["id"]],
            "metric_key": "p95",
            "public": True,
        },
        headers=auth_headers,
    )
    assert create_response.status_code == 201
    comparison = create_response.json()
    token = comparison["public_token"]
    assert token

    public_response = await client.get(f"/api/v1/public/perf/comparisons/{token}")
    assert public_response.status_code == 200
    payload = public_response.json()
    assert payload["id"] == comparison["id"]
    assert payload["metric_key"] == "p95"
    assert "project_id" not in payload  # leak guard
    assert "created_by" not in payload
    assert len(payload["snapshot"]["runs"]) == 2

    # Disable public access — token must stop working.
    disable_response = await client.patch(
        f"/api/v1/perf/comparisons/{comparison['id']}",
        json={"public": False},
        headers=auth_headers,
    )
    assert disable_response.status_code == 200

    revoked_response = await client.get(f"/api/v1/public/perf/comparisons/{token}")
    assert revoked_response.status_code == 404


async def test_create_comparison_rejects_duplicate_runs(client, db_session, auth_headers, auth_user: User):
    project_id = await _seed_project(db_session, auth_user, project_id="proj_cmp_dup")
    base_run = await _create_run(client, project_id, auth_headers, name="Base", build="bd1")

    response = await client.post(
        "/api/v1/perf/comparisons",
        json={
            "project_id": project_id,
            "base_run_id": base_run["id"],
            "compare_run_ids": [base_run["id"]],
            "metric_key": "throughput",
        },
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_comparison_runs"


async def test_create_comparison_requires_member_access(client, db_session, auth_headers, auth_user: User):
    project_id = await _seed_project(db_session, auth_user, project_id="proj_cmp_member")
    base_run = await _create_run(client, project_id, auth_headers, name="Base", build="bm1")
    other_run = await _create_run(client, project_id, auth_headers, name="Other", build="bm2")

    # Create a separate project the actor is NOT a member of.
    foreign_project = Project(id="proj_cmp_foreign", name="Foreign Project")
    db_session.add(foreign_project)
    await db_session.commit()

    response = await client.post(
        "/api/v1/perf/comparisons",
        json={
            "project_id": "proj_cmp_foreign",
            "base_run_id": base_run["id"],
            "compare_run_ids": [other_run["id"]],
            "metric_key": "throughput",
        },
        headers=auth_headers,
    )
    assert response.status_code in {403, 404}


async def test_public_comparison_unknown_token_is_404(client):
    response = await client.get("/api/v1/public/perf/comparisons/nonexistent-token")
    assert response.status_code == 404


async def test_list_saved_comparisons_returns_project_scoped_items(
    client, db_session, auth_headers, auth_user: User,
):
    project_id = await _seed_project(db_session, auth_user, project_id="proj_cmp_list")
    base = await _create_run(client, project_id, auth_headers, name="Base", build="bl1")
    other = await _create_run(client, project_id, auth_headers, name="Other", build="bl2")

    # Create three comparisons
    for label in ("First", "Second baseline", "Release vs canary"):
        response = await client.post(
            "/api/v1/perf/comparisons",
            json={
                "project_id": project_id,
                "name": label,
                "base_run_id": base["id"],
                "compare_run_ids": [other["id"]],
                "metric_key": "throughput",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201

    list_response = await client.get(
        f"/api/v1/perf/comparisons?project_id={project_id}",
        headers=auth_headers,
    )
    assert list_response.status_code == 200
    body = list_response.json()
    assert len(body["items"]) == 3
    # Newest first by created_at desc.
    names = [item["name"] for item in body["items"]]
    assert "Release vs canary" in names
    # List items are lightweight — no snapshot field.
    first_item = body["items"][0]
    assert "snapshot" not in first_item
    assert first_item["run_count"] == 2
    assert first_item["base_run_id"] == base["id"]

    search_response = await client.get(
        f"/api/v1/perf/comparisons?project_id={project_id}&search=canary",
        headers=auth_headers,
    )
    assert search_response.status_code == 200
    search_body = search_response.json()
    assert len(search_body["items"]) == 1
    assert search_body["items"][0]["name"] == "Release vs canary"


async def test_list_comparisons_filters_by_visibility(
    client, db_session, auth_headers, auth_user: User,
):
    project_id = await _seed_project(db_session, auth_user, project_id="proj_cmp_visibility")
    base = await _create_run(client, project_id, auth_headers, name="Base", build="bv1")
    other = await _create_run(client, project_id, auth_headers, name="Other", build="bv2")

    # one public, one private
    private = await client.post(
        "/api/v1/perf/comparisons",
        json={
            "project_id": project_id,
            "name": "Private comparison",
            "base_run_id": base["id"],
            "compare_run_ids": [other["id"]],
            "metric_key": "throughput",
        },
        headers=auth_headers,
    )
    assert private.status_code == 201
    public = await client.post(
        "/api/v1/perf/comparisons",
        json={
            "project_id": project_id,
            "name": "Public comparison",
            "base_run_id": base["id"],
            "compare_run_ids": [other["id"]],
            "metric_key": "throughput",
            "public": True,
        },
        headers=auth_headers,
    )
    assert public.status_code == 201

    public_only = await client.get(
        f"/api/v1/perf/comparisons?project_id={project_id}&visibility=public",
        headers=auth_headers,
    )
    assert public_only.status_code == 200
    items = public_only.json()["items"]
    assert len(items) == 1
    assert items[0]["name"] == "Public comparison"
    assert items[0]["public_token"] is not None

    project_only = await client.get(
        f"/api/v1/perf/comparisons?project_id={project_id}&visibility=project",
        headers=auth_headers,
    )
    assert project_only.status_code == 200
    items = project_only.json()["items"]
    assert len(items) == 1
    assert items[0]["name"] == "Private comparison"
    assert items[0]["public_token"] is None


async def test_list_comparisons_requires_project_member(
    client, db_session, auth_headers,
):
    foreign_project = Project(id="proj_cmp_list_foreign", name="Foreign")
    db_session.add(foreign_project)
    await db_session.commit()

    response = await client.get(
        "/api/v1/perf/comparisons?project_id=proj_cmp_list_foreign",
        headers=auth_headers,
    )
    assert response.status_code in {403, 404}


@pytest.fixture(autouse=True)
def _stub_performance_enqueue(monkeypatch):
    from app.modules.performance import tasks as performance_tasks

    monkeypatch.setattr(performance_tasks, "enqueue_performance_import", lambda _import_id: None)
