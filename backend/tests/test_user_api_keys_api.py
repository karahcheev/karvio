from app.models.enums import ProjectMemberRole
from app.modules.projects.models import Project, ProjectMember, User


async def _create_key(client, headers, *, name: str, description: str | None = None) -> dict:
    payload = {"name": name}
    if description is not None:
        payload["description"] = description
    response = await client.post("/api/v1/users/me/api-keys", json=payload, headers=headers)
    assert response.status_code == 201
    return response.json()


async def test_user_can_create_api_key_and_view_recent_logins(client, auth_headers, auth_user: User):
    created = await _create_key(client, auth_headers, name="CI automation", description="for nightly jobs")
    raw_api_key = created["api_key"]
    key_id = created["key"]["id"]

    assert raw_api_key.startswith("tms2ak_")
    assert created["key"]["name"] == "CI automation"
    assert created["key"]["description"] == "for nightly jobs"

    me_by_api_key = await client.get("/api/v1/auth/me", headers={"X-API-Key": raw_api_key})
    assert me_by_api_key.status_code == 200
    assert me_by_api_key.json()["id"] == auth_user.id

    listed = await client.get("/api/v1/users/me/api-keys", headers=auth_headers)
    assert listed.status_code == 200
    items = listed.json()["items"]
    target = next(item for item in items if item["id"] == key_id)
    assert target["last_used_at"] is not None
    assert any(item["request_path"] == "/api/v1/auth/me" for item in target["recent_logins"])


async def test_api_key_regenerate_invalidates_previous_key(client, auth_headers, auth_user: User):
    created = await _create_key(client, auth_headers, name="Deploy")
    key_id = created["key"]["id"]
    first_key = created["api_key"]

    regenerated = await client.post(f"/api/v1/users/me/api-keys/{key_id}/regenerate", headers=auth_headers)
    assert regenerated.status_code == 200
    second_key = regenerated.json()["api_key"]
    assert second_key != first_key

    old_key_auth = await client.get("/api/v1/auth/me", headers={"X-API-Key": first_key})
    assert old_key_auth.status_code == 401
    assert old_key_auth.json()["code"] == "invalid_api_key"

    new_key_auth = await client.get("/api/v1/auth/me", headers={"X-API-Key": second_key})
    assert new_key_auth.status_code == 200
    assert new_key_auth.json()["id"] == auth_user.id


async def test_api_key_can_be_patched_and_deleted(client, auth_headers):
    created = await _create_key(client, auth_headers, name="Old", description="old desc")
    key_id = created["key"]["id"]

    patched = await client.patch(
        f"/api/v1/users/me/api-keys/{key_id}",
        json={"name": "New Name", "description": ""},
        headers=auth_headers,
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == "New Name"
    assert patched.json()["description"] is None

    deleted = await client.delete(f"/api/v1/users/me/api-keys/{key_id}", headers=auth_headers)
    assert deleted.status_code == 204

    listed = await client.get("/api/v1/users/me/api-keys", headers=auth_headers)
    assert listed.status_code == 200
    assert all(item["id"] != key_id for item in listed.json()["items"])


async def test_client_can_use_new_api_key_on_protected_routes(client, auth_headers):
    """A newly created key is accepted by the same auth pipeline as the session on regular API routes."""
    created = await _create_key(client, auth_headers, name="API access smoke")
    raw_api_key = created["api_key"]
    api_headers = {"X-API-Key": raw_api_key}

    by_api_key = await client.get("/api/v1/projects", headers=api_headers)
    assert by_api_key.status_code == 200

    by_session = await client.get("/api/v1/projects", headers=auth_headers)
    assert by_session.status_code == 200
    assert by_api_key.json() == by_session.json()


async def test_api_key_create_test_case_defaults_owner_to_key_user(client, db_session, auth_headers, auth_user: User):
    created = await _create_key(client, auth_headers, name="Case creator")
    raw_api_key = created["api_key"]
    api_headers = {"X-API-Key": raw_api_key}
    project = Project(id="proj_api_key_owner", name="API Key Owner")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    db_session.add_all([project, membership])
    await db_session.commit()

    response = await client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project.id,
            "title": "Created via key",
        },
        headers=api_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["owner_id"] == auth_user.id
    assert body["owner_name"] == auth_user.username


async def test_user_can_create_many_api_keys(client, auth_headers):
    for index in range(8):
        await _create_key(client, auth_headers, name=f"Key {index + 1}")

    listed = await client.get("/api/v1/users/me/api-keys", headers=auth_headers)
    assert listed.status_code == 200
    assert len(listed.json()["items"]) >= 8
