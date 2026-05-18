from __future__ import annotations

import csv
import json
from io import StringIO
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.modules.performance.models import PerformanceRun

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.modules.performance.adapters.types import ParsedPerformancePayload
from app.modules.performance.models import (
    PerformanceImport,
    PerformanceRunArtifact,
    PerformanceRunError,
    PerformanceRunTransaction,
)
from app.modules.performance.repositories import runs as perf_repo
from app.modules.performance.services.baseline import _resolve_effective_baseline_run
from app.modules.performance.services.runtime import (
    _default_environment_snapshot,
    _default_summary,
    _duration_minutes,
    _new_id,
    _normalize_dt,
    _now_utc,
    _parse_dt,
)
from app.modules.performance.services.comparisons import _build_comparison_and_verdict
from app.modules.performance.storage import PerformanceArtifactStorage

_ARTIFACT_LABEL_SUMMARY_JSON = "summary.json"
_ARTIFACT_LABEL_ERRORS_CSV = "errors.csv"


def _merge_summary_and_timing_from_parsed(
    run: PerformanceRun,
    parsed: ParsedPerformancePayload,
) -> dict:
    merged_summary = _default_summary()
    merged_summary.update({
        "throughput_rps": float(parsed.summary.get("throughput_rps") or 0.0),
        "error_rate_pct": float(parsed.summary.get("error_rate_pct") or 0.0),
        "p50_ms": int(parsed.summary.get("p50_ms") or 0),
        "p95_ms": int(parsed.summary.get("p95_ms") or 0),
        "p99_ms": int(parsed.summary.get("p99_ms") or 0),
        "peak_vus": int(parsed.summary.get("peak_vus") or 0),
        "checks_passed": int(parsed.summary.get("checks_passed") or 0),
        "checks_total": int(parsed.summary.get("checks_total") or 0),
    })
    run.summary = merged_summary

    duration_minutes = int(parsed.summary.get("duration_minutes") or 0)
    if duration_minutes <= 0 and run.finished_at and run.started_at:
        duration_minutes = _duration_minutes(run.started_at, run.finished_at)
    run.duration_minutes = max(duration_minutes, 0)
    return merged_summary


def _transaction_from_parsed_row(index: int, tx: dict) -> PerformanceRunTransaction:
    return PerformanceRunTransaction(
        id=_new_id("ptx"),
        position=index,
        key=str(tx.get("key") or f"tx_{index + 1}"),
        tx_group=str(tx.get("group") or "General"),
        label=str(tx.get("label") or f"Transaction {index + 1}"),
        throughput_rps=float(tx.get("throughput_rps") or 0.0),
        p95_ms=int(tx.get("p95_ms") or 0),
        error_rate_pct=float(tx.get("error_rate_pct") or 0.0),
        delta_p95_pct=float(tx.get("delta_p95_pct") or 0.0),
        delta_error_rate_pct=float(tx.get("delta_error_rate_pct") or 0.0),
        description=str(tx.get("description")) if tx.get("description") is not None else None,
        run_command=str(tx.get("run_command")) if tx.get("run_command") is not None else None,
        generators=list(tx.get("generators") or []),
        system_load=list(tx.get("system_load") or []),
        logs=list(tx.get("logs") or []),
        artifacts=list(tx.get("artifacts") or []),
    )


def _replace_transactions_from_parsed(run: PerformanceRun, parsed: ParsedPerformancePayload) -> None:
    run.transactions.clear()
    for index, tx in enumerate(parsed.transactions):
        run.transactions.append(_transaction_from_parsed_row(index, tx))


def _replace_errors_from_parsed(run: PerformanceRun, parsed: ParsedPerformancePayload) -> None:
    run.errors.clear()
    for index, item in enumerate(parsed.errors):
        run.errors.append(
            PerformanceRunError(
                id=_new_id("perr"),
                key=str(item.get("key") or f"error_{index + 1}"),
                error_type=str(item.get("type") or "Error"),
                count=int(item.get("count") or 0),
                rate_pct=float(item.get("rate_pct") or 0.0),
                last_seen_at=_parse_dt(item.get("last_seen_at")),
                hint=str(item.get("hint") or ""),
            )
        )


def _apply_run_fields_from_parsed(run: PerformanceRun, parsed: ParsedPerformancePayload, now) -> None:
    run.service = parsed.service
    run.env = parsed.env
    run.scenario = parsed.scenario
    run.load_profile = parsed.load_profile
    run.branch = parsed.branch
    run.commit = parsed.commit
    run.build = parsed.build
    run.version = parsed.version
    run.tool = parsed.tool
    run.load_kind = parsed.load_kind if parsed.load_kind in {"http", "cpu", "ram", "disk_io", "benchmark"} else "http"
    run.started_at = _normalize_dt(parsed.started_at) or run.started_at
    run.finished_at = _normalize_dt(parsed.finished_at) or now


def _apply_baseline_fields_to_run(run: PerformanceRun, baseline_run) -> None:
    if baseline_run is None:
        run.baseline_ref = None
        run.baseline_policy = "manual"
        run.baseline_label = "Manual baseline"
        return
    if baseline_run.baseline_policy == "tagged" and baseline_run.baseline_ref == baseline_run.id:
        run.baseline_ref = baseline_run.id
        run.baseline_policy = "tagged"
        run.baseline_label = "Tagged baseline"
        return
    run.baseline_ref = baseline_run.id
    run.baseline_policy = "latest_green"
    run.baseline_label = "Latest green"


def _finalize_import_item(import_item: PerformanceImport, parsed: ParsedPerformancePayload, now) -> None:
    import_item.status = "completed" if parsed.parse_status == "parsed" else "partial"
    import_item.parse_status = parsed.parse_status
    import_item.adapter = parsed.adapter
    import_item.adapter_version = parsed.adapter_version
    import_item.confidence = parsed.confidence
    import_item.found = parsed.found
    import_item.missing = parsed.missing
    import_item.issues = parsed.issues
    import_item.error_detail = None
    import_item.finished_processing_at = now


def _delete_generated_perf_artifacts(db: AsyncSession, run: PerformanceRun, storage: PerformanceArtifactStorage) -> None:
    for artifact in list(run.artifacts):
        if artifact.label not in {_ARTIFACT_LABEL_SUMMARY_JSON, _ARTIFACT_LABEL_ERRORS_CSV}:
            continue
        if artifact.storage_key:
            storage.delete(storage_key=artifact.storage_key)
        db.delete(artifact)


def _append_summary_json_artifact(
    run: PerformanceRun,
    merged_summary: dict,
    metrics_comparison,
    regressions,
    storage: PerformanceArtifactStorage,
    now,
) -> None:
    summary_blob = {
        "run_id": run.id,
        "summary": merged_summary,
        "metrics_comparison": metrics_comparison,
        "regressions": regressions,
        "transactions": [
            {
                "key": tx.key,
                "group": tx.tx_group,
                "label": tx.label,
                "throughput_rps": tx.throughput_rps,
                "p95_ms": tx.p95_ms,
                "error_rate_pct": tx.error_rate_pct,
            }
            for tx in run.transactions
        ],
        "errors": [
            {
                "key": err.key,
                "type": err.error_type,
                "count": err.count,
                "rate_pct": err.rate_pct,
                "hint": err.hint,
            }
            for err in run.errors
        ],
    }
    summary_stored = storage.save_bytes(
        json.dumps(summary_blob, ensure_ascii=True, sort_keys=True).encode("utf-8"),
        filename=_ARTIFACT_LABEL_SUMMARY_JSON,
        content_type="application/json",
        entity_type="performance-runs",
        entity_id=run.id,
    )
    run.artifacts.append(
        PerformanceRunArtifact(
            id=_new_id("parf"),
            label=_ARTIFACT_LABEL_SUMMARY_JSON,
            artifact_type="json",
            size_bytes=summary_stored.size,
            status="ready",
            storage_backend=summary_stored.storage_backend,
            storage_key=summary_stored.storage_key,
            content_type=summary_stored.content_type,
            filename=summary_stored.filename,
            created_at=now,
        )
    )


def _append_errors_csv_artifact(run: PerformanceRun, storage: PerformanceArtifactStorage, now) -> None:
    if run.errors:
        csv_buffer = StringIO()
        writer = csv.DictWriter(csv_buffer, fieldnames=["key", "type", "count", "rate_pct", "hint"])
        writer.writeheader()
        for err in run.errors:
            writer.writerow(
                {
                    "key": err.key,
                    "type": err.error_type,
                    "count": err.count,
                    "rate_pct": f"{err.rate_pct:.4f}",
                    "hint": err.hint,
                }
            )
        errors_stored = storage.save_bytes(
            csv_buffer.getvalue().encode("utf-8"),
            filename=_ARTIFACT_LABEL_ERRORS_CSV,
            content_type="text/csv",
            entity_type="performance-runs",
            entity_id=run.id,
        )
        run.artifacts.append(
            PerformanceRunArtifact(
                id=_new_id("parf"),
                label=_ARTIFACT_LABEL_ERRORS_CSV,
                artifact_type="csv",
                size_bytes=errors_stored.size,
                status="ready",
                storage_backend=errors_stored.storage_backend,
                storage_key=errors_stored.storage_key,
                content_type=errors_stored.content_type,
                filename=errors_stored.filename,
                created_at=now,
            )
        )
        return
    run.artifacts.append(
        PerformanceRunArtifact(
            id=_new_id("parf"),
            label=_ARTIFACT_LABEL_ERRORS_CSV,
            artifact_type="csv",
            size_bytes=None,
            status="missing",
            storage_backend=None,
            storage_key=None,
            content_type="text/csv",
            filename=_ARTIFACT_LABEL_ERRORS_CSV,
            created_at=now,
        )
    )


async def apply_import_payload(
    db: AsyncSession,
    *,
    import_item: PerformanceImport,
    parsed: ParsedPerformancePayload,
    storage: PerformanceArtifactStorage,
) -> None:
    run = await perf_repo.get_run_by_id_with_details(db, import_item.run_id)
    if run is None:
        raise not_found("performance_run")

    now = _now_utc()
    _apply_run_fields_from_parsed(run, parsed, now)

    merged_summary = _merge_summary_and_timing_from_parsed(run, parsed)

    snapshot = _default_environment_snapshot()
    snapshot.update(parsed.environment_snapshot)
    run.environment_snapshot = snapshot

    _replace_transactions_from_parsed(run, parsed)
    _replace_errors_from_parsed(run, parsed)

    baseline_run = await _resolve_effective_baseline_run(db, run)
    baseline_summary = baseline_run.summary if baseline_run is not None and isinstance(baseline_run.summary, dict) else None
    verdict, metrics_comparison, regressions = _build_comparison_and_verdict(
        current=merged_summary,
        baseline=baseline_summary,
    )

    run.verdict = verdict
    run.metrics_comparison = metrics_comparison
    run.regressions = regressions
    run.status = "completed" if parsed.parse_status != "failed" else "incomplete"

    _apply_baseline_fields_to_run(run, baseline_run)
    _finalize_import_item(import_item, parsed, now)

    _delete_generated_perf_artifacts(db, run, storage)
    _append_summary_json_artifact(run, merged_summary, metrics_comparison, regressions, storage, now)
    _append_errors_csv_artifact(run, storage, now)
