from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import httpx

_DISCOVERY_TTL_SECONDS = 3600
_JWKS_TTL_SECONDS = 3600

_discovery_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_jwks_cache: dict[str, tuple[float, dict[str, Any]]] = {}

DEFAULT_TIMEOUT = 10.0


class OidcDiscoveryError(Exception):
    """Raised when the provider discovery document or JWKS cannot be loaded."""


@dataclass(slots=True)
class DiscoveryDocument:
    issuer: str
    authorization_endpoint: str
    token_endpoint: str
    jwks_uri: str
    userinfo_endpoint: str | None
    raw: dict[str, Any]


async def _get_json(url: str, *, timeout: float) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(url, headers={"Accept": "application/json"})
    if response.status_code != 200:
        raise OidcDiscoveryError(f"HTTP {response.status_code} from {url}")
    try:
        data = response.json()
    except ValueError as exc:
        raise OidcDiscoveryError(f"Invalid JSON from {url}") from exc
    if not isinstance(data, dict):
        raise OidcDiscoveryError(f"Unexpected payload from {url}")
    return data


async def fetch_discovery(
    discovery_url: str, *, timeout: float = DEFAULT_TIMEOUT, use_cache: bool = True
) -> DiscoveryDocument:
    now = time.time()
    if use_cache:
        cached = _discovery_cache.get(discovery_url)
        if cached and cached[0] > now:
            data = cached[1]
            return _to_document(data)
    data = await _get_json(discovery_url, timeout=timeout)
    for key in ("issuer", "authorization_endpoint", "token_endpoint", "jwks_uri"):
        if not isinstance(data.get(key), str) or not data[key]:
            raise OidcDiscoveryError(f"Discovery document missing '{key}'")
    _discovery_cache[discovery_url] = (now + _DISCOVERY_TTL_SECONDS, data)
    return _to_document(data)


def _to_document(data: dict[str, Any]) -> DiscoveryDocument:
    return DiscoveryDocument(
        issuer=data["issuer"],
        authorization_endpoint=data["authorization_endpoint"],
        token_endpoint=data["token_endpoint"],
        jwks_uri=data["jwks_uri"],
        userinfo_endpoint=data.get("userinfo_endpoint"),
        raw=data,
    )


async def fetch_jwks(
    jwks_uri: str, *, timeout: float = DEFAULT_TIMEOUT, use_cache: bool = True
) -> dict[str, Any]:
    now = time.time()
    if use_cache:
        cached = _jwks_cache.get(jwks_uri)
        if cached and cached[0] > now:
            return cached[1]
    data = await _get_json(jwks_uri, timeout=timeout)
    if not isinstance(data.get("keys"), list):
        raise OidcDiscoveryError("JWKS document missing 'keys'")
    _jwks_cache[jwks_uri] = (now + _JWKS_TTL_SECONDS, data)
    return data


def clear_caches() -> None:
    _discovery_cache.clear()
    _jwks_cache.clear()
