from __future__ import annotations

import smtplib
import socket
import ssl
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.core.errors import DomainError
from app.modules.notifications.services import email_delivery as service


def _smtp_settings(**overrides):
    data = {
        "enabled": True,
        "host": "smtp.example.com",
        "port": 587,
        "username": "user",
        "password": "secret",
        "from_email": "noreply@example.com",
        "from_name": "Karvio",
        "reply_to": "reply@example.com",
        "use_tls": False,
        "use_starttls": True,
        "timeout_seconds": 30,
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def test_build_email_message_sets_headers_and_multipart_content() -> None:
    message = service.build_email_message(
        smtp_settings=_smtp_settings(),
        recipients=["qa@example.com"],
        subject="Subject",
        plain_text="Hello",
        html="<p>Hello</p>",
    )

    assert message["Subject"] == "Subject"
    assert message["From"] == "Karvio <noreply@example.com>"
    assert message["To"] == "qa@example.com"
    assert message["Reply-To"] == "reply@example.com"
    assert message.is_multipart() is True


def test_validate_smtp_ready_to_send_rejects_invalid_configurations() -> None:
    with pytest.raises(DomainError) as disabled_exc:
        service._validate_smtp_ready_to_send(_smtp_settings(enabled=False), ["qa@example.com"])
    assert disabled_exc.value.code == "smtp_disabled"

    with pytest.raises(DomainError) as recipients_exc:
        service._validate_smtp_ready_to_send(_smtp_settings(), [])
    assert recipients_exc.value.code == "notification_recipient_required"

    with pytest.raises(DomainError) as tls_conflict_exc:
        service._validate_smtp_ready_to_send(_smtp_settings(use_tls=True, use_starttls=True), ["qa@example.com"])
    assert tls_conflict_exc.value.code == "smtp_security_mode_conflict"


def test_smtp_send_message_with_starttls_and_auth() -> None:
    client = MagicMock()
    message = MagicMock()

    with patch("app.modules.notifications.services.email_delivery.smtplib.SMTP", return_value=client) as smtp_ctor:
        service._smtp_send_message(_smtp_settings(use_tls=False, use_starttls=True, username="user"), message)

    smtp_ctor.assert_called_once_with("smtp.example.com", 587, timeout=30)
    client.ehlo.assert_called()
    client.starttls.assert_called_once()
    client.login.assert_called_once_with("user", "secret")
    client.send_message.assert_called_once_with(message)
    client.quit.assert_called_once()


def test_smtp_send_message_with_implicit_tls() -> None:
    client = MagicMock()

    with patch("app.modules.notifications.services.email_delivery.smtplib.SMTP_SSL", return_value=client) as smtp_ssl_ctor:
        service._smtp_send_message(_smtp_settings(use_tls=True, use_starttls=False), MagicMock())

    smtp_ssl_ctor.assert_called_once()
    client.starttls.assert_not_called()


@pytest.mark.parametrize(
    ("exc", "code"),
    [
        (ssl.SSLError("ssl"), "smtp_ssl_error"),
        (smtplib.SMTPAuthenticationError(535, b"bad auth"), "smtp_auth_failed"),
        (smtplib.SMTPConnectError(421, "connect"), "smtp_connection_failed"),
        (socket.timeout("timeout"), "smtp_connection_failed"),
    ],
)
def test_smtp_send_message_maps_transport_errors_to_domain_error(exc: Exception, code: str) -> None:
    client = MagicMock()
    client.ehlo.side_effect = exc

    with patch("app.modules.notifications.services.email_delivery.smtplib.SMTP", return_value=client):
        with pytest.raises(DomainError) as raised:
            service._smtp_send_message(_smtp_settings(), MagicMock())

    assert raised.value.code == code
    client.quit.assert_called_once()


def test_send_email_calls_validation_builder_and_sender() -> None:
    with (
        patch("app.modules.notifications.services.email_delivery._validate_smtp_ready_to_send") as validate,
        patch("app.modules.notifications.services.email_delivery.build_email_message", return_value=MagicMock()) as build,
        patch("app.modules.notifications.services.email_delivery._smtp_send_message") as send,
    ):
        service.send_email(
            smtp_settings=_smtp_settings(),
            recipients=["qa@example.com"],
            subject="subj",
            plain_text="plain",
            html="<p>plain</p>",
        )

    validate.assert_called_once()
    build.assert_called_once()
    send.assert_called_once()
