from __future__ import annotations

from app.models.enums import AuthProviderType
from app.modules.auth.models import AuthProvider
from app.modules.projects.models import User


async def _seed_local(db_session, *, enabled=True, admin_only=False, label="Username and password"):
    provider = AuthProvider(
        type=AuthProviderType.local,
        name="Local",
        login_label=label,
        enabled=enabled,
        sort_order=0,
        auto_provision=False,
        local_admin_only=admin_only,
        config={},
    )
    db_session.add(provider)
    await db_session.commit()
    return provider


def _oidc_payload(**overrides):
    payload = {
        "type": "oidc",
        "name": "Acme SSO",
        "login_label": "Continue with Acme",
        "sort_order": 10,
        "config": {
            "issuer": "https://idp.acme.test",
            "client_id": "acme-client",
        },
        "secrets": {"client_secret": "super-secret-value"},
    }
    payload.update(overrides)
    return payload


async def test_providers_require_admin(client, auth_headers):
    response = await client.get("/api/v1/auth/providers", headers=auth_headers)
    assert response.status_code == 403


async def test_unauthenticated_cannot_list_providers(client):
    response = await client.get("/api/v1/auth/providers")
    assert response.status_code == 401


async def test_create_provider_secret_is_write_only(client, admin_headers):
    response = await client.post(
        "/api/v1/auth/providers", json=_oidc_payload(), headers=admin_headers
    )
    assert response.status_code == 201
    body = response.json()
    serialized = response.text
    assert "super-secret-value" not in serialized
    assert body["secrets"]["client_secret_configured"] is True
    assert body["config"]["client_id"] == "acme-client"
    assert "client_secret" not in body["config"]
    assert body["status"] == "disabled"

    detail = await client.get(f"/api/v1/auth/providers/{body['id']}", headers=admin_headers)
    assert "super-secret-value" not in detail.text
    assert detail.json()["secrets"]["client_secret_configured"] is True


async def test_cannot_create_local_provider(client, admin_headers):
    response = await client.post(
        "/api/v1/auth/providers",
        json={"type": "local", "name": "Local"},
        headers=admin_headers,
    )
    assert response.status_code == 409


async def test_enable_misconfigured_provider_rejected(client, admin_headers):
    payload = _oidc_payload(enabled=True, secrets={})
    response = await client.post(
        "/api/v1/auth/providers", json=payload, headers=admin_headers
    )
    assert response.status_code == 422


async def test_update_enable_and_rotate_secret(client, admin_headers):
    created = await client.post(
        "/api/v1/auth/providers", json=_oidc_payload(), headers=admin_headers
    )
    provider_id = created.json()["id"]

    enabled = await client.patch(
        f"/api/v1/auth/providers/{provider_id}",
        json={"enabled": True},
        headers=admin_headers,
    )
    assert enabled.status_code == 200
    assert enabled.json()["status"] == "enabled"

    rotated = await client.post(
        f"/api/v1/auth/providers/{provider_id}/rotate-secret",
        json={"secret_name": "client_secret", "value": None},
        headers=admin_headers,
    )
    assert rotated.status_code == 200
    assert rotated.json()["secrets"]["client_secret_configured"] is False


async def test_delete_non_local_and_protect_local(client, admin_headers, db_session):
    local = await _seed_local(db_session)
    created = await client.post(
        "/api/v1/auth/providers", json=_oidc_payload(), headers=admin_headers
    )
    provider_id = created.json()["id"]

    deleted = await client.delete(
        f"/api/v1/auth/providers/{provider_id}", headers=admin_headers
    )
    assert deleted.status_code == 204

    protected = await client.delete(
        f"/api/v1/auth/providers/{local.id}", headers=admin_headers
    )
    assert protected.status_code == 409


async def test_cannot_disable_last_admin_path(client, admin_headers, db_session):
    local = await _seed_local(db_session)
    response = await client.patch(
        f"/api/v1/auth/providers/{local.id}",
        json={"enabled": False},
        headers=admin_headers,
    )
    assert response.status_code == 409


async def test_public_config_is_sanitized(client, admin_headers, db_session):
    await _seed_local(db_session, label="Sign in with credentials")
    created = await client.post(
        "/api/v1/auth/providers", json=_oidc_payload(), headers=admin_headers
    )
    provider_id = created.json()["id"]
    await client.patch(
        f"/api/v1/auth/providers/{provider_id}",
        json={"enabled": True},
        headers=admin_headers,
    )

    response = await client.get("/api/v1/auth/config")
    assert response.status_code == 200
    body = response.json()
    assert body["local_login"] == {"enabled": True, "label": "Sign in with credentials"}
    assert len(body["providers"]) == 1
    public = body["providers"][0]
    assert public["type"] == "oidc"
    assert public["label"] == "Continue with Acme"
    # No sensitive provider configuration is leaked.
    assert "issuer" not in response.text
    assert "acme-client" not in response.text
    assert "client_secret" not in response.text


async def test_public_config_defaults_when_no_local_row(client):
    response = await client.get("/api/v1/auth/config")
    assert response.status_code == 200
    body = response.json()
    assert body["local_login"]["enabled"] is True
    assert body["local_login"]["label"] == "Username and password"


async def test_local_login_disabled_blocks_login(client, db_session):
    await _seed_local(db_session, enabled=False)
    user = User(id="u_local_off", username="localoff", password_hash=_pw())
    db_session.add(user)
    await db_session.commit()

    response = await client.post(
        "/api/v1/auth/login", json={"username": "localoff", "password": "password123"}
    )
    assert response.status_code == 403


async def test_local_admin_only_allows_admin_blocks_user(client, db_session):
    await _seed_local(db_session, admin_only=True)
    from app.models.enums import UserRole

    regular = User(id="u_reg", username="reguser", password_hash=_pw())
    admin = User(id="u_adm", username="admuser", password_hash=_pw(), role=UserRole.admin)
    db_session.add_all([regular, admin])
    await db_session.commit()

    blocked = await client.post(
        "/api/v1/auth/login", json={"username": "reguser", "password": "password123"}
    )
    assert blocked.status_code == 403

    allowed = await client.post(
        "/api/v1/auth/login", json={"username": "admuser", "password": "password123"}
    )
    assert allowed.status_code == 200


def _pw() -> str:
    from app.core.security import hash_password

    return hash_password("password123")
