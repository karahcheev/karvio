"""Unit tests for app.core.security — covering all public functions."""

from __future__ import annotations

import time
from unittest.mock import patch

import pytest

from app.core.security import (
    API_KEY_TOKEN_PREFIX,
    create_access_token,
    create_api_key,
    decode_access_token,
    get_password_validation_errors,
    hash_api_key,
    hash_password,
    is_probable_api_key,
    parse_api_key_prefix,
    validate_password_strength,
    verify_password,
)


# ---------------------------------------------------------------------------
# hash_password / verify_password
# ---------------------------------------------------------------------------


def test_hash_password_produces_pbkdf2_sha256_format():
    h = hash_password("MyPassword1")
    parts = h.split("$")
    assert parts[0] == "pbkdf2_sha256"
    assert parts[1] == "600000"
    assert len(parts) == 4


def test_verify_password_roundtrip():
    pw = "CorrectHorse9"
    assert verify_password(pw, hash_password(pw)) is True


def test_verify_password_wrong_password():
    h = hash_password("CorrectHorse9")
    assert verify_password("WrongHorse99", h) is False


def test_verify_password_wrong_algorithm_returns_false():
    # Replace the algorithm segment with something unsupported
    h = hash_password("Abc12345678")
    tampered = "sha1" + h[len("pbkdf2_sha256"):]
    assert verify_password("Abc12345678", tampered) is False


def test_verify_password_malformed_hash_returns_false():
    assert verify_password("anything", "not-a-valid-hash") is False
    assert verify_password("anything", "") is False
    assert verify_password("anything", "a$b") is False  # too few segments


def test_hash_password_is_salted_not_deterministic():
    pw = "SamePassword1"
    assert hash_password(pw) != hash_password(pw)


# ---------------------------------------------------------------------------
# get_password_validation_errors / validate_password_strength
# ---------------------------------------------------------------------------


def test_password_too_short():
    errors = get_password_validation_errors("Short1A")
    assert any("10 characters" in e for e in errors)


def test_password_missing_uppercase():
    errors = get_password_validation_errors("alllowercase1")
    assert any("uppercase" in e for e in errors)


def test_password_missing_lowercase():
    errors = get_password_validation_errors("ALLUPPERCASE1")
    assert any("lowercase" in e for e in errors)


def test_password_missing_number():
    errors = get_password_validation_errors("NoNumbersHere")
    assert any("number" in e for e in errors)


def test_password_valid_has_no_errors():
    assert get_password_validation_errors("ValidPass1") == []


def test_validate_password_strength_raises_on_weak():
    with pytest.raises(ValueError, match="uppercase"):
        validate_password_strength("alllowercase1")


def test_validate_password_strength_returns_password_on_success():
    pw = "ValidPass1"
    assert validate_password_strength(pw) == pw


# ---------------------------------------------------------------------------
# create_access_token / decode_access_token
# ---------------------------------------------------------------------------


def test_token_roundtrip_returns_payload_with_correct_fields():
    token = create_access_token("user_42", token_version=7)
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "user_42"
    assert payload["ver"] == 7
    assert isinstance(payload["exp"], int)


def test_decode_expired_token_returns_none():
    # Create token and fake that time has moved past expiry
    token = create_access_token("user_1", token_version=0)
    with patch("app.core.security.time") as mock_time:
        mock_time.time.return_value = int(time.time()) + 10_000_000  # far future
        result = decode_access_token(token)
    assert result is None


def test_decode_tampered_signature_returns_none():
    token = create_access_token("user_1")
    payload_b64, sig = token.rsplit(".", 1)
    # Flip last char of signature
    bad_sig = sig[:-1] + ("A" if sig[-1] != "A" else "B")
    assert decode_access_token(f"{payload_b64}.{bad_sig}") is None


def test_decode_tampered_payload_returns_none():
    import base64, json

    token = create_access_token("user_1")
    payload_b64, sig = token.rsplit(".", 1)
    # Decode and change sub
    padding = "=" * (-len(payload_b64) % 4)
    payload = json.loads(base64.urlsafe_b64decode(payload_b64 + padding))
    payload["sub"] = "hacker"
    new_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    assert decode_access_token(f"{new_b64}.{sig}") is None


def test_decode_completely_random_string_returns_none():
    assert decode_access_token("not.a.real.token") is None
    assert decode_access_token("garbage") is None


def test_decode_missing_sub_field_returns_none():
    import base64, json, hmac as _hmac, hashlib
    from app.core.config import get_settings

    settings = get_settings()
    payload = {"ver": 0, "exp": int(time.time()) + 3600}  # no "sub"
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    b64 = base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
    sig = _hmac.new(settings.auth_secret.encode(), b64.encode(), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode()
    assert decode_access_token(f"{b64}.{sig_b64}") is None


# ---------------------------------------------------------------------------
# create_api_key / hash_api_key / parse_api_key_prefix / is_probable_api_key
# ---------------------------------------------------------------------------


def test_create_api_key_returns_four_parts():
    raw, prefix, hint, key_hash = create_api_key()
    assert raw.startswith(f"{API_KEY_TOKEN_PREFIX}_")
    assert prefix.startswith(f"{API_KEY_TOKEN_PREFIX}_")
    assert len(hint) == 4
    assert key_hash.startswith("sha256:")


def test_create_api_key_prefix_is_parseable():
    raw, prefix, hint, key_hash = create_api_key()
    parsed = parse_api_key_prefix(raw)
    assert parsed == prefix


def test_hash_api_key_is_deterministic():
    raw = "tms2ak_abc123_somesecret"
    assert hash_api_key(raw) == hash_api_key(raw)


def test_hash_api_key_differs_for_different_keys():
    assert hash_api_key("tms2ak_aaa_bbb") != hash_api_key("tms2ak_aaa_ccc")


def test_parse_api_key_prefix_valid():
    raw = f"{API_KEY_TOKEN_PREFIX}_abc123_secretpart"
    prefix = parse_api_key_prefix(raw)
    assert prefix == f"{API_KEY_TOKEN_PREFIX}_abc123"


def test_parse_api_key_prefix_wrong_prefix():
    assert parse_api_key_prefix("wrongprefix_abc123_secret") is None


def test_parse_api_key_prefix_missing_second_underscore():
    assert parse_api_key_prefix(f"{API_KEY_TOKEN_PREFIX}_nounderscore") is None


def test_parse_api_key_prefix_empty_public_id():
    # prefix_ _ secret — empty public_id segment
    assert parse_api_key_prefix(f"{API_KEY_TOKEN_PREFIX}__secret") is None


def test_is_probable_api_key_true():
    assert is_probable_api_key(f"{API_KEY_TOKEN_PREFIX}_anything") is True


def test_is_probable_api_key_false():
    assert is_probable_api_key("Bearer eyJhbGciOiJIUzI1NiJ9") is False
    assert is_probable_api_key("") is False
