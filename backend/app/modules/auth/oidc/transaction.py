from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass

from app.core.config import get_settings

OIDC_TX_COOKIE = "tms_oidc_tx"
TX_TTL_SECONDS = 600


@dataclass(slots=True)
class OidcTransaction:
    provider_id: str
    state: str
    nonce: str
    code_verifier: str
    return_to: str


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64d(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _sign(payload_b64: str) -> str:
    secret = get_settings().auth_secret.encode("utf-8")
    digest = hmac.new(secret, payload_b64.encode("ascii"), hashlib.sha256).digest()
    return _b64e(digest)


def new_state() -> str:
    return secrets.token_urlsafe(24)


def new_nonce() -> str:
    return secrets.token_urlsafe(24)


def new_code_verifier() -> str:
    # RFC 7636: 43-128 chars from the unreserved set.
    return secrets.token_urlsafe(64)


def code_challenge_s256(code_verifier: str) -> str:
    return _b64e(hashlib.sha256(code_verifier.encode("ascii")).digest())


def serialize(tx: OidcTransaction) -> str:
    payload = {
        "p": tx.provider_id,
        "s": tx.state,
        "n": tx.nonce,
        "v": tx.code_verifier,
        "r": tx.return_to,
        "e": int(time.time()) + TX_TTL_SECONDS,
    }
    payload_b64 = _b64e(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    return f"{payload_b64}.{_sign(payload_b64)}"


def deserialize(token: str | None) -> OidcTransaction | None:
    if not token:
        return None
    try:
        payload_b64, signature_b64 = token.split(".", maxsplit=1)
    except ValueError:
        return None
    expected = _sign(payload_b64)
    if not hmac.compare_digest(expected, signature_b64):
        return None
    try:
        payload = json.loads(_b64d(payload_b64).decode("utf-8"))
    except (ValueError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    exp = payload.get("e")
    if not isinstance(exp, int) or exp <= int(time.time()):
        return None
    try:
        return OidcTransaction(
            provider_id=str(payload["p"]),
            state=str(payload["s"]),
            nonce=str(payload["n"]),
            code_verifier=str(payload["v"]),
            return_to=str(payload["r"]),
        )
    except KeyError:
        return None
