from __future__ import annotations

import base64
import json
import time
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers

from app.modules.auth.oidc.presets import EffectiveOidc

CLOCK_SKEW_SECONDS = 120


class JwtValidationError(Exception):
    """Raised when an ID token fails signature or claim validation."""


def _b64url_decode(segment: str) -> bytes:
    padding_needed = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding_needed)


def _int_from_b64(value: str) -> int:
    return int.from_bytes(_b64url_decode(value), "big")


def _select_key(jwks: dict[str, Any], kid: str | None) -> dict[str, Any]:
    rsa_keys = [k for k in jwks.get("keys", []) if k.get("kty") == "RSA"]
    if not rsa_keys:
        raise JwtValidationError("No RSA keys in JWKS")
    if kid:
        for key in rsa_keys:
            if key.get("kid") == kid:
                return key
        raise JwtValidationError("Signing key not found in JWKS")
    return rsa_keys[0]


def _verify_signature(signing_input: bytes, signature: bytes, jwk: dict[str, Any]) -> None:
    public_key = RSAPublicNumbers(
        e=_int_from_b64(jwk["e"]),
        n=_int_from_b64(jwk["n"]),
    ).public_key()
    try:
        public_key.verify(signature, signing_input, padding.PKCS1v15(), hashes.SHA256())
    except InvalidSignature as exc:
        raise JwtValidationError("Invalid token signature") from exc


def _audience_ok(aud: Any, client_id: str, claims: dict[str, Any]) -> bool:
    if isinstance(aud, str):
        if aud == client_id:
            return True
    elif isinstance(aud, list) and client_id in aud:
        return True
    # Tolerate when client_id is the authorized party.
    return claims.get("azp") == client_id


def verify_id_token(
    token: str,
    *,
    jwks: dict[str, Any],
    effective: EffectiveOidc,
    expected_nonce: str,
) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3:
        raise JwtValidationError("Malformed token")
    header_b64, payload_b64, signature_b64 = parts

    try:
        header = json.loads(_b64url_decode(header_b64))
        claims = json.loads(_b64url_decode(payload_b64))
    except (ValueError, json.JSONDecodeError) as exc:
        raise JwtValidationError("Malformed token") from exc

    if header.get("alg") != "RS256":
        raise JwtValidationError(f"Unsupported token algorithm: {header.get('alg')}")

    jwk = _select_key(jwks, header.get("kid"))
    _verify_signature(f"{header_b64}.{payload_b64}".encode("ascii"), _b64url_decode(signature_b64), jwk)

    iss = claims.get("iss")
    if not isinstance(iss, str) or not effective.issuer_matches(iss):
        raise JwtValidationError("Issuer mismatch")

    if not _audience_ok(claims.get("aud"), effective.client_id, claims):
        raise JwtValidationError("Audience mismatch")

    now = int(time.time())
    exp = claims.get("exp")
    if not isinstance(exp, (int, float)) or now > exp + CLOCK_SKEW_SECONDS:
        raise JwtValidationError("Token expired")
    nbf = claims.get("nbf")
    if isinstance(nbf, (int, float)) and now + CLOCK_SKEW_SECONDS < nbf:
        raise JwtValidationError("Token not yet valid")

    if claims.get("nonce") != expected_nonce:
        raise JwtValidationError("Nonce mismatch")

    # Azure tenant validation
    if effective.allowed_tenant_ids:
        tid = claims.get("tid")
        if tid not in effective.allowed_tenant_ids:
            raise JwtValidationError("Tenant not allowed")

    return claims
