from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.core.errors import DomainError
from app.modules.performance.adapters.types import ParsedPerformancePayload

ADAPTER_NAME = "k6-json"
ADAPTER_VERSION = "1.0.0"


def _parse_dt(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _metric(metrics: dict[str, Any], metric_name: str, *keys: str, default: float = 0.0) -> float:
    metric = metrics.get(metric_name)
    if not isinstance(metric, dict):
        return default
    values = metric.get("values")
    if not isinstance(values, dict):
        return default
    for key in keys:
        value = values.get(key)
        if isinstance(value, (int, float)):
            return float(value)
    return default


def _normalize_rate(raw: float) -> float:
    if raw <= 1:
        return raw * 100
    return raw


def _k6_build_transactions(
    payload: dict[str, Any],
    *,
    throughput: float,
    p95: int,
    error_rate: float,
) -> list[dict[str, Any]]:
    transactions: list[dict[str, Any]] = []
    raw_transactions = payload.get("transactions")
    if isinstance(raw_transactions, list):
        for index, item in enumerate(raw_transactions):
            if not isinstance(item, dict):
                continue
            label = str(item.get("label") or item.get("name") or f"transaction-{index + 1}")
            transactions.append(
                {
                    "key": str(item.get("key") or label.lower().replace(" ", "_")),
                    "group": str(item.get("group") or item.get("method") or "HTTP"),
                    "label": label,
                    "throughput_rps": float(item.get("throughput_rps") or item.get("rps") or 0.0),
                    "p95_ms": int(round(float(item.get("p95_ms") or item.get("p95") or 0.0))),
                    "error_rate_pct": float(item.get("error_rate_pct") or item.get("error_rate") or 0.0),
                    "description": item.get("description"),
                    "run_command": item.get("run_command"),
                }
            )

    if not transactions:
        transactions = [
            {
                "key": "overall_http",
                "group": "HTTP",
                "label": "HTTP overall",
                "throughput_rps": throughput,
                "p95_ms": p95,
                "error_rate_pct": error_rate,
            }
        ]
    return transactions


def _k6_append_synthetic_error_bucket(
    payload: dict[str, Any],
    errors: list[dict[str, Any]],
    *,
    error_rate: float,
    checks_total: int,
) -> None:
    if errors or error_rate <= 0:
        return
    synthetic_count = max(1, int((checks_total or 1000) * (error_rate / 100)))
    errors.append(
        {
            "key": "synthetic_error_rate",
            "type": "HTTP error rate",
            "count": synthetic_count,
            "rate_pct": error_rate,
            "last_seen_at": payload.get("finished_at") or payload.get("started_at"),
            "hint": "Derived from http_req_failed metric",
        }
    )


def _k6_build_errors(payload: dict[str, Any], *, error_rate: float, checks_total: int) -> list[dict[str, Any]]:
    errors: list[dict[str, Any]] = []
    raw_errors = payload.get("errors")
    if isinstance(raw_errors, list):
        for index, item in enumerate(raw_errors):
            if not isinstance(item, dict):
                continue
            errors.append(
                {
                    "key": str(item.get("key") or f"err_{index + 1}"),
                    "type": str(item.get("type") or "Error"),
                    "count": int(item.get("count") or 0),
                    "rate_pct": float(item.get("rate_pct") or 0.0),
                    "last_seen_at": item.get("last_seen_at") or payload.get("finished_at"),
                    "hint": str(item.get("hint") or ""),
                }
            )

    _k6_append_synthetic_error_bucket(payload, errors, error_rate=error_rate, checks_total=checks_total)
    return errors


def _k6_parse_found_missing_issues(payload: dict[str, Any], errors: list[dict[str, Any]]) -> tuple[list[str], list[str], list[str], str]:
    found = ["summary", "transactions"]
    missing: list[str] = []
    issues: list[str] = []

    if errors:
        found.append("errors")
    else:
        missing.append("errors")
        issues.append("Error buckets are missing in source payload")

    if isinstance(payload.get("html_report"), str):
        found.append("html")
    else:
        missing.append("html")

    if isinstance(payload.get("history_series"), list):
        found.append("history-series")
    else:
        missing.append("history-series")

    parse_status = "parsed" if not missing else "partial"
    return found, missing, issues, parse_status


def _k6_resolve_duration_seconds(payload: dict[str, Any], started_at: datetime | None, finished_at: datetime | None) -> float:
    duration_seconds = float(payload.get("duration_seconds") or 0)
    if duration_seconds <= 0:
        duration_ms = float(payload.get("duration_ms") or 0)
        duration_seconds = duration_ms / 1000.0

    if started_at and finished_at and finished_at > started_at and duration_seconds <= 0:
        duration_seconds = (finished_at - started_at).total_seconds()
    return duration_seconds


def _k6_summary_block(
    *,
    throughput: float,
    error_rate: float,
    p50: int,
    p95: int,
    p99: int,
    peak_vus: int,
    checks_passed: int,
    checks_total: int,
    duration_seconds: float,
) -> dict[str, Any]:
    return {
        "throughput_rps": throughput,
        "error_rate_pct": error_rate,
        "p50_ms": p50,
        "p95_ms": p95,
        "p99_ms": p99,
        "peak_vus": peak_vus,
        "checks_passed": checks_passed,
        "checks_total": checks_total,
        "duration_minutes": int(round(duration_seconds / 60.0)) if duration_seconds > 0 else 0,
    }


def _k6_environment_snapshot_block(meta: dict[str, Any]) -> dict[str, Any]:
    env_snapshot = meta.get("environment_snapshot") if isinstance(meta.get("environment_snapshot"), dict) else {}
    return {
        "region": str(env_snapshot.get("region") or "unknown"),
        "cluster": str(env_snapshot.get("cluster") or "unknown"),
        "namespace": str(env_snapshot.get("namespace") or "default"),
        "instance_type": str(env_snapshot.get("instance_type") or "unknown"),
        "cpu_cores": int(env_snapshot.get("cpu_cores") or 0),
        "memory_gb": int(env_snapshot.get("memory_gb") or 0),
    }


@dataclass(frozen=True, slots=True)
class K6ParsedBuildParams:
    throughput: float
    error_rate: float
    p50: int
    p95: int
    p99: int
    peak_vus: int
    checks_passed: int
    checks_total: int
    duration_seconds: float
    started_at: datetime | None
    finished_at: datetime | None
    transactions: list[dict[str, Any]]
    errors: list[dict[str, Any]]
    found: list[str]
    missing: list[str]
    issues: list[str]
    parse_status: str


def _k6_parsed_performance_payload(
    payload: dict[str, Any],
    meta: dict[str, Any],
    params: K6ParsedBuildParams,
) -> ParsedPerformancePayload:
    summary = _k6_summary_block(
        throughput=params.throughput,
        error_rate=params.error_rate,
        p50=params.p50,
        p95=params.p95,
        p99=params.p99,
        peak_vus=params.peak_vus,
        checks_passed=params.checks_passed,
        checks_total=params.checks_total,
        duration_seconds=params.duration_seconds,
    )
    return ParsedPerformancePayload(
        adapter=ADAPTER_NAME,
        adapter_version=ADAPTER_VERSION,
        confidence=0.98,
        found=params.found,
        missing=params.missing,
        parse_status=params.parse_status,
        issues=params.issues,
        load_kind=str(meta.get("load_kind") or "http"),
        tool="k6",
        service=str(meta.get("service") or "unknown-service"),
        env=str(meta.get("env") or meta.get("environment") or "unknown"),
        scenario=str(meta.get("scenario") or payload.get("scenario") or "unknown scenario"),
        load_profile=str(meta.get("load_profile") or "unknown profile"),
        branch=str(meta.get("branch") or "unknown"),
        commit=str(meta.get("commit") or "unknown"),
        build=str(meta.get("build") or "unknown"),
        version=str(meta.get("version") or "unknown"),
        started_at=params.started_at,
        finished_at=params.finished_at,
        summary=summary,
        transactions=params.transactions,
        errors=params.errors,
        environment_snapshot=_k6_environment_snapshot_block(meta),
    )


def parse_k6_json(content: bytes, filename: str) -> ParsedPerformancePayload:
    try:
        payload = json.loads(content.decode("utf-8"))
    except Exception as exc:  # pragma: no cover - defensive
        raise DomainError(
            status_code=422,
            code="performance_invalid_k6_json",
            title="Validation error",
            detail=f"Failed to parse k6 JSON: {exc}",
            errors={"file": [f"invalid json in {filename}"]},
        ) from exc

    if not isinstance(payload, dict):
        raise DomainError(
            status_code=422,
            code="performance_invalid_k6_json",
            title="Validation error",
            detail="k6 JSON payload must be an object",
            errors={"file": ["invalid k6 json shape"]},
        )

    metrics = payload.get("metrics") if isinstance(payload.get("metrics"), dict) else {}
    meta = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}

    throughput = _metric(metrics, "http_reqs", "rate")
    error_rate = _normalize_rate(_metric(metrics, "http_req_failed", "rate"))
    p50 = int(round(_metric(metrics, "http_req_duration", "med", "p(50)")))
    p95 = int(round(_metric(metrics, "http_req_duration", "p(95)")))
    p99 = int(round(_metric(metrics, "http_req_duration", "p(99)")))
    peak_vus = int(round(_metric(metrics, "vus_max", "value", "max")))
    checks_passed = int(round(_metric(metrics, "checks", "passes")))
    checks_failed = int(round(_metric(metrics, "checks", "fails")))
    checks_total = checks_passed + checks_failed

    transactions = _k6_build_transactions(
        payload,
        throughput=throughput,
        p95=p95,
        error_rate=error_rate,
    )

    errors = _k6_build_errors(payload, error_rate=error_rate, checks_total=checks_total)

    found, missing, issues, parse_status = _k6_parse_found_missing_issues(payload, errors)

    started_at = _parse_dt(payload.get("started_at"))
    finished_at = _parse_dt(payload.get("finished_at"))
    duration_seconds = _k6_resolve_duration_seconds(payload, started_at, finished_at)

    return _k6_parsed_performance_payload(
        payload,
        meta,
        K6ParsedBuildParams(
            throughput=throughput,
            error_rate=error_rate,
            p50=p50,
            p95=p95,
            p99=p99,
            peak_vus=peak_vus,
            checks_passed=checks_passed,
            checks_total=checks_total,
            duration_seconds=duration_seconds,
            started_at=started_at,
            finished_at=finished_at,
            transactions=transactions,
            errors=errors,
            found=found,
            missing=missing,
            issues=issues,
            parse_status=parse_status,
        ),
    )
