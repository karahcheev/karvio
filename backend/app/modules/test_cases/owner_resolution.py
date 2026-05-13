from __future__ import annotations

from app.modules.projects.models import User


def resolve_owner_id(owner_id: str | None, *, current_user: User) -> str:
    """Return explicit owner_id or default to the acting user."""
    return owner_id if owner_id is not None else current_user.id


def resolve_create_owner_id(
    *,
    owner_id_was_set_on_payload: bool,
    owner_id: str | None,
    current_user: User,
) -> str | None:
    """Create payload: omitted owner_id defaults to current user; explicit null leaves the case unassigned."""
    if not owner_id_was_set_on_payload:
        return current_user.id
    return owner_id
