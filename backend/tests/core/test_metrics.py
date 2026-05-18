from __future__ import annotations

from app.core import metrics


def test_metrics_registry_and_rendering_covers_counters_gauges_summaries() -> None:
    metrics.reset_metrics()
    metrics.observe_http_request(method="GET", path="/status", status_code=500, duration_seconds=0.12)
    metrics.record_use_case("auth.login", outcome="success")
    metrics.observe_worker_batch(worker="w1", queue="audit", claimed=5, processed=4, duration_seconds=1.2)
    metrics.record_queue_retry(queue="audit", dead_lettered=True)
    metrics.set_queue_depth(queue="audit", by_status={"pending": 3}, known_statuses=("pending", "processing"))
    metrics.record_oauth_connect(provider="jira", success=False, reason="invalid_code")
    metrics.record_oauth_connect(provider="jira", success=True)
    metrics.record_jira_api_request(endpoint="/search", status_code=200)
    metrics.record_jira_sync_lag(seconds=-3.0)
    metrics.record_jira_link_invalid(reason=None)

    text = metrics.render_metrics_text()

    assert "tms_http_requests_total" in text
    assert "tms_http_request_errors_total" in text
    assert "tms_worker_batch_latency_seconds_sum" in text
    assert "tms_queue_dead_letter_total" in text
    assert 'status="processing"' in text
    assert "tms_oauth_connect_failure_total" in text
    assert 'reason="unknown"' in text
    assert "tms_jira_sync_lag_seconds_sum" in text


def test_observe_worker_batch_skips_zero_claimed_and_processed_counters() -> None:
    metrics.reset_metrics()
    metrics.observe_worker_batch(worker="w1", queue="audit", claimed=0, processed=0, duration_seconds=0.2)

    text = metrics.render_metrics_text()

    assert "tms_worker_batches_total" in text
    assert "tms_worker_batch_claimed_total" not in text
    assert "tms_worker_batch_processed_total" not in text


def test_record_jira_sync_lag_clamps_negative_values() -> None:
    metrics.reset_metrics()
    metrics.record_jira_sync_lag(seconds=-5.0)

    text = metrics.render_metrics_text()

    assert "tms_jira_sync_lag_seconds_count" in text
    assert "tms_jira_sync_lag_seconds_sum 0.0" in text
