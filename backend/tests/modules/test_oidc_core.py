from __future__ import annotations

import base64
import json
import time

import pytest
from cryptography.hazmat.primitives import hashes, serialization  # noqa: F401
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from app.models.enums import AuthProviderType
from app.modules.auth.models import AuthProvider
from app.modules.auth.oidc.jwt_verify import JwtValidationError, verify_id_token
from app.modules.auth.oidc.presets import effective_oidc_settings
from app.modules.auth.oidc.transaction import (
    OidcTransaction,
    code_challenge_s256,
    deserialize,
    serialize,
)


def _b64u(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _int_b64u(value: int) -> str:
    return _b64u(value.to_bytes((value.bit_length() + 7) // 8, "big"))


class _Signer:
    def __init__(self) -> None:
        self.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.kid = "test-key-1"

    def jwks(self) -> dict:
        numbers = self.key.public_key().public_numbers()
        return {
            "keys": [
                {
                    "kty": "RSA",
                    "kid": self.kid,
                    "alg": "RS256",
                    "use": "sig",
                    "n": _int_b64u(numbers.n),
                    "e": _int_b64u(numbers.e),
                }
            ]
        }

    def token(self, claims: dict) -> str:
        header = {"alg": "RS256", "kid": self.kid, "typ": "JWT"}
        header_b64 = _b64u(json.dumps(header).encode())
        payload_b64 = _b64u(json.dumps(claims).encode())
        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        signature = self.key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
        return f"{header_b64}.{payload_b64}.{_b64u(signature)}"


# ---------------------------------------------------------------------------
# transaction
# ---------------------------------------------------------------------------


def test_transaction_round_trip_and_tamper():
    tx = OidcTransaction(
        provider_id="p1", state="st", nonce="no", code_verifier="cv", return_to="/x"
    )
    token = serialize(tx)
    restored = deserialize(token)
    assert restored is not None
    assert restored.provider_id == "p1"
    assert restored.state == "st"
    assert restored.return_to == "/x"

    payload_b64, _sig = token.split(".", 1)
    assert deserialize(f"{payload_b64}.AAAA") is None
    assert deserialize(None) is None
    assert deserialize("garbage") is None


def test_code_challenge_is_s256():
    # Known RFC 7636 example verifier/challenge.
    verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    assert code_challenge_s256(verifier) == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"


# ---------------------------------------------------------------------------
# presets
# ---------------------------------------------------------------------------


def _provider(ptype: AuthProviderType, config: dict, allow_email_linking=False) -> AuthProvider:
    return AuthProvider(
        id="prov",
        type=ptype,
        name="x",
        login_label="x",
        config=config,
        allow_email_linking=allow_email_linking,
    )


def test_google_preset_defaults():
    eff = effective_oidc_settings(_provider(AuthProviderType.google, {"client_id": "g"}))
    assert eff.issuer == "https://accounts.google.com"
    assert eff.discovery_url.endswith("/.well-known/openid-configuration")
    assert eff.require_verified_email is True
    assert eff.username_claims == ["email", "sub"]


def test_azure_single_tenant_issuer():
    eff = effective_oidc_settings(
        _provider(AuthProviderType.azure, {"client_id": "a", "tenant_mode": "single", "tenant_id": "TID"})
    )
    assert eff.issuer == "https://login.microsoftonline.com/TID/v2.0"
    assert eff.issuer_matches("https://login.microsoftonline.com/TID/v2.0")
    assert eff.username_claims == ["preferred_username", "email", "upn", "sub"]


def test_azure_multi_tenant_templated_issuer():
    eff = effective_oidc_settings(
        _provider(AuthProviderType.azure, {"client_id": "a", "tenant_mode": "multi"})
    )
    assert eff.issuer_is_templated is True
    assert eff.issuer_matches("https://login.microsoftonline.com/abc-123/v2.0")
    assert not eff.issuer_matches("https://evil.example.com/abc/v2.0")


def test_generic_oidc_requires_verified_email_when_linking():
    eff = effective_oidc_settings(
        _provider(
            AuthProviderType.oidc,
            {"issuer": "https://idp.test", "client_id": "c", "username_claim": "uid"},
            allow_email_linking=True,
        )
    )
    assert eff.issuer == "https://idp.test"
    assert eff.discovery_url == "https://idp.test/.well-known/openid-configuration"
    assert eff.require_verified_email is True
    assert eff.username_claims == ["uid", "email", "sub"]


# ---------------------------------------------------------------------------
# jwt_verify
# ---------------------------------------------------------------------------


def _base_claims(**overrides):
    claims = {
        "iss": "https://idp.test",
        "aud": "client-123",
        "sub": "subject-1",
        "nonce": "nonce-1",
        "exp": int(time.time()) + 600,
        "iat": int(time.time()),
    }
    claims.update(overrides)
    return claims


def test_verify_id_token_happy_path():
    signer = _Signer()
    eff = effective_oidc_settings(
        _provider(AuthProviderType.oidc, {"issuer": "https://idp.test", "client_id": "client-123"})
    )
    claims = verify_id_token(
        signer.token(_base_claims()),
        jwks=signer.jwks(),
        effective=eff,
        expected_nonce="nonce-1",
    )
    assert claims["sub"] == "subject-1"


@pytest.mark.parametrize(
    "overrides,nonce",
    [
        ({"iss": "https://evil.test"}, "nonce-1"),
        ({"aud": "someone-else"}, "nonce-1"),
        ({"exp": int(time.time()) - 10_000}, "nonce-1"),
        ({}, "wrong-nonce"),
    ],
)
def test_verify_id_token_rejects_invalid(overrides, nonce):
    signer = _Signer()
    eff = effective_oidc_settings(
        _provider(AuthProviderType.oidc, {"issuer": "https://idp.test", "client_id": "client-123"})
    )
    with pytest.raises(JwtValidationError):
        verify_id_token(
            signer.token(_base_claims(**overrides)),
            jwks=signer.jwks(),
            effective=eff,
            expected_nonce=nonce,
        )


def test_verify_id_token_rejects_bad_signature():
    signer = _Signer()
    other = _Signer()
    eff = effective_oidc_settings(
        _provider(AuthProviderType.oidc, {"issuer": "https://idp.test", "client_id": "client-123"})
    )
    token = signer.token(_base_claims())
    with pytest.raises(JwtValidationError):
        verify_id_token(
            token,
            jwks=other.jwks(),  # mismatched keys
            effective=eff,
            expected_nonce="nonce-1",
        )
