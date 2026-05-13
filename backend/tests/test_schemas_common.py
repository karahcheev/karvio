from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.common import CursorPage, Timestamped


def test_cursor_page_defaults_next_cursor_to_none() -> None:
    page = CursorPage[int](items=[1, 2, 3])

    assert page.items == [1, 2, 3]
    assert page.next_cursor is None


def test_cursor_page_accepts_explicit_cursor() -> None:
    page = CursorPage[str](items=["a"], next_cursor="next-1")

    assert page.next_cursor == "next-1"


def test_timestamped_parses_iso_datetime_values() -> None:
    model = Timestamped(
        created_at="2026-04-01T10:00:00+00:00",
        updated_at="2026-04-01T11:00:00+00:00",
    )

    assert model.created_at == datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc)
    assert model.updated_at == datetime(2026, 4, 1, 11, 0, tzinfo=timezone.utc)
