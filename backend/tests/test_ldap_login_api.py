from __future__ import annotations

from unittest.mock import patch

import pytest

from app.core import rate_limit
from app.core.errors import DomainError
from app.models.enums import AuthProviderType, UserRole
from app.modules.auth.ldap.client import LdapError, LdapIdentity
from app.modules.auth.models import AuthProvider, UserExternalIdentity
from app.modules.auth.schemas.auth import LdapLoginRequest
from app.modules.auth.services import ldap_login as svc
from app.modules.projects.models import User


async def _ldap_provider(db_session, **overrides) -> AuthProvider:
    kwargs = dict(
        type=AuthProviderType.ldap,
        name="Corp LDAP",
        login_label="Corporate LDAP",
        enabled=True,
        auto_provision=True,
        new_user_enabled=True,
        default_role=UserRole.user,
        config={
            "server_url": "ldaps://ldap.test:636",
            "base_dn": "dc=test",
            "bind_mode": "service_account",
            "bind_dn": "cn=svc,dc=test",
        },
    )
    kwargs.update(overrides)
    provider = AuthProvider(**kwargs)
    db_session.add(provider)
    await db_session.commit()
    return provider


def _identity(**over) -> LdapIdentity:
    base = dict(
        subject="ldap-uid-1",
        username="jdoe",
        email="jdoe@test.local",
        first_name="John",
        last_name="Doe",
        team="QA",
        groups=[],
    )
    base.update(over)
    return LdapIdentity(**base)


def _patch_auth(identity_or_exc):
    def _fake(provider, username, password):
        if isinstance(identity_or_exc, Exception):
            raise identity_or_exc
        return identity_or_exc

    return patch("app.modules.auth.ldap.client.authenticate", new=_fake)


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    rate_limit.clear_all()
    yield
    rate_limit.clear_all()


@pytest.mark.asyncio
async def test_ldap_login_auto_provisions(db_session):
    provider = await _ldap_provider(db_session)
    payload = LdapLoginRequest(provider_id=provider.id, username="jdoe", password="secret")
    with _patch_auth(_identity()):
        result = await svc.login_ldap(db_session, payload=payload, client_ip="1.2.3.4")
    assert result.user.username == "jdoe"
    assert result.access_token
    identity = await db_session.scalar(
        UserExternalIdentity.__table__.select().where(UserExternalIdentity.subject == "ldap-uid-1")
    )
    assert identity is not None


@pytest.mark.asyncio
async def test_ldap_login_invalid_credentials_is_generic(db_session):
    provider = await _ldap_provider(db_session)
    payload = LdapLoginRequest(provider_id=provider.id, username="jdoe", password="bad")
    with _patch_auth(LdapError("bind failed")), pytest.raises(DomainError) as exc:
        await svc.login_ldap(db_session, payload=payload, client_ip="1.2.3.4")
    assert exc.value.status_code == 401
    assert exc.value.detail == "Unable to sign in with the selected method"


@pytest.mark.asyncio
async def test_ldap_login_blocks_disabled_user(db_session):
    provider = await _ldap_provider(db_session)
    user = User(id="lu1", username="ldapdis", password_hash="h", is_enabled=False)
    db_session.add(user)
    db_session.add(
        UserExternalIdentity(
            user_id="lu1",
            provider_id=provider.id,
            provider_type=AuthProviderType.ldap,
            subject="dis-sub",
        )
    )
    await db_session.commit()
    payload = LdapLoginRequest(provider_id=provider.id, username="ldapdis", password="x")
    with _patch_auth(_identity(subject="dis-sub")), pytest.raises(DomainError) as exc:
        await svc.login_ldap(db_session, payload=payload, client_ip="9.9.9.9")
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_ldap_login_rejects_when_provisioning_disabled(db_session):
    provider = await _ldap_provider(db_session, auto_provision=False)
    payload = LdapLoginRequest(provider_id=provider.id, username="newbie", password="x")
    with _patch_auth(_identity(subject="np", username="newbie")), pytest.raises(DomainError) as exc:
        await svc.login_ldap(db_session, payload=payload, client_ip="9.9.9.10")
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_ldap_login_links_by_email(db_session):
    provider = await _ldap_provider(db_session, allow_email_linking=True)
    existing = User(id="le1", username="existing", password_hash="h", email="match@test.local")
    db_session.add(existing)
    await db_session.commit()
    payload = LdapLoginRequest(provider_id=provider.id, username="existing", password="x")
    with _patch_auth(_identity(subject="link-sub", email="match@test.local")):
        result = await svc.login_ldap(db_session, payload=payload, client_ip="9.9.9.11")
    assert result.user.id == "le1"


@pytest.mark.asyncio
async def test_ldap_login_rate_limited_per_user(db_session):
    provider = await _ldap_provider(db_session)
    payload = LdapLoginRequest(provider_id=provider.id, username="spammer", password="bad")
    with _patch_auth(LdapError("bad")):
        for _ in range(5):
            with pytest.raises(DomainError):
                await svc.login_ldap(db_session, payload=payload, client_ip="5.5.5.5")
        with pytest.raises(DomainError) as exc:
            await svc.login_ldap(db_session, payload=payload, client_ip="5.5.5.5")
    assert exc.value.status_code == 429


async def test_ldap_login_endpoint_sets_session_cookie(client, admin_headers, db_session):
    create = await client.post(
        "/api/v1/auth/providers",
        json={
            "type": "ldap",
            "name": "Corp",
            "enabled": True,
            "config": {
                "server_url": "ldaps://ldap.test:636",
                "base_dn": "dc=test",
                "bind_mode": "service_account",
                "bind_dn": "cn=svc,dc=test",
            },
            "secrets": {"ldap_bind_password": "svcpw"},
        },
        headers=admin_headers,
    )
    assert create.status_code == 201
    provider_id = create.json()["id"]

    with _patch_auth(_identity(subject="api-sub", username="apiuser", email="apiuser@test.local")):
        response = await client.post(
            "/api/v1/auth/login/ldap",
            json={"provider_id": provider_id, "username": "apiuser", "password": "pw"},
        )
    assert response.status_code == 200
    assert "tms_session=" in response.headers.get("set-cookie", "")
    assert response.json()["user"]["username"] == "apiuser"


async def test_ldap_provider_test_runs_connection_checks(client, admin_headers):
    create = await client.post(
        "/api/v1/auth/providers",
        json={
            "type": "ldap",
            "name": "Corp",
            "config": {
                "server_url": "ldaps://ldap.test:636",
                "base_dn": "dc=test",
                "bind_mode": "service_account",
                "bind_dn": "cn=svc,dc=test",
            },
            "secrets": {"ldap_bind_password": "svcpw"},
        },
        headers=admin_headers,
    )
    provider_id = create.json()["id"]
    from app.modules.auth.ldap.client import LdapCheck

    with patch(
        "app.modules.auth.ldap.client.test_connection",
        return_value=[LdapCheck("connect", True), LdapCheck("service_bind", True)],
    ):
        response = await client.post(
            f"/api/v1/auth/providers/{provider_id}/test", headers=admin_headers
        )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert any(c["name"] == "service_bind" and c["passed"] for c in body["checks"])
