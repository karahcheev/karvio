import pytest

from app.core.errors import DomainError
from app.modules.performance.adapters.k6_json import parse_k6_json
from app.modules.performance.adapters.locust_csv import parse_locust_csv
from app.modules.performance.adapters.pytest_benchmark_json import parse_pytest_benchmark_json


async def test_parse_k6_json_extracts_summary_transactions_and_errors():
    payload = b'''{
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

    parsed = parse_k6_json(payload, "result.json")

    assert parsed.adapter == "k6-json"
    assert parsed.summary["throughput_rps"] == 840
    assert parsed.summary["p95_ms"] == 870
    assert parsed.summary["checks_total"] == 102
    assert parsed.service == "payments-api"
    assert parsed.env == "staging-eu"
    assert parsed.transactions[0]["key"] == "checkout_confirm"
    assert parsed.errors[0]["key"] == "timeout"


async def test_parse_locust_csv_extracts_summary_transactions_and_errors():
    csv_payload = b"""Type,Name,Request Count,Failure Count,Median Response Time,95%,99%,Requests/s\nPOST,/payments/confirm,5000,210,820,1140,1510,220\nGET,/payments/status,8000,0,180,290,420,355\n,Aggregated,13000,210,220,870,1402,840\n"""

    parsed = parse_locust_csv(csv_payload, "request_stats.csv")

    assert parsed.adapter == "locust-csv"
    assert parsed.summary["throughput_rps"] == 840
    assert parsed.summary["error_rate_pct"] > 1
    assert len(parsed.transactions) == 2
    assert parsed.transactions[0]["group"] in {"POST", "GET"}
    assert parsed.parse_status == "partial"


async def test_parse_pytest_benchmark_json_extracts_summary_transactions_and_metadata():
    payload = b"""{
      "machine_info": {
        "node": "runner-1",
        "machine": "arm64",
        "python_implementation": "CPython",
        "python_version": "3.12.2",
        "system": "Linux",
        "release": "6.8.0",
        "cpu": {"brand_raw": "Apple M3 Max"}
      },
      "commit_info": {
        "id": "abcd1234",
        "branch": "feature/bench",
        "project": "payments",
        "time": "2026-03-23T10:30:00+00:00"
      },
      "datetime": "2026-03-23T10:40:00+00:00",
      "version": "5.2.3",
      "benchmarks": [
        {
          "group": "checkout",
          "name": "test_checkout",
          "fullname": "tests/perf/test_checkout.py::test_checkout",
          "stats": {
            "min": 0.001,
            "max": 0.005,
            "mean": 0.0025,
            "median": 0.0023,
            "ops": 400.0,
            "rounds": 10,
            "iterations": 1,
            "total": 0.025,
            "data": [0.001, 0.002, 0.003, 0.004, 0.005]
          },
          "options": {"warmup": true}
        }
      ]
    }"""

    parsed = parse_pytest_benchmark_json(payload, "benchmark.json")

    assert parsed.adapter == "pytest-benchmark-json"
    assert parsed.tool == "pytest-benchmark"
    assert parsed.load_kind == "benchmark"
    assert parsed.summary["checks_total"] == 1
    assert parsed.summary["throughput_rps"] == 400.0
    assert parsed.transactions[0]["label"] == "tests/perf/test_checkout.py::test_checkout"
    assert parsed.environment_snapshot["python_version"] == "3.12.2"
    assert parsed.environment_snapshot["benchmark_framework_version"] == "5.2.3"
    assert parsed.environment_snapshot["warmup_enabled"] is True


async def test_parse_pytest_benchmark_json_marks_fallback_when_data_is_missing():
    payload = b"""{
      "benchmarks": [
        {
          "name": "test_fallback",
          "stats": {
            "min": 0.003,
            "max": 0.009,
            "mean": 0.005,
            "median": 0.004,
            "rounds": 20,
            "iterations": 2,
            "total": 0.1
          }
        }
      ]
    }"""

    parsed = parse_pytest_benchmark_json(payload, "benchmark.json")

    assert parsed.summary["checks_total"] == 1
    assert parsed.transactions[0]["p95_ms"] > 0
    assert any("fallback" in issue.lower() for issue in parsed.issues)


async def test_parse_pytest_benchmark_json_rejects_invalid_shape():
    with pytest.raises(DomainError) as exc:
        parse_pytest_benchmark_json(b'{"metrics": {}}', "benchmark.json")

    assert exc.value.code == "performance_invalid_pytest_benchmark_json"
