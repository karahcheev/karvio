from __future__ import annotations

from app.core import token_crypto


def test_encrypt_decrypt_secret_roundtrip_and_empty() -> None:
    encrypted = token_crypto.encrypt_secret("secret-value")
    assert encrypted
    assert token_crypto.decrypt_secret(encrypted) == "secret-value"
    assert token_crypto.encrypt_secret("") == ""
    assert token_crypto.decrypt_secret("") == ""
