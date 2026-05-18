from app.models.enums import NotificationChannel, NotificationEventType, NotificationQueueStatus
from app.modules.notifications.models import NotificationQueueEntry


async def test_status_endpoint_returns_system_components(client) -> None:
    response = await client.get("/status")
    assert response.status_code == 200

    body = response.json()
    assert body["status"] in {"ok", "degraded"}
    assert "checked_at" in body
    assert "components" in body
    assert body["components"]["database"]["status"] == "ok"
    assert "storage" in body["components"]
    assert "workers" in body["components"]


async def test_status_endpoint_degrades_when_dead_letters_exist(client, db_session) -> None:
    db_session.add(
        NotificationQueueEntry(
            id="nout_status_dead_1",
            project_id=None,
            event_type=NotificationEventType.test_run_report,
            channel=NotificationChannel.slack,
            target={"webhook_url": "https://example.invalid/hook"},
            payload={"title": "Alert", "text": "dead letter"},
            status=NotificationQueueStatus.dead,
            max_attempts=5,
        )
    )
    await db_session.commit()

    response = await client.get("/status")
    assert response.status_code == 200
    body = response.json()

    assert body["status"] == "degraded"
    assert body["components"]["workers"]["status"] == "degraded"
    notifications = body["components"]["workers"]["queues"]["notifications"]
    assert notifications["status"] == "degraded"
    assert notifications["dead"] == 1
