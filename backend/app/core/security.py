import base64
import hashlib
import hmac
import json
import re
import secrets
import time

from app.core.config import get_settings

PASSWORD_MIN_LENGTH = 10
PASSWORD_POLICY_HINT = "Password must be at least 10 characters long and include uppercase, lowercase, and a number."
API_KEY_TOKEN_PREFIX = "tms2ak"


def _urlsafe_b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _urlsafe_b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    iterations = 600_000
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return "$".join(
        [
            "pbkdf2_sha256",
            str(iterations),
            _urlsafe_b64encode(salt),
            _urlsafe_b64encode(derived),
        ]
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations_raw, salt_b64, hash_b64 = password_hash.split("$", maxsplit=3)
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_raw)
        salt = _urlsafe_b64decode(salt_b64)
        expected = _urlsafe_b64decode(hash_b64)
    except (ValueError, TypeError):
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)


def get_password_validation_errors(password: str) -> list[str]:
    errors: list[str] = []
    if len(password) < PASSWORD_MIN_LENGTH:
        errors.append(f"Password must be at least {PASSWORD_MIN_LENGTH} characters long")
    if not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter")
    if not re.search(r"\d", password):
        errors.append("Password must contain at least one number")
    return errors


def validate_password_strength(password: str) -> str:
    errors = get_password_validation_errors(password)
    if errors:
        raise ValueError("; ".join(errors))
    return password


def create_access_token(user_id: str, token_version: int = 0) -> str:
    settings = get_settings()
    payload = {
        "sub": user_id,
        "ver": token_version,
        "exp": int(time.time()) + settings.access_token_ttl_seconds,
    }
    payload_raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_b64 = _urlsafe_b64encode(payload_raw)
    signature = hmac.new(settings.auth_secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).digest()
    signature_b64 = _urlsafe_b64encode(signature)
    return f"{payload_b64}.{signature_b64}"


def decode_access_token(token: str) -> dict | None:
    settings = get_settings()
    try:
        payload_b64, signature_b64 = token.split(".", maxsplit=1)
        expected_signature = hmac.new(
            settings.auth_secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256
        ).digest()
        actual_signature = _urlsafe_b64decode(signature_b64)
        if not hmac.compare_digest(expected_signature, actual_signature):
            return None
        payload_raw = _urlsafe_b64decode(payload_b64)
        payload = json.loads(payload_raw.decode("utf-8"))
        if not isinstance(payload, dict):
            return None
        exp = payload.get("exp")
        sub = payload.get("sub")
        ver = payload.get("ver", 0)
        if not isinstance(exp, int) or not isinstance(sub, str) or not isinstance(ver, int):
            return None
        if exp <= int(time.time()):
            return None
        return payload
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def hash_api_key(raw_api_key: str) -> str:
    settings = get_settings()
    digest = hmac.new(
        settings.auth_secret.encode("utf-8"),
        raw_api_key.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"sha256:{digest}"


def create_api_key() -> tuple[str, str, str, str]:
    public_id = secrets.token_hex(6)
    secret = secrets.token_urlsafe(24)
    raw_api_key = f"{API_KEY_TOKEN_PREFIX}_{public_id}_{secret}"
    key_prefix = f"{API_KEY_TOKEN_PREFIX}_{public_id}"
    key_hint = secret[-4:]
    key_hash = hash_api_key(raw_api_key)
    return raw_api_key, key_prefix, key_hint, key_hash


def parse_api_key_prefix(raw_api_key: str) -> str | None:
    prefix, sep, remainder = raw_api_key.partition("_")
    if prefix != API_KEY_TOKEN_PREFIX or not sep:
        return None
    public_id, sep, _secret = remainder.partition("_")
    if not public_id or not sep:
        return None
    return f"{API_KEY_TOKEN_PREFIX}_{public_id}"


def is_probable_api_key(raw_value: str) -> bool:
    return raw_value.startswith(f"{API_KEY_TOKEN_PREFIX}_")
