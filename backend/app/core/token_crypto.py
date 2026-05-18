from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


def _build_fernet() -> Fernet:
    settings = get_settings()
    digest = hashlib.sha256(settings.auth_secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_secret(value: str) -> str:
    if not value:
        return ""
    return _build_fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: str) -> str:
    if not value:
        return ""
    try:
        return _build_fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:  # pragma: no cover - defensive guard
        raise ValueError("Unable to decrypt secret payload") from exc
