from app.core.metrics import render_metrics_text, reset_metrics
from app.modules.notifications.services.queue import process_notification_queue_entry


async def test_metrics_endpoint_requires_auth(client) -> None:
    reset_metrics()
    metrics_response = await client.get("/metrics")
    assert metrics_response.status_code == 401


async def test_metrics_endpoint_exposes_http_metrics(client, auth_headers) -> None:
    reset_metrics()
    status_response = await client.get("/status")
    assert status_response.status_code == 200

    metrics_response = await client.get("/metrics", headers=auth_headers)
    assert metrics_response.status_code == 200
    assert "tms_http_requests_total" in metrics_response.text
    assert 'path="/status"' in metrics_response.text
    assert 'method="GET"' in metrics_response.text


async def test_worker_metrics_exposed_for_notification_queue(db_session) -> None:
    reset_metrics()
    processed = await process_notification_queue_entry(db_session, entry_id="missing_queue_entry")
    assert processed is False

    metrics_text = render_metrics_text()
    assert "tms_worker_batches_total" in metrics_text
    assert 'worker="notification_queue_worker"' in metrics_text
    assert 'queue="notifications"' in metrics_text
    assert "tms_queue_depth" in metrics_text
    assert 'status="pending"' in metrics_text
