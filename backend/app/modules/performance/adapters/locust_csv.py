from __future__ import annotations

import csv
from io import StringIO
from typing import Any

from app.core.domain_strings import TITLE_VALIDATION_ERROR
from app.core.errors import DomainError
from app.modules.performance.adapters.types import ParsedPerformancePayload

ADAPTER_NAME = "locust-csv"
ADAPTER_VERSION = "1.0.0"


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        return float(str(value).strip() or 0.0)
    except ValueError:
        return 0.0


def _to_int(value: Any) -> int:
    return int(round(_to_float(value)))


def _locust_row_or_chain(row: dict[str, Any], *keys: str) -> Any:
    result: Any = None
    for key in keys:
        result = result or row.get(key)
    return result


def _locust_process_data_row(
    index: int,
    *,
    method: str,
    name: str,
    request_count: int,
    failure_count: int,
    rps: float,
    p95: float,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if not name:
        name = f"transaction-{index + 1}"

    error_rate = (failure_count / request_count) * 100 if request_count > 0 else 0.0
    tx = {
        "key": f"{method}_{name}".lower().replace(" ", "_").replace("/", "_"),
        "group": method,
        "label": f"{method} {name}",
        "throughput_rps": rps,
        "p95_ms": int(round(p95)),
        "error_rate_pct": error_rate,
    }
    err: dict[str, Any] | None = None
    if failure_count > 0:
        err = {
            "key": f"error_{index + 1}",
            "type": f"{method} {name}",
            "count": failure_count,
            "rate_pct": error_rate,
            "last_seen_at": None,
            "hint": "Derived from locust request failures",
        }
    return tx, err


def _locust_summary_from_totals(
    aggregated_row: dict[str, Any] | None,
    *,
    total_requests: int,
    total_rps: float,
    weighted_p50: float,
    weighted_p95: float,
    weighted_p99: float,
    total_failures: int,
) -> tuple[float, float, float, float, float]:
    if aggregated_row is not None:
        throughput = _to_float(
            aggregated_row.get("Requests/s") or aggregated_row.get("requests_per_second") or aggregated_row.get("RPS")
        )
        p50 = _to_float(
            aggregated_row.get("Median Response Time")
            or aggregated_row.get("median_response_time")
            or aggregated_row.get("50%")
        )
        p95 = _to_float(aggregated_row.get("95%") or aggregated_row.get("P95"))
        p99 = _to_float(aggregated_row.get("99%") or aggregated_row.get("P99"))
        return throughput, p50, p95, p99, (total_failures / total_requests) * 100 if total_requests > 0 else 0.0

    denominator = max(total_requests, 1)
    throughput = total_rps
    p50 = weighted_p50 / denominator
    p95 = weighted_p95 / denominator
    p99 = weighted_p99 / denominator
    error_rate = (total_failures / total_requests) * 100 if total_requests > 0 else 0.0
    return throughput, p50, p95, p99, error_rate


def _locust_parse_row_numbers(row: dict[str, Any]) -> tuple[str, str, bool, int, int, float, float, float, float, float]:
    name = str(_locust_row_or_chain(row, "Name", "name") or "").strip()
    method = str(_locust_row_or_chain(row, "Type", "type") or "").strip() or "HTTP"
    is_aggregated = name.lower() in {"aggregated", "total", "all"}
    request_count = _to_int(_locust_row_or_chain(row, "Request Count", "request_count"))
    failure_count = _to_int(_locust_row_or_chain(row, "Failure Count", "failure_count"))
    rps = _to_float(_locust_row_or_chain(row, "Requests/s", "requests_per_second", "RPS"))
    p50 = _to_float(_locust_row_or_chain(row, "Median Response Time", "median_response_time", "50%"))
    p95 = _to_float(_locust_row_or_chain(row, "95%", "P95", "95_percentile"))
    p99 = _to_float(_locust_row_or_chain(row, "99%", "P99", "99_percentile"))
    return name, method, is_aggregated, request_count, failure_count, rps, p50, p95, p99


def _locust_scan_csv_rows(rows: list[dict[str, Any]]) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
    int,
    int,
    float,
    float,
    float,
    float,
    float,
    dict[str, Any] | None,
]:
    transactions: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    total_requests = 0
    total_failures = 0
    total_rps = 0.0
    weighted_p50 = 0.0
    weighted_p95 = 0.0
    weighted_p99 = 0.0

    aggregated_row: dict[str, Any] | None = None

    for index, row in enumerate(rows):
        name, method, is_aggregated, request_count, failure_count, rps, p50, p95, p99 = _locust_parse_row_numbers(row)

        total_requests += request_count
        total_failures += failure_count
        total_rps += rps
        weighted_p50 += p50 * request_count
        weighted_p95 += p95 * request_count
        weighted_p99 += p99 * request_count

        if is_aggregated:
            aggregated_row = row
            continue

        tx, err = _locust_process_data_row(
            index,
            method=method,
            name=name,
            request_count=request_count,
            failure_count=failure_count,
            rps=rps,
            p95=p95,
        )
        if tx is not None:
            transactions.append(tx)
        if err is not None:
            errors.append(err)

    return (
        transactions,
        errors,
        total_requests,
        total_failures,
        total_rps,
        weighted_p50,
        weighted_p95,
        weighted_p99,
        aggregated_row,
    )


def _locust_read_csv_rows(content: bytes, filename: str) -> list[dict[str, Any]]:
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise DomainError(
            status_code=422,
            code="performance_invalid_locust_csv",
            title=TITLE_VALIDATION_ERROR,
            detail=f"Failed to decode locust CSV: {exc}",
            errors={"file": [f"invalid csv in {filename}"]},
        ) from exc

    reader = csv.DictReader(StringIO(text))
    rows = [row for row in reader if isinstance(row, dict)]
    if not rows:
        raise DomainError(
            status_code=422,
            code="performance_invalid_locust_csv",
            title=TITLE_VALIDATION_ERROR,
            detail="Locust CSV is empty",
            errors={"file": ["empty csv"]},
        )
    return rows


def parse_locust_csv(content: bytes, filename: str) -> ParsedPerformancePayload:
    rows = _locust_read_csv_rows(content, filename)

    (
        transactions,
        errors,
        total_requests,
        total_failures,
        total_rps,
        weighted_p50,
        weighted_p95,
        weighted_p99,
        aggregated_row,
    ) = _locust_scan_csv_rows(rows)

    throughput, p50, p95, p99, error_rate = _locust_summary_from_totals(
        aggregated_row,
        total_requests=total_requests,
        total_rps=total_rps,
        weighted_p50=weighted_p50,
        weighted_p95=weighted_p95,
        weighted_p99=weighted_p99,
        total_failures=total_failures,
    )

    return _locust_build_parsed_payload(
        transactions,
        errors,
        throughput=throughput,
        p50=p50,
        p95=p95,
        p99=p99,
        error_rate=error_rate,
        total_requests=total_requests,
        total_failures=total_failures,
    )


def _locust_transactions_with_fallback(
    transactions: list[dict[str, Any]],
    *,
    throughput: float,
    p95: float,
    total_requests: int,
    total_failures: int,
) -> list[dict[str, Any]]:
    if transactions:
        return transactions
    return [
        {
            "key": "overall_http",
            "group": "HTTP",
            "label": "HTTP overall",
            "throughput_rps": throughput,
            "p95_ms": int(round(p95)),
            "error_rate_pct": (total_failures / total_requests) * 100 if total_requests > 0 else 0.0,
        }
    ]


def _locust_payload_parse_lists(
    errors: list[dict[str, Any]],
) -> tuple[list[str], list[str], list[str], str]:
    found = ["summary", "transactions"]
    missing = ["html", "history-series"]
    issues = ["Locust import does not include HTML report or history series in this version"]
    if errors:
        found.append("errors")
    else:
        missing.append("errors")
        issues.append("No failure rows were found in the CSV")
    parse_status = "partial" if missing else "parsed"
    return found, missing, issues, parse_status


def _locust_build_parsed_payload(
    transactions: list[dict[str, Any]],
    errors: list[dict[str, Any]],
    *,
    throughput: float,
    p50: float,
    p95: float,
    p99: float,
    error_rate: float,
    total_requests: int,
    total_failures: int,
) -> ParsedPerformancePayload:
    transactions = _locust_transactions_with_fallback(
        transactions,
        throughput=throughput,
        p95=p95,
        total_requests=total_requests,
        total_failures=total_failures,
    )
    found, missing, issues, parse_status = _locust_payload_parse_lists(errors)

    summary = {
        "throughput_rps": throughput,
        "error_rate_pct": error_rate,
        "p50_ms": int(round(p50)),
        "p95_ms": int(round(p95)),
        "p99_ms": int(round(p99)),
        "peak_vus": 0,
        "checks_passed": max(total_requests - total_failures, 0),
        "checks_total": total_requests,
        "duration_minutes": 0,
    }

    return ParsedPerformancePayload(
        adapter=ADAPTER_NAME,
        adapter_version=ADAPTER_VERSION,
        confidence=0.92,
        found=found,
        missing=missing,
        parse_status=parse_status,
        issues=issues,
        load_kind="http",
        tool="locust",
        service="unknown-service",
        env="unknown",
        scenario="locust scenario",
        load_profile="locust profile",
        branch="unknown",
        commit="unknown",
        build="unknown",
        version="unknown",
        started_at=None,
        finished_at=None,
        summary=summary,
        transactions=transactions,
        errors=errors,
        environment_snapshot={
            "region": "unknown",
            "cluster": "unknown",
            "namespace": "default",
            "instance_type": "unknown",
            "cpu_cores": 0,
            "memory_gb": 0,
        },
    )
