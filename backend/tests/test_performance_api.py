from __future__ import annotations

import pytest

from app.main import app
from app.models.enums import ProjectMemberRole
from app.modules.performance.models import PerformanceRunArtifact, PerformanceRunError, PerformanceRunTransaction
from app.modules.performance import tasks as performance_tasks
from app.modules.performance.services.import_worker import process_performance_import
from app.modules.performance.router import get_performance_storage
from app.modules.performance.storage import PerformanceArtifactStorage
from app.modules.projects.models import Project, ProjectMember, User


K6_SAMPLE = b'''{
  "metadata": {
    "service": "payments-api",
    "env": "staging-eu",
    "scenario": "Checkout 3DS",
    "load_profile": "ramp-200-600-vus",
    "branch": "feature/retry-token",
    "commit": "5e8a1d2",
    "build": "build-1294",
    "version": "v2026.03.21-rc2",
    "load_kind": "http",
    "environment_snapshot": {
      "region": "eu-central-1",
      "cluster": "staging-eu-k8s",
      "namespace": "payments",
      "instance_type": "c6i.4xlarge",
      "cpu_cores": 16,
      "memory_gb": 32
    }
  },
  "started_at": "2026-03-21T21:00:00Z",
  "finished_at": "2026-03-21T21:33:00Z",
  "metrics": {
    "http_reqs": {"values": {"rate": 840}},
    "http_req_failed": {"values": {"rate": 0.028}},
    "http_req_duration": {"values": {"med": 188, "p(95)": 870, "p(99)": 1402}},
    "vus_max": {"values": {"value": 600}},
    "checks": {"values": {"passes": 79, "fails": 23}}
  },
  "transactions": [
    {
      "key": "checkout_confirm",
      "group": "POST",
      "label": "POST /payments/confirm",
      "throughput_rps": 220,
      "p95_ms": 1140,
      "error_rate_pct": 4.2
    }
  ],
  "errors": [
    {
      "key": "timeout",
      "type": "TimeoutError",
      "count": 241,
      "rate_pct": 1.8,
      "last_seen_at": "2026-03-21T21:32:20Z",
      "hint": "Spike aligns with DB pool saturation"
    }
  ]
}'''

PYTEST_BENCHMARK_SAMPLE = b'''{
  "machine_info": {
    "node": "ci-runner-1",
    "machine": "x86_64",
    "python_implementation": "CPython",
    "python_version": "3.12.2",
    "system": "Linux",
    "release": "6.8.0",
    "cpu": {"brand_raw": "Intel(R) Xeon(R) Platinum"}
  },
  "commit_info": {
    "id": "bench1234",
    "branch": "feature/benchmark",
    "project": "payments-api",
    "time": "2026-03-23T10:10:00+00:00"
  },
  "datetime": "2026-03-23T10:20:00+00:00",
  "version": "5.2.3",
  "benchmarks": [
    {
      "group": "checkout",
      "name": "test_checkout_hot_path",
      "fullname": "tests/perf/test_checkout.py::test_checkout_hot_path",
      "stats": {
        "min": 0.0012,
        "max": 0.0079,
        "mean": 0.0031,
        "median": 0.0028,
        "ops": 322.58,
        "rounds": 10,
        "iterations": 1,
        "total": 0.031,
        "data": [0.0012, 0.0020, 0.0028, 0.0035, 0.0079]
      },
      "options": {"warmup": true}
    },
    {
      "group": "status",
      "name": "test_status_lookup",
      "fullname": "tests/perf/test_status.py::test_status_lookup",
      "stats": {
        "min": 0.0009,
        "max": 0.0049,
        "mean": 0.0021,
        "median": 0.0019,
        "ops": 476.19,
        "rounds": 10,
        "iterations": 1,
        "total": 0.021,
        "data": [0.0009, 0.0012, 0.0019, 0.0024, 0.0049]
      },
      "options": {"warmup": true}
    }
  ]
}'''


async def _seed_project(db_session, auth_user: User, project_id: str = "proj_perf_1") -> str:
    """Return project id string — ORM instances expire after commit; avoid lazy IO in tests."""
    project = Project(id=project_id, name="Performance Project")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()
    return project_id


@pytest.fixture(autouse=True)
def _stub_performance_enqueue(monkeypatch):
    monkeypatch.setattr(performance_tasks, "enqueue_performance_import", lambda _import_id: None)



async def test_performance_runs_manual_crud(client, db_session, auth_headers, auth_user: User):
    project_id = await _seed_project(db_session, auth_user, project_id="proj_perf_manual")

    create_response = await client.post(
        "/api/v1/perf/runs",
        json={
            "project_id": project_id,
            "name": "Manual run",
            "load_kind": "http",
            "service": "payments-api",
            "env": "staging-eu",
            "scenario": "Checkout 3DS",
            "load_profile": "ramp-200-600-vus",
            "branch": "feature/retry-token",
            "commit": "5e8a1d2",
            "build": "build-1295",
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
    assert create_response.status_code == 201
    run = create_response.json()
    assert run["project_id"] == project_id
    assert run["name"] == "Manual run"
    assert run["acknowledged"] is False
    assert run["archived"] is False

    list_response = await client.get(f"/api/v1/perf/runs?project_id={project_id}", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()["items"]) == 1

    archive_response = await client.patch(
        f"/api/v1/perf/runs/{run['id']}",
        json={"archived": True},
        headers=auth_headers,
    )
    assert archive_response.status_code == 200
    assert archive_response.json()["archived"] is True

    list_active = await client.get(f"/api/v1/perf/runs?project_id={project_id}", headers=auth_headers)
    assert list_active.status_code == 200
    assert list_active.json()["items"] == []

    list_with_archived = await client.get(
        f"/api/v1/perf/runs?project_id={project_id}&include_archived=true",
        headers=auth_headers,
    )
    assert list_with_archived.status_code == 200
    assert len(list_with_archived.json()["items"]) == 1
    assert list_with_archived.json()["items"][0]["id"] == run["id"]

    get_response = await client.get(f"/api/v1/perf/runs/{run['id']}", headers=auth_headers)
    assert get_response.status_code == 200
    assert get_response.json()["id"] == run["id"]

    patch_response = await client.patch(
        f"/api/v1/perf/runs/{run['id']}",
        json={"acknowledged": True, "status": "completed"},
        headers=auth_headers,
    )
    assert patch_response.status_code == 200
    patched = patch_response.json()
    assert patched["acknowledged"] is True
    assert patched["status"] == "completed"

    mark_baseline_response = await client.patch(
        f"/api/v1/perf/runs/{run['id']}",
        json={"mark_as_baseline": True},
        headers=auth_headers,
    )
    assert mark_baseline_response.status_code == 200
    marked = mark_baseline_response.json()
    assert marked["baseline"]["policy"] == "tagged"
    assert marked["baseline"]["ref"] == run["id"]


async def test_performance_run_rejects_mark_baseline_when_not_completed(client, db_session, auth_headers, auth_user: User):
    project_id = await _seed_project(db_session, auth_user, project_id="proj_perf_mark_invalid")

    create_response = await client.post(
        "/api/v1/perf/runs",
        json={
            "project_id": project_id,
            "name": "Manual incomplete run",
            "load_kind": "http",
            "service": "payments-api",
            "env": "staging-eu",
            "scenario": "Checkout 3DS",
            "load_profile": "ramp-200-600-vus",
            "branch": "feature/retry-token",
            "commit": "5e8a1d2",
            "build": "build-1295",
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
    assert create_response.status_code == 201
    run = create_response.json()

    mark_baseline_response = await client.patch(
        f"/api/v1/perf/runs/{run['id']}",
        json={"mark_as_baseline": True},
        headers=auth_headers,
    )
    assert mark_baseline_response.status_code == 422



async def test_performance_import_preflight(client, db_session, auth_headers, auth_user: User):
    project_id = await _seed_project(db_session, auth_user, project_id="proj_perf_preflight")

    response = await client.post(
        f"/api/v1/perf/imports/validate?project_id={project_id}",
        files={"file": ("result.json", K6_SAMPLE, "application/json")},
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["adapter"] == "k6-json"
    assert body["parse_status"] in {"parsed", "partial"}
    assert "summary" in body["found"]


async def test_performance_import_preflight_pytest_benchmark(client, db_session, auth_headers, auth_user: User):
    project_id = await _seed_project(db_session, auth_user, project_id="proj_perf_preflight_pytest_benchmark")

    response = await client.post(
        f"/api/v1/perf/imports/validate?project_id={project_id}",
        files={"file": ("benchmark.json", PYTEST_BENCHMARK_SAMPLE, "application/json")},
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["adapter"] == "pytest-benchmark-json"
    assert body["parse_status"] in {"parsed", "partial"}



async def test_performance_import_async_lifecycle_and_artifact_download(
    client,
    db_session,
    auth_headers,
    auth_user: User,
    tmp_path,
):
    project_id = await _seed_project(db_session, auth_user, project_id="proj_perf_import")

    storage = PerformanceArtifactStorage(str(tmp_path / "performance-artifacts"))
    app.dependency_overrides[get_performance_storage] = lambda: storage
    try:
        create_response = await client.post(
            f"/api/v1/perf/imports?project_id={project_id}",
            files={"file": ("result.json", K6_SAMPLE, "application/json")},
            headers=auth_headers,
        )
        assert create_response.status_code == 202
        accepted = create_response.json()

        pending_response = await client.get(f"/api/v1/perf/imports/{accepted['import_id']}", headers=auth_headers)
        assert pending_response.status_code == 200
        assert pending_response.json()["status"] == "pending"

        processed = await process_performance_import(db_session, import_id=accepted["import_id"], storage=storage)
        assert processed is True

        import_response = await client.get(f"/api/v1/perf/imports/{accepted['import_id']}", headers=auth_headers)
        assert import_response.status_code == 200
        import_payload = import_response.json()
        assert import_payload["status"] in {"partial", "completed"}
        assert import_payload["adapter"] == "k6-json"

        run_response = await client.get(f"/api/v1/perf/runs/{accepted['run_id']}", headers=auth_headers)
        assert run_response.status_code == 200
        run_payload = run_response.json()
        assert run_payload["transactions"]
        assert run_payload["errors"]
        assert run_payload["summary"]["p95_ms"] == 870

        summary_artifact = next(item for item in run_payload["artifacts"] if item["label"] == "summary.json")
        download_response = await client.get(f"/api/v1/performance-artifacts/{summary_artifact['id']}", headers=auth_headers)
        assert download_response.status_code == 200
        assert b'"run_id"' in download_response.content
    finally:
        app.dependency_overrides.pop(get_performance_storage, None)


async def test_performance_runs_list_is_lightweight_while_detail_keeps_relationships(
    client,
    db_session,
    auth_headers,
    auth_user: User,
):
    project_id = await _seed_project(db_session, auth_user, project_id="proj_perf_list_light")

    create_response = await client.post(
        "/api/v1/perf/runs",
        json={
            "project_id": project_id,
            "name": "Run with details",
            "load_kind": "http",
            "service": "payments-api",
            "env": "staging-eu",
            "scenario": "Checkout 3DS",
            "load_profile": "ramp-200-600-vus",
            "branch": "feature/retry-token",
            "commit": "5e8a1d2",
            "build": "build-list-light",
            "tool": "k6",
            "version": "v2026.03.22",
            "status": "completed",
            "region": "eu-central-1",
            "cluster": "staging-eu-k8s",
            "namespace": "payments",
            "instance_type": "c6i.4xlarge",
            "cpu_cores": 16,
            "memory_gb": 32,
        },
        headers=auth_headers,
    )
    assert create_response.status_code == 201
    run_id = create_response.json()["id"]

    db_session.add_all(
        [
            PerformanceRunTransaction(
                run_id=run_id,
                position=1,
                key="tx_1",
                tx_group="HTTP",
                label="GET /health",
                throughput_rps=100.0,
                p95_ms=20,
                error_rate_pct=0.0,
            ),
            PerformanceRunError(
                run_id=run_id,
                key="timeout",
                error_type="TimeoutError",
                count=1,
                rate_pct=0.1,
                hint="Transient",
            ),
            PerformanceRunArtifact(
                run_id=run_id,
                label="summary.json",
                artifact_type="json",
                size_bytes=128,
                status="ready",
            ),
        ]
    )
    await db_session.commit()

    list_response = await client.get(f"/api/v1/perf/runs?project_id={project_id}", headers=auth_headers)
    assert list_response.status_code == 200
    list_item = list_response.json()["items"][0]
    assert list_item["id"] == run_id
    assert list_item["transactions"] == []
    assert list_item["errors"] == []
    assert list_item["artifacts"] == []
    assert list_item["import_record"] is None

    detail_response = await client.get(f"/api/v1/perf/runs/{run_id}", headers=auth_headers)
    assert detail_response.status_code == 200
    detail_item = detail_response.json()
    assert len(detail_item["transactions"]) == 1
    assert len(detail_item["errors"]) == 1
    assert len(detail_item["artifacts"]) == 1


async def test_performance_import_prefers_tagged_baseline(
    client,
    db_session,
    auth_headers,
    auth_user: User,
    tmp_path,
):
    project_id = await _seed_project(db_session, auth_user, project_id="proj_perf_tagged_baseline")

    baseline_create = await client.post(
        "/api/v1/perf/runs",
        json={
            "project_id": project_id,
            "name": "Manual tagged baseline",
            "load_kind": "http",
            "service": "payments-api",
            "env": "staging-eu",
            "scenario": "Checkout 3DS",
            "load_profile": "ramp-200-600-vus",
            "branch": "feature/retry-token",
            "commit": "5e8a1d2",
            "build": "build-2000",
            "tool": "k6",
            "version": "v2026.03.22",
            "status": "completed",
            "region": "eu-central-1",
            "cluster": "staging-eu-k8s",
            "namespace": "payments",
            "instance_type": "c6i.4xlarge",
            "cpu_cores": 16,
            "memory_gb": 32,
        },
        headers=auth_headers,
    )
    assert baseline_create.status_code == 201
    baseline_run = baseline_create.json()

    tagged_response = await client.patch(
        f"/api/v1/perf/runs/{baseline_run['id']}",
        json={"mark_as_baseline": True},
        headers=auth_headers,
    )
    assert tagged_response.status_code == 200

    storage = PerformanceArtifactStorage(str(tmp_path / "performance-artifacts-tagged"))
    app.dependency_overrides[get_performance_storage] = lambda: storage
    try:
        create_response = await client.post(
            f"/api/v1/perf/imports?project_id={project_id}",
            files={"file": ("result.json", K6_SAMPLE, "application/json")},
            headers=auth_headers,
        )
        assert create_response.status_code == 202
        accepted = create_response.json()

        processed = await process_performance_import(db_session, import_id=accepted["import_id"], storage=storage)
        assert processed is True

        run_response = await client.get(f"/api/v1/perf/runs/{accepted['run_id']}", headers=auth_headers)
        assert run_response.status_code == 200
        run_payload = run_response.json()
        assert run_payload["baseline"]["policy"] == "tagged"
        assert run_payload["baseline"]["ref"] == baseline_run["id"]
    finally:
        app.dependency_overrides.pop(get_performance_storage, None)


async def test_performance_import_pytest_benchmark_async_lifecycle_and_load_kind_isolation(
    client,
    db_session,
    auth_headers,
    auth_user: User,
    tmp_path,
):
    project_id = await _seed_project(db_session, auth_user, project_id="proj_perf_pytest_benchmark_import")

    tagged_http_baseline_create = await client.post(
        "/api/v1/perf/runs",
        json={
            "project_id": project_id,
            "name": "Tagged HTTP baseline",
            "load_kind": "http",
            "service": "payments-api",
            "env": "staging-eu",
            "scenario": "Checkout 3DS",
            "load_profile": "ramp-200-600-vus",
            "branch": "main",
            "commit": "abc123",
            "build": "build-http-baseline",
            "tool": "k6",
            "version": "v2026.03.23",
            "status": "completed",
            "region": "eu-central-1",
            "cluster": "staging-eu-k8s",
            "namespace": "payments",
            "instance_type": "c6i.4xlarge",
            "cpu_cores": 16,
            "memory_gb": 32,
        },
        headers=auth_headers,
    )
    assert tagged_http_baseline_create.status_code == 201
    tagged_http_baseline = tagged_http_baseline_create.json()

    mark_baseline_response = await client.patch(
        f"/api/v1/perf/runs/{tagged_http_baseline['id']}",
        json={"mark_as_baseline": True},
        headers=auth_headers,
    )
    assert mark_baseline_response.status_code == 200

    storage = PerformanceArtifactStorage(str(tmp_path / "performance-artifacts-pytest-benchmark"))
    app.dependency_overrides[get_performance_storage] = lambda: storage
    try:
        create_response = await client.post(
            f"/api/v1/perf/imports?project_id={project_id}",
            files={"file": ("benchmark.json", PYTEST_BENCHMARK_SAMPLE, "application/json")},
            headers=auth_headers,
        )
        assert create_response.status_code == 202
        accepted = create_response.json()

        processed = await process_performance_import(db_session, import_id=accepted["import_id"], storage=storage)
        assert processed is True

        import_response = await client.get(f"/api/v1/perf/imports/{accepted['import_id']}", headers=auth_headers)
        assert import_response.status_code == 200
        import_payload = import_response.json()
        assert import_payload["adapter"] == "pytest-benchmark-json"

        run_response = await client.get(f"/api/v1/perf/runs/{accepted['run_id']}", headers=auth_headers)
        assert run_response.status_code == 200
        run_payload = run_response.json()
        assert run_payload["tool"] == "pytest-benchmark"
        assert run_payload["load_kind"] == "benchmark"
        assert run_payload["transactions"]
        assert run_payload["errors"] == []
        assert run_payload["environment_snapshot"]["python_version"] == "3.12.2"
        assert run_payload["environment_snapshot"]["benchmark_framework_version"] == "5.2.3"
        assert run_payload["environment_snapshot"]["warmup_enabled"] is True

        # HTTP tagged baseline must not be used for benchmark run comparisons.
        assert run_payload["baseline"]["policy"] == "manual"
    finally:
        app.dependency_overrides.pop(get_performance_storage, None)



async def test_performance_import_marks_failed_for_invalid_payload(
    client,
    db_session,
    auth_headers,
    auth_user: User,
    tmp_path,
):
    project_id = await _seed_project(db_session, auth_user, project_id="proj_perf_dead")

    storage = PerformanceArtifactStorage(str(tmp_path / "performance-artifacts-dead"))
    app.dependency_overrides[get_performance_storage] = lambda: storage
    try:
        create_response = await client.post(
            f"/api/v1/perf/imports?project_id={project_id}",
            files={"file": ("unsupported.txt", b"plain text", "text/plain")},
            headers=auth_headers,
        )
        assert create_response.status_code == 202
        accepted = create_response.json()

        processed = await process_performance_import(db_session, import_id=accepted["import_id"], storage=storage)
        assert processed is False

        import_response = await client.get(f"/api/v1/perf/imports/{accepted['import_id']}", headers=auth_headers)
        assert import_response.status_code == 200
        payload = import_response.json()
        assert payload["status"] == "failed"
        assert payload["parse_status"] == "failed"
    finally:
        app.dependency_overrides.pop(get_performance_storage, None)
