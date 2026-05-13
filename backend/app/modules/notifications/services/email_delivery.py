from __future__ import annotations

import smtplib
import ssl
import socket
from email.message import EmailMessage

from app.core.errors import DomainError
from app.modules.notifications.models import SystemSmtpSettings


def build_email_message(
    *,
    smtp_settings: SystemSmtpSettings,
    recipients: list[str],
    subject: str,
    plain_text: str,
    html: str,
) -> EmailMessage:
    message = EmailMessage()
    sender = smtp_settings.from_email
    if smtp_settings.from_name:
        sender = f"{smtp_settings.from_name} <{smtp_settings.from_email}>"
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = ", ".join(recipients)
    if smtp_settings.reply_to:
        message["Reply-To"] = smtp_settings.reply_to
    message.set_content(plain_text)
    message.add_alternative(html, subtype="html")
    return message


def _validate_smtp_ready_to_send(smtp_settings: SystemSmtpSettings, recipients: list[str]) -> None:
    if not smtp_settings.enabled:
        raise DomainError(
            status_code=409,
            code="smtp_disabled",
            title="SMTP disabled",
            detail="SMTP settings are disabled",
        )
    if not recipients:
        raise DomainError(
            status_code=400,
            code="notification_recipient_required",
            title="Invalid request",
            detail="At least one email recipient is required",
        )
    if smtp_settings.use_tls and smtp_settings.use_starttls:
        raise DomainError(
            status_code=422,
            code="smtp_security_mode_conflict",
            title="Validation failed",
            detail="TLS and STARTTLS cannot be enabled at the same time",
        )


def _smtp_send_message(smtp_settings: SystemSmtpSettings, message: EmailMessage) -> None:
    timeout = smtp_settings.timeout_seconds
    client: smtplib.SMTP | None = None
    tls_context = ssl.create_default_context(purpose=ssl.Purpose.SERVER_AUTH)

    try:
        if smtp_settings.use_tls:
            client = smtplib.SMTP_SSL(
                smtp_settings.host,
                smtp_settings.port,
                timeout=timeout,
                context=tls_context,
            )
        else:
            client = smtplib.SMTP(smtp_settings.host, smtp_settings.port, timeout=timeout)
        client.ehlo()
        if smtp_settings.use_starttls and not smtp_settings.use_tls:
            client.starttls(context=tls_context)
            client.ehlo()
        if smtp_settings.username:
            client.login(smtp_settings.username, smtp_settings.password or "")
        client.send_message(message)
    except ssl.SSLError as exc:
        raise DomainError(
            status_code=502,
            code="smtp_ssl_error",
            title="SMTP connection failed",
            detail=(
                "SMTP SSL/TLS handshake failed. "
                "Check whether the server expects implicit TLS or STARTTLS on this port."
            ),
        ) from exc
    except smtplib.SMTPAuthenticationError as exc:
        raise DomainError(
            status_code=502,
            code="smtp_auth_failed",
            title="SMTP authentication failed",
            detail="SMTP server rejected the configured username or password",
        ) from exc
    except (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected, socket.timeout, ConnectionError, OSError) as exc:
        raise DomainError(
            status_code=502,
            code="smtp_connection_failed",
            title="SMTP connection failed",
            detail=f"Could not connect to SMTP server: {exc}",
        ) from exc
    except smtplib.SMTPException as exc:
        raise DomainError(
            status_code=502,
            code="smtp_send_failed",
            title="SMTP send failed",
            detail=f"SMTP server rejected the message: {exc}",
        ) from exc
    finally:
        if client is not None:
            try:
                client.quit()
            except Exception:
                pass


def send_email(
    *,
    smtp_settings: SystemSmtpSettings,
    recipients: list[str],
    subject: str,
    plain_text: str,
    html: str,
) -> None:
    _validate_smtp_ready_to_send(smtp_settings, recipients)
    message = build_email_message(
        smtp_settings=smtp_settings,
        recipients=recipients,
        subject=subject,
        plain_text=plain_text,
        html=html,
    )
    _smtp_send_message(smtp_settings, message)
