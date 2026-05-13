from __future__ import annotations

from dataclasses import dataclass
from threading import RLock
from typing import Any

_METRIC_HELP: dict[str, str] = {
    "tms_http_requests_total": "HTTP requests served by endpoint and status code.",
    "tms_http_request_errors_total": "HTTP requests that ended in 4xx/5xx status.",
    "tms_http_request_latency_seconds": "HTTP request latency in seconds.",
    "tms_use_case_total": "Business use case executions by outcome.",
    "tms_worker_batches_total": "Queue worker batches executed.",
    "tms_worker_batch_claimed_total": "Queue entries claimed by workers.",
    "tms_worker_batch_processed_total": "Queue entries processed successfully by workers.",
    "tms_worker_batch_latency_seconds": "Queue worker batch processing latency.",
    "tms_queue_retries_total": "Queue entries retried after processing failure.",
    "tms_queue_dead_letter_total": "Queue entries moved to dead-letter status.",
    "tms_queue_depth": "Current queue depth grouped by status.",
    "tms_oauth_connect_success_total": "Successful OAuth connect operations by provider.",
    "tms_oauth_connect_failure_total": "Failed OAuth connect operations by provider and reason.",
    "tms_jira_api_requests_total": "Jira API requests by endpoint and status code.",
    "tms_jira_sync_lag_seconds": "Freshness lag between local snapshot and external issue state.",
    "tms_jira_link_invalid_total": "External Jira links marked invalid.",
}


def _normalize_label_value(value: Any) -> str:
    if value is None:
        return "none"
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _normalize_labels(labels: dict[str, Any] | None) -> tuple[tuple[str, str], ...]:
    if not labels:
        return tuple()
    return tuple(sorted((key, _normalize_label_value(value)) for key, value in labels.items()))


def _escape_label_value(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')


def _format_labels(label_items: tuple[tuple[str, str], ...]) -> str:
    if not label_items:
        return ""
    rendered = ",".join(f'{key}="{_escape_label_value(value)}"' for key, value in label_items)
    return f"{{{rendered}}}"


@dataclass
class _SummaryValue:
    count: int = 0
    total: float = 0.0


def _append_counter_lines(lines: list[str], counters: dict[tuple[str, tuple[tuple[str, str], ...]], float]) -> None:
    for metric_name in sorted({name for name, _ in counters.keys()}):
        lines.append(f"# HELP {metric_name} {_METRIC_HELP.get(metric_name, metric_name)}")
        lines.append(f"# TYPE {metric_name} counter")
        for (name, labels), value in sorted(counters.items()):
            if name != metric_name:
                continue
            lines.append(f"{name}{_format_labels(labels)} {value}")


def _append_gauge_lines(lines: list[str], gauges: dict[tuple[str, tuple[tuple[str, str], ...]], float]) -> None:
    for metric_name in sorted({name for name, _ in gauges.keys()}):
        lines.append(f"# HELP {metric_name} {_METRIC_HELP.get(metric_name, metric_name)}")
        lines.append(f"# TYPE {metric_name} gauge")
        for (name, labels), value in sorted(gauges.items()):
            if name != metric_name:
                continue
            lines.append(f"{name}{_format_labels(labels)} {value}")


def _append_summary_lines(
    lines: list[str],
    summaries: dict[tuple[str, tuple[tuple[str, str], ...]], _SummaryValue],
) -> None:
    for metric_name in sorted({name for name, _ in summaries.keys()}):
        lines.append(f"# HELP {metric_name} {_METRIC_HELP.get(metric_name, metric_name)}")
        lines.append(f"# TYPE {metric_name} summary")
        for (name, labels), summary in sorted(summaries.items()):
            if name != metric_name:
                continue
            lines.append(f"{name}_count{_format_labels(labels)} {summary.count}")
            lines.append(f"{name}_sum{_format_labels(labels)} {summary.total}")


class _MetricsRegistry:
    def __init__(self) -> None:
        self._lock = RLock()
        self._counters: dict[tuple[str, tuple[tuple[str, str], ...]], float] = {}
        self._gauges: dict[tuple[str, tuple[tuple[str, str], ...]], float] = {}
        self._summaries: dict[tuple[str, tuple[tuple[str, str], ...]], _SummaryValue] = {}

    def counter(self, name: str, *, labels: dict[str, Any] | None = None, value: float = 1.0) -> None:
        if value == 0:
            return
        key = (name, _normalize_labels(labels))
        with self._lock:
            self._counters[key] = self._counters.get(key, 0.0) + value

    def gauge(self, name: str, *, labels: dict[str, Any] | None = None, value: float) -> None:
        key = (name, _normalize_labels(labels))
        with self._lock:
            self._gauges[key] = value

    def summary(self, name: str, *, labels: dict[str, Any] | None = None, value: float) -> None:
        key = (name, _normalize_labels(labels))
        with self._lock:
            summary = self._summaries.setdefault(key, _SummaryValue())
            summary.count += 1
            summary.total += float(value)

    def render_prometheus_text(self) -> str:
        with self._lock:
            counters = dict(self._counters)
            gauges = dict(self._gauges)
            summaries = {key: _SummaryValue(count=value.count, total=value.total) for key, value in self._summaries.items()}

        lines: list[str] = []
        _append_counter_lines(lines, counters)
        _append_gauge_lines(lines, gauges)
        _append_summary_lines(lines, summaries)

        lines.append("")
        return "\n".join(lines)

    def clear(self) -> None:
        with self._lock:
            self._counters.clear()
            self._gauges.clear()
            self._summaries.clear()


_registry = _MetricsRegistry()


def observe_http_request(
    *,
    method: str,
    path: str,
    status_code: int,
    duration_seconds: float,
) -> None:
    labels = {
        "method": method,
        "path": path,
        "status_code": status_code,
    }
    _registry.counter("tms_http_requests_total", labels=labels)
    _registry.summary(
        "tms_http_request_latency_seconds",
        labels={"method": method, "path": path},
        value=duration_seconds,
    )
    if status_code >= 400:
        _registry.counter(
            "tms_http_request_errors_total",
            labels={
                "method": method,
                "path": path,
                "status_class": f"{status_code // 100}xx",
            },
        )


def record_use_case(use_case: str, *, outcome: str) -> None:
    _registry.counter(
        "tms_use_case_total",
        labels={"use_case": use_case, "outcome": outcome},
    )


def observe_worker_batch(
    *,
    worker: str,
    queue: str,
    claimed: int,
    processed: int,
    duration_seconds: float,
) -> None:
    labels = {"worker": worker, "queue": queue}
    _registry.counter("tms_worker_batches_total", labels=labels)
    _registry.counter("tms_worker_batch_claimed_total", labels=labels, value=claimed)
    _registry.counter("tms_worker_batch_processed_total", labels=labels, value=processed)
    _registry.summary("tms_worker_batch_latency_seconds", labels=labels, value=duration_seconds)


def record_queue_retry(*, queue: str, dead_lettered: bool) -> None:
    labels = {"queue": queue}
    _registry.counter("tms_queue_retries_total", labels=labels)
    if dead_lettered:
        _registry.counter("tms_queue_dead_letter_total", labels=labels)


def set_queue_depth(*, queue: str, by_status: dict[str, int], known_statuses: tuple[str, ...]) -> None:
    statuses = {status: 0 for status in known_statuses}
    for status, count in by_status.items():
        statuses[str(status)] = int(count)
    for status, count in statuses.items():
        _registry.gauge(
            "tms_queue_depth",
            labels={"queue": queue, "status": status},
            value=count,
        )


def render_metrics_text() -> str:
    return _registry.render_prometheus_text()


def reset_metrics() -> None:
    _registry.clear()


def record_oauth_connect(*, provider: str, success: bool, reason: str | None = None) -> None:
    metric = "tms_oauth_connect_success_total" if success else "tms_oauth_connect_failure_total"
    labels = {"provider": provider}
    if not success and reason:
        labels["reason"] = reason
    _registry.counter(metric, labels=labels)


def record_jira_api_request(*, endpoint: str, status_code: int) -> None:
    _registry.counter(
        "tms_jira_api_requests_total",
        labels={"endpoint": endpoint, "status_code": status_code},
    )


def record_jira_sync_lag(*, seconds: float) -> None:
    _registry.summary("tms_jira_sync_lag_seconds", value=max(0.0, float(seconds)))


def record_jira_link_invalid(*, reason: str | None) -> None:
    labels = {"reason": reason or "unknown"}
    _registry.counter("tms_jira_link_invalid_total", labels=labels)
