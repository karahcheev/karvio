from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.performance.repositories import runs as perf_repo
from app.modules.performance.models import PerformanceRun
from app.modules.performance.schemas.runs import PerfBaselineRead


async def _resolve_effective_baseline_run(db: AsyncSession, run: PerformanceRun) -> PerformanceRun | None:
    """Baseline for comparisons: tagged run for same project + load_kind, else latest green (same kind)."""
    baseline = await perf_repo.find_tagged_baseline_marker(
        db,
        project_id=run.project_id,
        load_kind=run.load_kind,
        exclude_run_id=run.id,
    )
    if baseline is None:
        baseline = await perf_repo.find_latest_green_baseline(
            db,
            project_id=run.project_id,
            load_kind=run.load_kind,
            exclude_run_id=run.id,
        )
    if baseline is None:
        return None
    detailed = await perf_repo.get_run_by_id_with_details(db, baseline.id)
    return detailed


def _perf_baseline_read_for_run(baseline_run: PerformanceRun) -> PerfBaselineRead:
    if baseline_run.baseline_policy == "tagged" and baseline_run.baseline_ref == baseline_run.id:
        return PerfBaselineRead(ref=baseline_run.id, policy="tagged", label="Tagged baseline")
    return PerfBaselineRead(ref=baseline_run.id, policy="latest_green", label="Latest green")


def _baseline_tx_metrics_by_key(baseline_run: PerformanceRun) -> dict[str, tuple[int, float, float]]:
    """First occurrence per transaction key: p95_ms, throughput_rps, error_rate_pct."""
    out: dict[str, tuple[int, float, float]] = {}
    for btx in baseline_run.transactions:
        if btx.key not in out:
            out[btx.key] = (btx.p95_ms, float(btx.throughput_rps), float(btx.error_rate_pct))
    return out
