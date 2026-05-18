from __future__ import annotations

import urllib.error
from unittest.mock import MagicMock, patch

import pytest

from app.core.errors import DomainError
from app.models.enums import NotificationChannel
from app.modules.notifications.services import webhook_delivery as service


def test_build_webhook_payload_for_slack_and_mattermost() -> None:
    slack_payload = service.build_webhook_payload(
        title="Build completed",
        text="All good",
        channel=NotificationChannel.slack,
        channel_name="#qa",
    )
    assert slack_payload["text"] == "Build completed"
    assert slack_payload["channel"] == "#qa"

    mm_payload = service.build_webhook_payload(
        title="Build completed",
        text="All good",
        channel=NotificationChannel.mattermost,
    )
    assert mm_payload["text"].startswith("### Build completed")
    assert "channel" not in mm_payload


def test_send_webhook_success() -> None:
    response = MagicMock(status=200)
    response.__enter__.return_value = response
    response.__exit__.return_value = None

    with patch("app.modules.notifications.services.webhook_delivery.urllib.request.urlopen", return_value=response) as urlopen:
        service.send_webhook(webhook_url="https://example.test/hook", payload={"k": "v"})

    urlopen.assert_called_once()


def test_send_webhook_raises_on_5xx_response_status() -> None:
    response = MagicMock(status=500)
    response.__enter__.return_value = response
    response.__exit__.return_value = None

    with patch("app.modules.notifications.services.webhook_delivery.urllib.request.urlopen", return_value=response):
        with pytest.raises(DomainError) as exc:
            service.send_webhook(webhook_url="https://example.test/hook", payload={"k": "v"})

    assert exc.value.code == "webhook_delivery_failed"


@pytest.mark.parametrize(
    ("error", "needle"),
    [
        (urllib.error.HTTPError("http://x", 403, "forbidden", hdrs=None, fp=None), "status 403"),
        (urllib.error.URLError("dns down"), "dns down"),
    ],
)
def test_send_webhook_maps_http_and_url_errors(error: Exception, needle: str) -> None:
    with patch("app.modules.notifications.services.webhook_delivery.urllib.request.urlopen", side_effect=error):
        with pytest.raises(DomainError) as exc:
            service.send_webhook(webhook_url="https://example.test/hook", payload={"k": "v"})

    assert exc.value.code == "webhook_delivery_failed"
    assert needle in exc.value.detail
