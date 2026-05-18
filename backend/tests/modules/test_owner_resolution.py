from __future__ import annotations

from types import SimpleNamespace

from app.modules.test_cases.owner_resolution import resolve_create_owner_id, resolve_owner_id


async def test_resolve_owner_id_uses_explicit_value() -> None:
    user = SimpleNamespace(id="u1")
    assert resolve_owner_id("other", current_user=user) == "other"


async def test_resolve_owner_id_defaults_to_current_user() -> None:
    user = SimpleNamespace(id="u1")
    assert resolve_owner_id(None, current_user=user) == "u1"


async def test_resolve_create_owner_id_omitted_defaults_to_current_user() -> None:
    user = SimpleNamespace(id="u1")
    assert (
        resolve_create_owner_id(owner_id_was_set_on_payload=False, owner_id=None, current_user=user) == "u1"
    )


async def test_resolve_create_owner_id_explicit_null_unassigned() -> None:
    user = SimpleNamespace(id="u1")
    assert resolve_create_owner_id(owner_id_was_set_on_payload=True, owner_id=None, current_user=user) is None


async def test_resolve_create_owner_id_explicit_value() -> None:
    user = SimpleNamespace(id="u1")
    assert (
        resolve_create_owner_id(owner_id_was_set_on_payload=True, owner_id="u2", current_user=user) == "u2"
    )
