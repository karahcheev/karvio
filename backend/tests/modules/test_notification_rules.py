"""Tests for normalize_rule_payload and related notification rule schema logic."""

from __future__ import annotations

import pytest

from app.modules.notifications.services.notification_rules import normalize_rule_payload


async def test_normalize_rule_payload_none_gives_disabled_defaults() -> None:
    rule = normalize_rule_payload(None)
    assert rule.enabled is False
    assert rule.email.enabled is False
    assert rule.email.recipients == []
    assert rule.slack.enabled is False
    assert rule.slack.webhook_url is None
    assert rule.mattermost.enabled is False


async def test_normalize_rule_payload_empty_dict_gives_disabled_defaults() -> None:
    rule = normalize_rule_payload({})
    assert rule.enabled is False


async def test_normalize_rule_payload_enabled_true() -> None:
    rule = normalize_rule_payload({"enabled": True})
    assert rule.enabled is True


async def test_normalize_rule_payload_email_channel() -> None:
    rule = normalize_rule_payload(
        {
            "enabled": True,
            "email": {"enabled": True, "recipients": ["qa@example.com", "lead@example.com"]},
        }
    )
    assert rule.enabled is True
    assert rule.email.enabled is True
    assert "qa@example.com" in rule.email.recipients
    assert len(rule.email.recipients) == 2


async def test_normalize_rule_payload_slack_channel() -> None:
    rule = normalize_rule_payload(
        {"slack": {"enabled": True, "webhook_url": "https://hooks.slack.com/abc", "channel_name": "  #qa  "}}
    )
    assert rule.slack.enabled is True
    assert rule.slack.webhook_url == "https://hooks.slack.com/abc"
    # channel_name is stripped by validator
    assert rule.slack.channel_name == "#qa"


async def test_normalize_rule_payload_channel_name_whitespace_only_becomes_none() -> None:
    rule = normalize_rule_payload({"slack": {"enabled": False, "channel_name": "   "}})
    assert rule.slack.channel_name is None


async def test_normalize_rule_payload_mattermost_channel() -> None:
    rule = normalize_rule_payload(
        {"mattermost": {"enabled": True, "webhook_url": "https://mm.example.com/hook/xyz"}}
    )
    assert rule.mattermost.enabled is True
    assert rule.mattermost.webhook_url == "https://mm.example.com/hook/xyz"


async def test_normalize_rule_payload_extra_fields_rejected() -> None:
    with pytest.raises(Exception):
        normalize_rule_payload({"enabled": True, "unknown_field": "boom"})


async def test_normalize_rule_payload_invalid_email_recipient_rejected() -> None:
    with pytest.raises(Exception):
        normalize_rule_payload({"email": {"enabled": True, "recipients": ["not-an-email"]}})
