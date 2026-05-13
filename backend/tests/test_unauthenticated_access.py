"""Integration tests verifying that all protected endpoints reject unauthenticated requests with 401."""

from __future__ import annotations

import pytest


PROTECTED_ENDPOINTS = [
    ("GET", "/api/v1/environments"),
    ("GET", "/api/v1/test-cases"),
    ("GET", "/api/v1/test-runs"),
    ("GET", "/api/v1/test-plans"),
    ("GET", "/api/v1/products"),
    ("GET", "/api/v1/suites"),
    ("GET", "/api/v1/run-cases"),
    ("GET", "/api/v1/audit-logs"),
    ("GET", "/api/v1/users/me"),
]


@pytest.mark.parametrize("method,path", PROTECTED_ENDPOINTS)
async def test_endpoint_returns_401_without_auth_header(client, method: str, path: str):
    """No Authorization header → 401; the body code must be 'unauthorized' or 'invalid_token'."""
    resp = await client.request(method, path)
    assert resp.status_code == 401, f"{method} {path} should be 401, got {resp.status_code}: {resp.text}"
    code = resp.json().get("code", "")
    assert code in ("unauthorized", "invalid_token", "invalid_api_key"), (
        f"Unexpected error code '{code}' for {method} {path}"
    )


async def test_endpoint_returns_401_with_invalid_bearer_token(client):
    resp = await client.get("/api/v1/products", headers={"Authorization": "Bearer this.is.garbage"})
    assert resp.status_code == 401
    assert resp.json()["code"] == "invalid_token"


async def test_endpoint_returns_401_with_invalid_api_key(client):
    # A string that looks like an API key (starts with prefix) but is wrong
    from app.core.security import API_KEY_TOKEN_PREFIX

    resp = await client.get(
        "/api/v1/products",
        headers={"Authorization": f"Bearer {API_KEY_TOKEN_PREFIX}_fakeid_fakesecret"},
    )
    assert resp.status_code == 401
