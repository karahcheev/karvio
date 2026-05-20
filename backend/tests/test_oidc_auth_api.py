from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.models.enums import AuthProviderType, UserRole
from app.modules.auth.models import AuthProvider, UserExternalIdentity
from app.modules.auth.oidc.discovery import DiscoveryDocument
from app.modules.auth.oidc.flow import complete_login
from app.modules.auth.oidc.transaction import OidcTransaction, serialize
from app.modules.projects.models import User

DISCOVERY = DiscoveryDocument(
    issuer="https://idp.test",
    authorization_endpoint="https://idp.test/authorize",
    token_endpoint="https://idp.test/token",
    jwks_uri="https://idp.test/jwks",
    userinfo_endpoint=None,
    raw={},
)


async def _make_provider(db_session, **overrides) -> AuthProvider:
    kwargs = dict(
        type=AuthProviderType.oidc,
        name="Acme",
        login_label="Acme SSO",
        enabled=True,
        auto_provision=True,
        new_user_enabled=True,
        default_role=UserRole.user,
        config={"issuer": "https://idp.test", "client_id": "client-123"},
    )
    kwargs.update(overrides)
    provider = AuthProvider(**kwargs)
    db_session.add(provider)
    await db_session.commit()
    return provider


def _patches(claims: dict):
    return (
        patch("app.modules.auth.oidc.flow.fetch_discovery", new=AsyncMock(return_value=DISCOVERY)),
        patch("app.modules.auth.oidc.flow.fetch_jwks", new=AsyncMock(return_value={"keys": []})),
        patch(
            "app.modules.auth.oidc.flow._exchange_code",
            new=AsyncMock(return_value={"id_token": "stub"}),
        ),
        patch("app.modules.auth.oidc.flow.verify_id_token", return_value=claims),
    )


def _tx(provider_id: str) -> OidcTransaction:
    return OidcTransaction(
        provider_id=provider_id, state="st", nonce="no", code_verifier="cv", return_to="/dashboard"
    )


@pytest.mark.asyncio
async def test_complete_login_auto_provisions_user(db_session):
    provider = await _make_provider(db_session)
    claims = {"sub": "ext-1", "email": "newuser@acme.test", "given_name": "New", "family_name": "User"}
    p1, p2, p3, p4 = _patches(claims)
    with p1, p2, p3, p4:
        result = await complete_login(
            db_session,
            provider,
            tx=_tx(provider.id),
            query_params={"code": "abc", "state": "st"},
            redirect_uri="https://app.test/cb",
        )
    assert result.user.username
    assert result.user.email == "newuser@acme.test"
    assert result.return_to == "/dashboard"
    identity = await db_session.scalar(
        UserExternalIdentity.__table__.select().where(
            UserExternalIdentity.subject == "ext-1"
        )
    )
    assert identity is not None


@pytest.mark.asyncio
async def test_complete_login_rejects_state_mismatch(db_session):
    provider = await _make_provider(db_session)
    p1, p2, p3, p4 = _patches({"sub": "x"})
    with p1, p2, p3, p4, pytest.raises(Exception) as exc:
        await complete_login(
            db_session,
            provider,
            tx=_tx(provider.id),
            query_params={"code": "abc", "state": "WRONG"},
            redirect_uri="https://app.test/cb",
        )
    assert getattr(exc.value, "status_code", None) == 400


@pytest.mark.asyncio
async def test_complete_login_blocks_disabled_user(db_session):
    provider = await _make_provider(db_session)
    user = User(id="dis1", username="disabled1", password_hash="h", is_enabled=False)
    db_session.add(user)
    db_session.add(
        UserExternalIdentity(
            user_id="dis1",
            provider_id=provider.id,
            provider_type=AuthProviderType.oidc,
            subject="ext-dis",
        )
    )
    await db_session.commit()
    p1, p2, p3, p4 = _patches({"sub": "ext-dis", "email": "disabled1@acme.test"})
    with p1, p2, p3, p4, pytest.raises(Exception) as exc:
        await complete_login(
            db_session,
            provider,
            tx=_tx(provider.id),
            query_params={"code": "abc", "state": "st"},
            redirect_uri="https://app.test/cb",
        )
    assert getattr(exc.value, "status_code", None) == 403


@pytest.mark.asyncio
async def test_complete_login_rejects_when_provisioning_disabled(db_session):
    provider = await _make_provider(db_session, auto_provision=False)
    p1, p2, p3, p4 = _patches({"sub": "ext-np", "email": "nobody@acme.test"})
    with p1, p2, p3, p4, pytest.raises(Exception) as exc:
        await complete_login(
            db_session,
            provider,
            tx=_tx(provider.id),
            query_params={"code": "abc", "state": "st"},
            redirect_uri="https://app.test/cb",
        )
    assert getattr(exc.value, "status_code", None) == 403


@pytest.mark.asyncio
async def test_complete_login_links_by_verified_email(db_session):
    provider = await _make_provider(db_session, allow_email_linking=True)
    existing = User(id="link1", username="existing", password_hash="h", email="match@acme.test")
    db_session.add(existing)
    await db_session.commit()
    claims = {"sub": "ext-link", "email": "match@acme.test", "email_verified": True}
    p1, p2, p3, p4 = _patches(claims)
    with p1, p2, p3, p4:
        result = await complete_login(
            db_session,
            provider,
            tx=_tx(provider.id),
            query_params={"code": "abc", "state": "st"},
            redirect_uri="https://app.test/cb",
        )
    assert result.user.id == "link1"


async def test_oidc_start_redirects_with_transaction_cookie(client, admin_headers, db_session):
    create = await client.post(
        "/api/v1/auth/providers",
        json={
            "type": "oidc",
            "name": "Acme",
            "enabled": True,
            "config": {"issuer": "https://idp.test", "client_id": "client-123"},
            "secrets": {"client_secret": "s3cret"},
        },
        headers=admin_headers,
    )
    assert create.status_code == 201
    provider_id = create.json()["id"]

    with patch("app.modules.auth.oidc.flow.fetch_discovery", new=AsyncMock(return_value=DISCOVERY)):
        response = await client.get(
            f"/api/v1/auth/oidc/{provider_id}/start?return_to=/dashboard"
        )
    assert response.status_code == 303
    assert response.headers["location"].startswith("https://idp.test/authorize?")
    assert "tms_oidc_tx=" in response.headers.get("set-cookie", "")


async def test_oidc_callback_sets_session_and_redirects(client, admin_headers, db_session):
    create = await client.post(
        "/api/v1/auth/providers",
        json={
            "type": "oidc",
            "name": "Acme",
            "enabled": True,
            "config": {"issuer": "https://idp.test", "client_id": "client-123"},
            "secrets": {"client_secret": "s3cret"},
        },
        headers=admin_headers,
    )
    provider_id = create.json()["id"]
    tx_cookie = serialize(
        OidcTransaction(
            provider_id=provider_id, state="st", nonce="no", code_verifier="cv", return_to="/home"
        )
    )
    claims = {"sub": "cb-1", "email": "cbuser@acme.test", "given_name": "Cb"}
    p1, p2, p3, p4 = _patches(claims)
    with p1, p2, p3, p4:
        response = await client.get(
            f"/api/v1/auth/oidc/{provider_id}/callback?code=abc&state=st",
            cookies={"tms_oidc_tx": tx_cookie},
        )
    assert response.status_code == 303
    set_cookie = response.headers.get("set-cookie", "")
    assert "tms_session=" in set_cookie
    assert response.headers["location"].endswith("/home")


async def test_oidc_callback_invalid_transaction_redirects_to_login(client, admin_headers):
    create = await client.post(
        "/api/v1/auth/providers",
        json={
            "type": "oidc",
            "name": "Acme",
            "enabled": True,
            "config": {"issuer": "https://idp.test", "client_id": "client-123"},
            "secrets": {"client_secret": "s3cret"},
        },
        headers=admin_headers,
    )
    provider_id = create.json()["id"]
    response = await client.get(
        f"/api/v1/auth/oidc/{provider_id}/callback?code=abc&state=st",
        cookies={"tms_oidc_tx": "tampered.value"},
    )
    assert response.status_code == 303
    assert "/login?error=auth" in response.headers["location"]
