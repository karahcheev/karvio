from __future__ import annotations

import json
import math
import re
from datetime import datetime, timedelta
from typing import Any

from app.core.domain_strings import TITLE_VALIDATION_ERROR
from app.core.errors import DomainError
from app.modules.performance.adapters.types import ParsedPerformancePayload

ADAPTER_NAME = "pytest-benchmark-json"
ADAPTER_VERSION = "1.0.0"


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).strip() or 0.0)
    except ValueError:
        return 0.0


def _parse_dt(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def _slug(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "_", value.strip().lower()).strip("_")
    return normalized or "benchmark"


def _percentile(sorted_values: list[float], p: float) -> float:
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return sorted_values[0]
    rank = (len(sorted_values) - 1) * p
    lower = int(math.floor(rank))
    upper = int(math.ceil(rank))
    if lower == upper:
        return sorted_values[lower]
    weight = rank - lower
    return sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * weight


def _seconds_to_ms(value: float) -> int:
    return int(round(max(value, 0.0) * 1000.0))


def _p95_ms_from_stats(stats: dict[str, Any], *, label: str, issues: list[str]) -> int:
    data = stats.get("data")
    if isinstance(data, list):
        samples = [_to_float(sample) for sample in data]
        samples = [sample for sample in samples if sample >= 0]
        if samples:
            samples.sort()
            return _seconds_to_ms(_percentile(samples, 0.95))

    for key in ("max", "q3", "median", "mean", "min"):
        fallback = _to_float(stats.get(key))
        if fallback > 0:
            issues.append(f"Used {key} as p95 fallback for benchmark '{label}'")
            return _seconds_to_ms(fallback)

    issues.append(f"Missing latency statistics for benchmark '{label}'")
    return 0


def _first_non_empty(*values: Any) -> str | None:
    for value in values:
        if isinstance(value, str):
            stripped = value.strip()
            if stripped:
                return stripped
    return None


def _warmup_parse_option_value(warmup: Any) -> bool | None:
    if isinstance(warmup, bool):
        return warmup
    if isinstance(warmup, str):
        lowered = warmup.strip().lower()
        if lowered in {"on", "true", "1", "yes"}:
            return True
        if lowered in {"off", "false", "0", "no"}:
            return False
    return None


def _warmup_aggregate_bool_flags(flags: list[bool]) -> bool | None:
    if not flags:
        return None
    if all(value is True for value in flags):
        return True
    if all(value is False for value in flags):
        return False
    return None


def _warmup_enabled(benchmarks: list[dict[str, Any]]) -> bool | None:
    flags: list[bool] = []
    for item in benchmarks:
        options = item.get("options")
        if not isinstance(options, dict):
            continue
        parsed = _warmup_parse_option_value(options.get("warmup"))
        if parsed is not None:
            flags.append(parsed)
    return _warmup_aggregate_bool_flags(flags)


def _pytest_bm_resolve_key_group_label(index: int, item: dict[str, Any]) -> tuple[str, str, str]:
    label = _first_non_empty(item.get("fullname"), item.get("name")) or f"benchmark-{index + 1}"
    key_source = _first_non_empty(item.get("fullname"), item.get("name"), item.get("param"), label) or label
    key = _slug(key_source)
    group = _first_non_empty(item.get("group"))
    if not group:
        fullname = _first_non_empty(item.get("fullname"), item.get("name"), label) or label
        group = fullname.rsplit("::", 1)[0] if "::" in fullname else "benchmark"
    return key, group, label


def _pytest_bm_resolve_throughput(stats: dict[str, Any], *, label: str, issues: list[str]) -> float:
    throughput = _to_float(stats.get("ops"))
    if throughput > 0:
        return throughput
    rounds_for_ops = _to_float(stats.get("rounds"))
    total_for_ops = _to_float(stats.get("total"))
    if rounds_for_ops > 0 and total_for_ops > 0:
        issues.append(f"Derived ops from rounds/total for benchmark '{label}'")
        return rounds_for_ops / total_for_ops
    return 0.0


def _pytest_bm_samples_and_fallback(stats: dict[str, Any]) -> tuple[list[float], float]:
    data = stats.get("data")
    aggregate_samples: list[float] = []
    if isinstance(data, list):
        samples = [_to_float(sample) for sample in data]
        aggregate_samples = [sample for sample in samples if sample >= 0]

    fallback_second = 0.0
    for key_name in ("median", "mean", "max", "min"):
        metric_value = _to_float(stats.get(key_name))
        if metric_value > 0:
            fallback_second = metric_value
            break
    return aggregate_samples, fallback_second


def _pytest_bm_description_parts(
    item: dict[str, Any],
    stats: dict[str, Any],
    *,
    rounds: int,
    iterations: int,
) -> list[str]:
    median_ms = _seconds_to_ms(_to_float(stats.get("median")))
    mean_ms = _seconds_to_ms(_to_float(stats.get("mean")))
    description_parts: list[str] = []
    if rounds > 0:
        description_parts.append(f"rounds={rounds}")
    if iterations > 0:
        description_parts.append(f"iterations={iterations}")
    if median_ms > 0:
        description_parts.append(f"median={median_ms}ms")
    if mean_ms > 0:
        description_parts.append(f"mean={mean_ms}ms")
    param = item.get("param")
    if param is not None and str(param).strip():
        description_parts.append(f"param={param}")
    return description_parts


def _pytest_bm_transaction_from_item(
    index: int,
    item: dict[str, Any],
    issues: list[str],
) -> tuple[
    dict[str, Any] | None,
    list[float],
    float,
    int,
    int,
    float,
]:
    stats = item.get("stats")
    if not isinstance(stats, dict):
        return None, [], 0.0, 0, 0, 0.0

    key, group, label = _pytest_bm_resolve_key_group_label(index, item)
    throughput = _pytest_bm_resolve_throughput(stats, label=label, issues=issues)
    p95_ms = _p95_ms_from_stats(stats, label=label, issues=issues)
    aggregate_samples, fallback_second = _pytest_bm_samples_and_fallback(stats)

    rounds = int(round(_to_float(stats.get("rounds"))))
    iterations = int(round(_to_float(stats.get("iterations"))))
    total_seconds = _to_float(stats.get("total"))

    description_parts = _pytest_bm_description_parts(item, stats, rounds=rounds, iterations=iterations)

    tx = {
        "key": key,
        "group": group,
        "label": label,
        "throughput_rps": throughput,
        "p95_ms": p95_ms,
        "error_rate_pct": 0.0,
        "description": ", ".join(description_parts) if description_parts else None,
        "run_command": "pytest --benchmark-json benchmark.json",
    }
    return tx, aggregate_samples, fallback_second, rounds, iterations, total_seconds


def _cpu_model(machine_info: dict[str, Any]) -> str | None:
    cpu = machine_info.get("cpu")
    if isinstance(cpu, str):
        stripped = cpu.strip()
        return stripped or None
    if isinstance(cpu, dict):
        for key in ("brand_raw", "brand", "name", "model", "arch_string_raw"):
            value = cpu.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        if cpu:
            return json.dumps(cpu, ensure_ascii=True, sort_keys=True)
    return None


def _pytest_bm_collect_transactions(
    raw_benchmarks: list[Any],
    issues: list[str],
) -> tuple[
    list[dict[str, Any]],
    int,
    float,
    list[float],
    list[float],
    int,
    int,
]:
    transactions: list[dict[str, Any]] = []
    aggregate_samples_seconds: list[float] = []
    aggregate_fallback_seconds: list[float] = []
    rounds_total = 0
    iterations_total = 0
    total_duration_seconds = 0.0
    valid_items = 0
    for index, item in enumerate(raw_benchmarks):
        if not isinstance(item, dict):
            continue

        tx, aggregate_samples, fallback_second, rounds, iterations, total_seconds = _pytest_bm_transaction_from_item(
            index,
            item,
            issues,
        )
        if tx is None:
            continue

        valid_items += 1
        aggregate_samples_seconds.extend(aggregate_samples)
        if fallback_second > 0:
            aggregate_fallback_seconds.append(fallback_second)

        rounds_total += max(rounds, 0)
        iterations_total += max(iterations, 0)

        if total_seconds > 0:
            total_duration_seconds += total_seconds

        transactions.append(tx)
    return (
        transactions,
        valid_items,
        total_duration_seconds,
        aggregate_samples_seconds,
        aggregate_fallback_seconds,
        rounds_total,
        iterations_total,
    )


def _pytest_bm_summary_ms_from_aggregates(
    aggregate_samples_seconds: list[float],
    aggregate_fallback_seconds: list[float],
    issues: list[str],
) -> tuple[int, int, int]:
    if aggregate_samples_seconds:
        aggregate_samples_seconds.sort()
        return (
            _seconds_to_ms(_percentile(aggregate_samples_seconds, 0.50)),
            _seconds_to_ms(_percentile(aggregate_samples_seconds, 0.95)),
            _seconds_to_ms(_percentile(aggregate_samples_seconds, 0.99)),
        )
    if aggregate_fallback_seconds:
        aggregate_fallback_seconds.sort()
        issues.append(
            "Summary percentiles were approximated from per-benchmark aggregates because raw timing data is unavailable"
        )
        return (
            _seconds_to_ms(_percentile(aggregate_fallback_seconds, 0.50)),
            _seconds_to_ms(_percentile(aggregate_fallback_seconds, 0.95)),
            _seconds_to_ms(_percentile(aggregate_fallback_seconds, 0.99)),
        )
    issues.append("Could not derive summary percentiles from pytest-benchmark payload")
    return 0, 0, 0


def _pytest_bm_resolve_run_times(
    payload: dict[str, Any], total_duration_seconds: float
) -> tuple[datetime | None, datetime | None]:
    finished_at = _parse_dt(payload.get("finished_at")) or _parse_dt(payload.get("datetime"))
    started_at = _parse_dt(payload.get("started_at"))
    if started_at is None and finished_at is not None and total_duration_seconds > 0:
        started_at = finished_at - timedelta(seconds=total_duration_seconds)
    return started_at, finished_at


def _pytest_bm_optional_positive_count(n: int) -> int | None:
    return n if n > 0 else None


def _pytest_bm_dict_benchmarks(raw_benchmarks: list[Any]) -> list[dict[str, Any]]:
    return [item for item in raw_benchmarks if isinstance(item, dict)]


def _pytest_bm_build_environment_snapshot(
    machine_info: dict[str, Any],
    raw_benchmarks: list[Any],
    framework_version: str | None,
    rounds_total: int,
    iterations_total: int,
) -> dict[str, Any]:
    dict_benchmarks = _pytest_bm_dict_benchmarks(raw_benchmarks)
    return {
        "region": "unknown",
        "cluster": _first_non_empty(machine_info.get("node")) or "unknown",
        "namespace": "default",
        "instance_type": _first_non_empty(machine_info.get("machine")) or "unknown",
        "cpu_cores": 0,
        "memory_gb": 0,
        "python_version": _first_non_empty(machine_info.get("python_version")),
        "python_implementation": _first_non_empty(machine_info.get("python_implementation")),
        "os_system": _first_non_empty(machine_info.get("system")),
        "os_release": _first_non_empty(machine_info.get("release")),
        "architecture": _first_non_empty(machine_info.get("machine")),
        "cpu_model": _cpu_model(machine_info),
        "benchmark_framework_version": framework_version,
        "warmup_enabled": _warmup_enabled(dict_benchmarks),
        "rounds_total": _pytest_bm_optional_positive_count(rounds_total),
        "iterations_total": _pytest_bm_optional_positive_count(iterations_total),
    }


def _pytest_bm_core_identity_fields(
    payload: dict[str, Any],
    commit_info: dict[str, Any],
    machine_info: dict[str, Any],
    valid_items: int,
    framework_version: str | None,
) -> tuple[str, str, str, str, str, str, str, str]:
    return (
        _first_non_empty(payload.get("service"), commit_info.get("project")) or "python-benchmarks",
        _first_non_empty(payload.get("env"), machine_info.get("system")) or "benchmark",
        _first_non_empty(payload.get("scenario")) or f"pytest benchmark ({valid_items} cases)",
        _first_non_empty(payload.get("load_profile")) or "benchmark-default",
        _first_non_empty(commit_info.get("branch"), payload.get("branch")) or "unknown",
        _first_non_empty(commit_info.get("id"), payload.get("commit")) or "unknown",
        _first_non_empty(payload.get("build"), commit_info.get("time")) or "benchmark-run",
        framework_version or "unknown",
    )


def _pytest_bm_finalize_pytest_payload(
    payload: dict[str, Any],
    raw_benchmarks: list[Any],
    *,
    transactions: list[dict[str, Any]],
    summary: dict[str, Any],
    issues: list[str],
    valid_items: int,
    total_duration_seconds: float,
    rounds_total: int,
    iterations_total: int,
) -> ParsedPerformancePayload:
    machine_info = payload.get("machine_info") if isinstance(payload.get("machine_info"), dict) else {}
    commit_info = payload.get("commit_info") if isinstance(payload.get("commit_info"), dict) else {}
    started_at, finished_at = _pytest_bm_resolve_run_times(payload, total_duration_seconds)
    framework_version = _first_non_empty(payload.get("version"))
    env_snapshot = _pytest_bm_build_environment_snapshot(
        machine_info, raw_benchmarks, framework_version, rounds_total, iterations_total
    )
    service, env, scenario, load_profile, branch, commit, build, version = _pytest_bm_core_identity_fields(
        payload, commit_info, machine_info, valid_items, framework_version
    )

    return ParsedPerformancePayload(
        adapter=ADAPTER_NAME,
        adapter_version=ADAPTER_VERSION,
        confidence=0.95,
        found=["summary", "transactions"],
        missing=["errors"],
        parse_status="partial",
        issues=issues,
        load_kind="benchmark",
        tool="pytest-benchmark",
        service=service,
        env=env,
        scenario=scenario,
        load_profile=load_profile,
        branch=branch,
        commit=commit,
        build=build,
        version=version,
        started_at=started_at,
        finished_at=finished_at,
        summary=summary,
        transactions=transactions,
        errors=[],
        environment_snapshot=env_snapshot,
    )


def _pytest_bm_load_payload(content: bytes, filename: str) -> tuple[dict[str, Any], list[Any]]:
    try:
        payload = json.loads(content.decode("utf-8"))
    except Exception as exc:  # pragma: no cover - defensive
        raise DomainError(
            status_code=422,
            code="performance_invalid_pytest_benchmark_json",
            title=TITLE_VALIDATION_ERROR,
            detail=f"Failed to parse pytest-benchmark JSON: {exc}",
            errors={"file": [f"invalid json in {filename}"]},
        ) from exc

    if not isinstance(payload, dict):
        raise DomainError(
            status_code=422,
            code="performance_invalid_pytest_benchmark_json",
            title=TITLE_VALIDATION_ERROR,
            detail="pytest-benchmark JSON payload must be an object",
            errors={"file": ["invalid pytest-benchmark json shape"]},
        )

    raw_benchmarks = payload.get("benchmarks")
    if not isinstance(raw_benchmarks, list):
        raise DomainError(
            status_code=422,
            code="performance_invalid_pytest_benchmark_json",
            title=TITLE_VALIDATION_ERROR,
            detail="pytest-benchmark JSON must contain a benchmarks array",
            errors={"file": ["missing benchmarks array"]},
        )
    return payload, raw_benchmarks


def parse_pytest_benchmark_json(content: bytes, filename: str) -> ParsedPerformancePayload:
    payload, raw_benchmarks = _pytest_bm_load_payload(content, filename)

    issues: list[str] = []

    (
        transactions,
        valid_items,
        total_duration_seconds,
        aggregate_samples_seconds,
        aggregate_fallback_seconds,
        rounds_total,
        iterations_total,
    ) = _pytest_bm_collect_transactions(raw_benchmarks, issues)

    if valid_items == 0:
        raise DomainError(
            status_code=422,
            code="performance_invalid_pytest_benchmark_json",
            title=TITLE_VALIDATION_ERROR,
            detail="pytest-benchmark JSON does not contain benchmark stats entries",
            errors={"file": ["no benchmark stats found"]},
        )

    p50_ms, p95_ms, p99_ms = _pytest_bm_summary_ms_from_aggregates(
        aggregate_samples_seconds,
        aggregate_fallback_seconds,
        issues,
    )

    throughput_total = sum(float(tx.get("throughput_rps") or 0.0) for tx in transactions)
    summary = {
        "throughput_rps": throughput_total,
        "error_rate_pct": 0.0,
        "p50_ms": p50_ms,
        "p95_ms": p95_ms,
        "p99_ms": p99_ms,
        "peak_vus": 1,
        "checks_passed": valid_items,
        "checks_total": valid_items,
        "duration_minutes": int(round(total_duration_seconds / 60.0)) if total_duration_seconds > 0 else 0,
    }

    return _pytest_bm_finalize_pytest_payload(
        payload,
        raw_benchmarks,
        transactions=transactions,
        summary=summary,
        issues=issues,
        valid_items=valid_items,
        total_duration_seconds=total_duration_seconds,
        rounds_total=rounds_total,
        iterations_total=iterations_total,
    )
