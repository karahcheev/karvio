from __future__ import annotations

from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

import pytest

from app.core.errors import DomainError
from app.modules.performance.adapters.adapter_registry import parse_upload
from app.modules.performance.schemas.runs import PerformanceUpload

K6_MINIMAL = b"""{
  "metadata": {"load_kind": "http"},
  "metrics": {
    "http_reqs": {"values": {"rate": 42}},
    "http_req_failed": {"values": {"rate": 0}},
    "http_req_duration": {"values": {"med": 10, "p(95)": 20, "p(99)": 30}}
  }
}"""

PYTEST_BENCHMARK_MINIMAL = b"""{
  "version": "5.2.3",
  "benchmarks": [
    {
      "name": "test_foo",
      "stats": {
        "ops": 123.4,
        "rounds": 10,
        "iterations": 1,
        "total": 0.08,
        "median": 0.006,
        "max": 0.009,
        "data": [0.004, 0.006, 0.009]
      }
    }
  ]
}"""


def _zip_bytes(entries: dict[str, bytes]) -> bytes:
    buffer = BytesIO()
    with ZipFile(buffer, "w") as archive:
        for name, data in entries.items():
            archive.writestr(name, data)
    return buffer.getvalue()


async def test_parse_upload_prefers_pytest_benchmark_for_json():
    parsed = parse_upload(
        PerformanceUpload(
            content=PYTEST_BENCHMARK_MINIMAL,
            filename="pytest-benchmark.json",
            content_type="application/json",
        )
    )

    assert parsed.adapter == "pytest-benchmark-json"
    assert parsed.load_kind == "benchmark"


async def test_parse_upload_keeps_k6_json_support():
    parsed = parse_upload(
        PerformanceUpload(
            content=K6_MINIMAL,
            filename="result.json",
            content_type="application/json",
        )
    )

    assert parsed.adapter == "k6-json"
    assert parsed.tool == "k6"


async def test_parse_upload_zip_prioritizes_benchmark_named_json():
    zip_payload = _zip_bytes(
        {
            "artifacts/pytest-benchmark.json": PYTEST_BENCHMARK_MINIMAL,
            "artifacts/result.json": K6_MINIMAL,
        }
    )

    parsed = parse_upload(
        PerformanceUpload(
            content=zip_payload,
            filename="bundle.zip",
            content_type="application/zip",
        )
    )

    assert parsed.adapter == "pytest-benchmark-json"


async def test_parse_upload_zip_rejects_too_many_members():
    entries = {f"f{i}.txt": b"x" for i in range(401)}
    zip_payload = _zip_bytes(entries)
    with pytest.raises(DomainError) as exc:
        parse_upload(PerformanceUpload(content=zip_payload, filename="big.zip", content_type="application/zip"))
    assert exc.value.code == "performance_zip_too_many_members"


async def test_parse_upload_zip_rejects_suspicious_compression_ratio():
    payload = b"\x00" * (2 * 1024 * 1024)
    buffer = BytesIO()
    with ZipFile(buffer, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("result.json", payload)
    zip_payload = buffer.getvalue()
    with pytest.raises(DomainError) as exc:
        parse_upload(PerformanceUpload(content=zip_payload, filename="bomb.zip", content_type="application/zip"))
    assert exc.value.code == "performance_zip_suspicious_compression"
