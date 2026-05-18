from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

from app.core.domain_strings import TITLE_WEBHOOK_DELIVERY_FAILED
from app.core.errors import DomainError
from app.models.enums import NotificationChannel


def build_webhook_payload(
    *,
    title: str,
    text: str,
    channel: NotificationChannel,
    channel_name: str | None = None,
) -> dict[str, Any]:
    if channel == NotificationChannel.slack:
        payload = {
            "text": title,
            "blocks": [
                {"type": "header", "text": {"type": "plain_text", "text": title}},
                {"type": "section", "text": {"type": "mrkdwn", "text": text}},
            ],
        }
        if channel_name:
            payload["channel"] = channel_name
        return payload
    payload = {
        "text": f"### {title}\n\n{text}",
    }
    if channel_name:
        payload["channel"] = channel_name
    return payload


def send_webhook(*, webhook_url: str, payload: dict[str, Any]) -> None:
    request = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            if response.status >= 400:
                raise DomainError(
                    status_code=502,
                    code="webhook_delivery_failed",
                    title=TITLE_WEBHOOK_DELIVERY_FAILED,
                    detail=f"Webhook responded with status {response.status}",
                )
    except urllib.error.HTTPError as exc:
        raise DomainError(
            status_code=502,
            code="webhook_delivery_failed",
            title=TITLE_WEBHOOK_DELIVERY_FAILED,
            detail=f"Webhook responded with status {exc.code}",
        ) from exc
    except urllib.error.URLError as exc:
        raise DomainError(
            status_code=502,
            code="webhook_delivery_failed",
            title=TITLE_WEBHOOK_DELIVERY_FAILED,
            detail=f"Webhook request failed: {exc.reason}",
        ) from exc
