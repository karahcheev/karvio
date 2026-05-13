from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.models.common import generate_id


def _new_id(prefix: str) -> str:
    return f"{prefix}_{generate_id()[:8]}"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_dt(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _duration_minutes(started_at: datetime | None, finished_at: datetime | None) -> int:
    started = _normalize_dt(started_at)
    finished = _normalize_dt(finished_at)
    if started is None or finished is None:
        return 0
    return max(int(round((finished - started).total_seconds() / 60.0)), 0)


def _format_size(size_bytes: int | None) -> str:
    if size_bytes is None:
        return "-"
    units = [(1024 * 1024 * 1024, "GB"), (1024 * 1024, "MB"), (1024, "KB")]
    for factor, unit in units:
        if size_bytes >= factor:
            return f"{size_bytes / factor:.1f} {unit}"
    return f"{size_bytes} B"


def _artifact_type_from_filename(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext == ".zip":
        return "zip"
    if ext == ".json":
        return "json"
    if ext == ".csv":
        return "csv"
    if ext in {".html", ".htm"}:
        return "html"
    return "txt"


def _default_summary() -> dict[str, Any]:
    return {
        "throughput_rps": 0.0,
        "error_rate_pct": 0.0,
        "p50_ms": 0,
        "p95_ms": 0,
        "p99_ms": 0,
        "peak_vus": 0,
        "checks_passed": 0,
        "checks_total": 0,
    }


def _default_environment_snapshot() -> dict[str, Any]:
    return {
        "region": "unknown",
        "cluster": "unknown",
        "namespace": "default",
        "instance_type": "unknown",
        "cpu_cores": 0,
        "memory_gb": 0,
    }
