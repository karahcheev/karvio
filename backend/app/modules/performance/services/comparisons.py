from __future__ import annotations

from typing import Any

from app.modules.performance.services.baseline import _baseline_tx_metrics_by_key, _perf_baseline_read_for_run
from app.modules.performance.models import PerformanceImport, PerformanceRun, PerformanceRunTransaction
from app.modules.performance.services.runtime import _default_environment_snapshot, _default_summary, _format_size
from app.modules.performance.schemas.runs import (
    PerfArtifactRead,
    PerfBaselineRead,
    PerfEnvironmentSnapshotRead,
    PerfErrorBucketRead,
    PerfImportRecordRead,
    PerfMetricComparisonRead,
    PerfRegressionItemRead,
    PerfSummaryRead,
    PerfSystemLoadSampleRead,
    PerfTransactionArtifactRead,
    PerfTransactionGeneratorResultRead,
    PerfTransactionRead,
    PerformanceRunRead,
)

VERDICT_WARN_P95_DELTA_PCT = 10.0
VERDICT_WARN_ERROR_RATE_PP = 0.3
VERDICT_WARN_THROUGHPUT_DROP_PCT = 5.0
VERDICT_RED_P95_DELTA_PCT = 20.0
VERDICT_RED_ERROR_RATE_PP = 1.0
VERDICT_RED_THROUGHPUT_DROP_PCT = 10.0


def _impact(delta: float | None, *, lower_is_better: bool) -> str:
    if delta is None or abs(delta) < 0.01:
        return "neutral"
    if lower_is_better:
        return "improved" if delta < 0 else "regressed"
    return "improved" if delta > 0 else "regressed"


def _pct_delta(current: float, baseline: float) -> float | None:
    if baseline == 0:
        return None
    return ((current - baseline) / baseline) * 100.0


def _comparison_rows_without_baseline(current: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "label": "Throughput",
            "current": f"{int(round(float(current.get('throughput_rps', 0.0))))} rps",
            "baseline": "n/a",
            "delta": "n/a",
            "impact": "neutral",
        },
        {
            "label": "Error rate",
            "current": f"{float(current.get('error_rate_pct', 0.0)):.2f}%",
            "baseline": "n/a",
            "delta": "n/a",
            "impact": "neutral",
        },
        {
            "label": "P95",
            "current": f"{int(round(float(current.get('p95_ms', 0.0))))} ms",
            "baseline": "n/a",
            "delta": "n/a",
            "impact": "neutral",
        },
        {
            "label": "P99",
            "current": f"{int(round(float(current.get('p99_ms', 0.0))))} ms",
            "baseline": "n/a",
            "delta": "n/a",
            "impact": "neutral",
        },
        {
            "label": "Checks pass",
            "current": f"{int(current.get('checks_passed', 0))} / {int(current.get('checks_total', 0))}",
            "baseline": "n/a",
            "delta": "n/a",
            "impact": "neutral",
        },
    ]


def _collect_overall_regressions(
    *,
    p95_delta: float | None,
    error_delta_pp: float,
    throughput_delta: float | None,
) -> list[dict[str, Any]]:
    regressions: list[dict[str, Any]] = []
    if p95_delta is not None and p95_delta > VERDICT_WARN_P95_DELTA_PCT:
        regressions.append(
            {
                "title": "P95 latency increased versus baseline",
                "scope": "overall",
                "delta": f"+{p95_delta:.1f}%",
            }
        )
    if error_delta_pp > VERDICT_WARN_ERROR_RATE_PP:
        regressions.append(
            {
                "title": "Error rate increased versus baseline",
                "scope": "overall",
                "delta": f"+{error_delta_pp:.2f}pp",
            }
        )
    if throughput_delta is not None and throughput_delta < -VERDICT_WARN_THROUGHPUT_DROP_PCT:
        regressions.append(
            {
                "title": "Throughput dropped versus baseline",
                "scope": "overall",
                "delta": f"{throughput_delta:.1f}%",
            }
        )
    return regressions


def _verdict_from_deltas_and_regressions(
    *,
    p95_delta: float | None,
    error_delta_pp: float,
    throughput_delta: float | None,
    regressions: list[dict[str, Any]],
) -> str:
    is_red = (
        (p95_delta is not None and p95_delta > VERDICT_RED_P95_DELTA_PCT)
        or error_delta_pp > VERDICT_RED_ERROR_RATE_PP
        or (throughput_delta is not None and throughput_delta < -VERDICT_RED_THROUGHPUT_DROP_PCT)
    )
    if is_red:
        return "red"
    if regressions:
        return "yellow"
    return "green"


def _build_comparison_and_verdict(
    *,
    current: dict[str, Any],
    baseline: dict[str, Any] | None,
) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]]]:
    if baseline is None:
        return "yellow", _comparison_rows_without_baseline(current), []

    c_throughput = float(current.get("throughput_rps", 0.0))
    b_throughput = float(baseline.get("throughput_rps", 0.0))
    c_error = float(current.get("error_rate_pct", 0.0))
    b_error = float(baseline.get("error_rate_pct", 0.0))
    c_p95 = float(current.get("p95_ms", 0.0))
    b_p95 = float(baseline.get("p95_ms", 0.0))
    c_p99 = float(current.get("p99_ms", 0.0))
    b_p99 = float(baseline.get("p99_ms", 0.0))

    c_checks_total = int(current.get("checks_total", 0))
    b_checks_total = int(baseline.get("checks_total", 0))
    c_checks_ratio = (int(current.get("checks_passed", 0)) / c_checks_total * 100.0) if c_checks_total else 0.0
    b_checks_ratio = (int(baseline.get("checks_passed", 0)) / b_checks_total * 100.0) if b_checks_total else 0.0

    throughput_delta = _pct_delta(c_throughput, b_throughput)
    p95_delta = _pct_delta(c_p95, b_p95)
    p99_delta = _pct_delta(c_p99, b_p99)
    checks_delta = _pct_delta(c_checks_ratio, b_checks_ratio)
    error_delta_pp = c_error - b_error

    comparisons = [
        {
            "label": "Throughput",
            "current": f"{int(round(c_throughput))} rps",
            "baseline": f"{int(round(b_throughput))} rps",
            "delta": "n/a" if throughput_delta is None else f"{throughput_delta:+.1f}%",
            "impact": _impact(throughput_delta, lower_is_better=False),
        },
        {
            "label": "Error rate",
            "current": f"{c_error:.2f}%",
            "baseline": f"{b_error:.2f}%",
            "delta": f"{error_delta_pp:+.2f} pp",
            "impact": _impact(error_delta_pp, lower_is_better=True),
        },
        {
            "label": "P95",
            "current": f"{int(round(c_p95))} ms",
            "baseline": f"{int(round(b_p95))} ms",
            "delta": "n/a" if p95_delta is None else f"{p95_delta:+.1f}%",
            "impact": _impact(p95_delta, lower_is_better=True),
        },
        {
            "label": "P99",
            "current": f"{int(round(c_p99))} ms",
            "baseline": f"{int(round(b_p99))} ms",
            "delta": "n/a" if p99_delta is None else f"{p99_delta:+.1f}%",
            "impact": _impact(p99_delta, lower_is_better=True),
        },
        {
            "label": "Checks pass",
            "current": f"{int(current.get('checks_passed', 0))} / {c_checks_total}",
            "baseline": f"{int(baseline.get('checks_passed', 0))} / {b_checks_total}",
            "delta": "n/a" if checks_delta is None else f"{checks_delta:+.1f}%",
            "impact": _impact(checks_delta, lower_is_better=False),
        },
    ]

    regressions = _collect_overall_regressions(
        p95_delta=p95_delta,
        error_delta_pp=error_delta_pp,
        throughput_delta=throughput_delta,
    )
    verdict = _verdict_from_deltas_and_regressions(
        p95_delta=p95_delta,
        error_delta_pp=error_delta_pp,
        throughput_delta=throughput_delta,
        regressions=regressions,
    )

    return verdict, comparisons, regressions


def _resolve_live_baseline_context_for_run_read(
    run: PerformanceRun,
    summary: dict[str, Any],
    resolved_baseline: PerformanceRun | None,
) -> tuple[PerfBaselineRead, str, list, list, dict[str, tuple[float, float, float]]]:
    is_self_tagged_baseline = run.baseline_policy == "tagged" and run.baseline_ref == run.id
    if is_self_tagged_baseline:
        baseline_read = PerfBaselineRead(ref=run.baseline_ref, policy="tagged", label=run.baseline_label)
        verdict = run.verdict
        metrics_comparison = run.metrics_comparison if isinstance(run.metrics_comparison, list) else []
        regressions = run.regressions if isinstance(run.regressions, list) else []
        return baseline_read, verdict, metrics_comparison, regressions, {}
    if resolved_baseline is None:
        baseline_read = PerfBaselineRead(ref=None, policy="manual", label="Manual baseline")
        verdict, metrics_comparison, regressions = _build_comparison_and_verdict(current=summary, baseline=None)
        return baseline_read, verdict, metrics_comparison, regressions, {}
    baseline_read = _perf_baseline_read_for_run(resolved_baseline)
    baseline_summary = resolved_baseline.summary if isinstance(resolved_baseline.summary, dict) else None
    verdict, metrics_comparison, regressions = _build_comparison_and_verdict(
        current=summary,
        baseline=baseline_summary,
    )
    baseline_tx_by_key = _baseline_tx_metrics_by_key(resolved_baseline)
    return baseline_read, verdict, metrics_comparison, regressions, baseline_tx_by_key


def _resolve_stored_baseline_context_for_run_read(
    run: PerformanceRun,
) -> tuple[PerfBaselineRead, str, list, list, dict[str, tuple[float, float, float]]]:
    baseline_read = PerfBaselineRead(ref=run.baseline_ref, policy=run.baseline_policy, label=run.baseline_label)
    verdict = run.verdict
    metrics_comparison = run.metrics_comparison if isinstance(run.metrics_comparison, list) else []
    regressions = run.regressions if isinstance(run.regressions, list) else []
    return baseline_read, verdict, metrics_comparison, regressions, {}


def _resolve_baseline_context_for_run_read(
    run: PerformanceRun,
    summary: dict[str, Any],
    *,
    resolve_live_baseline: bool,
    resolved_baseline: PerformanceRun | None,
) -> tuple[PerfBaselineRead, str, list, list, dict[str, tuple[float, float, float]]]:
    if resolve_live_baseline:
        return _resolve_live_baseline_context_for_run_read(run, summary, resolved_baseline)
    return _resolve_stored_baseline_context_for_run_read(run)


def _perf_transaction_delta_fields(
    tx: PerformanceRunTransaction,
    *,
    resolve_live_baseline: bool,
    baseline_tx_by_key: dict[str, tuple[float, float, float]],
) -> tuple[float | None, float | None, float | None]:
    if resolve_live_baseline:
        b_row = baseline_tx_by_key.get(tx.key)
        if b_row is None:
            return None, None, None
        b_p95, b_tp, b_err = b_row
        return (
            _pct_delta(float(tx.p95_ms), float(b_p95)),
            _pct_delta(float(tx.throughput_rps), float(b_tp)),
            float(tx.error_rate_pct) - float(b_err),
        )
    return tx.delta_p95_pct, None, None


def _perf_transaction_read_model(
    tx: PerformanceRunTransaction,
    *,
    delta_p95: float | None,
    delta_throughput: float | None,
    delta_err_pp: float | None,
) -> PerfTransactionRead:
    return PerfTransactionRead(
        key=tx.key,
        group=tx.tx_group,
        label=tx.label,
        throughput_rps=tx.throughput_rps,
        p95_ms=tx.p95_ms,
        error_rate_pct=tx.error_rate_pct,
        delta_p95_pct=delta_p95,
        delta_throughput_pct=delta_throughput,
        delta_error_rate_pp=delta_err_pp,
        delta_error_rate_pct=tx.delta_error_rate_pct,
        description=tx.description,
        run_command=tx.run_command,
        generators=[
            PerfTransactionGeneratorResultRead.model_validate(item)
            for item in (tx.generators if isinstance(tx.generators, list) else [])
        ],
        system_load=[
            PerfSystemLoadSampleRead.model_validate(item)
            for item in (tx.system_load if isinstance(tx.system_load, list) else [])
        ],
        logs=[str(item) for item in (tx.logs if isinstance(tx.logs, list) else [])],
        artifacts=[
            PerfTransactionArtifactRead.model_validate(item)
            for item in (tx.artifacts if isinstance(tx.artifacts, list) else [])
        ],
    )


def _perf_transaction_reads(
    run: PerformanceRun,
    *,
    resolve_live_baseline: bool,
    baseline_tx_by_key: dict[str, tuple[float, float, float]],
) -> list[PerfTransactionRead]:
    transactions: list[PerfTransactionRead] = []
    for tx in run.transactions:
        delta_p95, delta_throughput, delta_err_pp = _perf_transaction_delta_fields(
            tx,
            resolve_live_baseline=resolve_live_baseline,
            baseline_tx_by_key=baseline_tx_by_key,
        )
        transactions.append(
            _perf_transaction_read_model(
                tx,
                delta_p95=delta_p95,
                delta_throughput=delta_throughput,
                delta_err_pp=delta_err_pp,
            )
        )
    return transactions


def _perf_error_bucket_reads(run: PerformanceRun) -> list[PerfErrorBucketRead]:
    errors: list[PerfErrorBucketRead] = []
    for error in run.errors:
        errors.append(
            PerfErrorBucketRead(
                key=error.key,
                type=error.error_type,
                count=error.count,
                rate_pct=error.rate_pct,
                last_seen_at=(error.last_seen_at or run.finished_at or run.created_at).isoformat(),
                hint=error.hint,
            )
        )
    return errors


def _perf_artifact_reads(run: PerformanceRun) -> list[PerfArtifactRead]:
    artifacts: list[PerfArtifactRead] = []
    for artifact in run.artifacts:
        artifacts.append(
            PerfArtifactRead(
                id=artifact.id,
                label=artifact.label,
                type=artifact.artifact_type,
                size=_format_size(artifact.size_bytes),
                status="ready" if artifact.status == "ready" else "missing",
                created_at=artifact.created_at.isoformat(),
            )
        )
    return artifacts


def _perf_import_record_read(latest_import: PerformanceImport | None) -> PerfImportRecordRead | None:
    if latest_import is None or not latest_import.adapter or not latest_import.adapter_version:
        return None
    return PerfImportRecordRead(
        id=latest_import.id,
        source=f"upload://{latest_import.source_filename}",
        adapter=latest_import.adapter,
        adapter_version=latest_import.adapter_version,
        confidence=float(latest_import.confidence or 0.0),
        found=[str(v) for v in latest_import.found],
        missing=[str(v) for v in latest_import.missing],
        parse_status=latest_import.parse_status,
        issues=[str(v) for v in latest_import.issues],
    )


def _to_run_read(
    run: PerformanceRun,
    latest_import: PerformanceImport | None = None,
    *,
    resolve_live_baseline: bool = False,
    resolved_baseline: PerformanceRun | None = None,
) -> PerformanceRunRead:
    summary = run.summary if isinstance(run.summary, dict) else _default_summary()
    raw_env = run.environment_snapshot
    if isinstance(raw_env, dict):
        env_snapshot = {**_default_environment_snapshot(), **raw_env}
    else:
        env_snapshot = _default_environment_snapshot()

    baseline_read, verdict, metrics_comparison, regressions, baseline_tx_by_key = _resolve_baseline_context_for_run_read(
        run,
        summary,
        resolve_live_baseline=resolve_live_baseline,
        resolved_baseline=resolved_baseline,
    )

    transactions = _perf_transaction_reads(
        run,
        resolve_live_baseline=resolve_live_baseline,
        baseline_tx_by_key=baseline_tx_by_key,
    )
    errors = _perf_error_bucket_reads(run)
    artifacts = _perf_artifact_reads(run)
    import_record = _perf_import_record_read(latest_import)

    return PerformanceRunRead(
        id=run.id,
        project_id=run.project_id,
        name=run.name,
        service=run.service,
        env=run.env,
        scenario=run.scenario,
        load_profile=run.load_profile,
        branch=run.branch,
        commit=run.commit,
        build=run.build,
        version=run.version,
        tool=run.tool,
        status=run.status,
        verdict=verdict,
        load_kind=run.load_kind,
        started_at=run.started_at,
        finished_at=run.finished_at,
        duration_minutes=run.duration_minutes,
        summary=PerfSummaryRead.model_validate(summary),
        baseline=baseline_read,
        regressions=[PerfRegressionItemRead.model_validate(item) for item in regressions],
        metrics_comparison=[PerfMetricComparisonRead.model_validate(item) for item in metrics_comparison],
        transactions=transactions,
        errors=errors,
        artifacts=artifacts,
        import_record=import_record,
        environment_snapshot=PerfEnvironmentSnapshotRead.model_validate(env_snapshot),
        acknowledged=run.acknowledged,
        archived=run.archived,
        created_by=run.created_by,
        created_at=run.created_at,
        updated_at=run.updated_at,
    )


def _to_run_list_item_read(run: PerformanceRun) -> PerformanceRunRead:
    """Lightweight list representation: only scalar/json fields from PerformanceRun."""
    summary = run.summary if isinstance(run.summary, dict) else _default_summary()
    raw_env = run.environment_snapshot
    if isinstance(raw_env, dict):
        env_snapshot = {**_default_environment_snapshot(), **raw_env}
    else:
        env_snapshot = _default_environment_snapshot()

    baseline_read, verdict, metrics_comparison, regressions, _ = _resolve_stored_baseline_context_for_run_read(run)

    return PerformanceRunRead(
        id=run.id,
        project_id=run.project_id,
        name=run.name,
        service=run.service,
        env=run.env,
        scenario=run.scenario,
        load_profile=run.load_profile,
        branch=run.branch,
        commit=run.commit,
        build=run.build,
        version=run.version,
        tool=run.tool,
        status=run.status,
        verdict=verdict,
        load_kind=run.load_kind,
        started_at=run.started_at,
        finished_at=run.finished_at,
        duration_minutes=run.duration_minutes,
        summary=PerfSummaryRead.model_validate(summary),
        baseline=baseline_read,
        regressions=[PerfRegressionItemRead.model_validate(item) for item in regressions],
        metrics_comparison=[PerfMetricComparisonRead.model_validate(item) for item in metrics_comparison],
        transactions=[],
        errors=[],
        artifacts=[],
        import_record=None,
        environment_snapshot=PerfEnvironmentSnapshotRead.model_validate(env_snapshot),
        acknowledged=run.acknowledged,
        archived=run.archived,
        created_by=run.created_by,
        created_at=run.created_at,
        updated_at=run.updated_at,
    )
