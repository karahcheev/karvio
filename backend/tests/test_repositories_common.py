from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import column, select, table

from app.repositories import common


def test_to_cursor_serializes_datetime_and_scalar() -> None:
    dt = datetime(2026, 4, 3, 10, 0, tzinfo=timezone.utc)
    assert common.to_cursor(dt) == dt.isoformat()
    assert common.to_cursor("abc") == "abc"


def test_encode_decode_composite_cursor_for_scalar_types() -> None:
    values = [
        datetime(2026, 4, 3, 10, 0, tzinfo=timezone.utc),
        "value",
        42,
        1.5,
        True,
    ]
    for value in values:
        encoded = common.encode_composite_cursor(value, "row-1")
        decoded_value, row_id = common.decode_composite_cursor(encoded)
        assert row_id == "row-1"
        assert decoded_value == value


def test_apply_composite_cursor_returns_original_without_cursor() -> None:
    t = table("items", column("id"), column("name"))
    stmt = select(t)
    out = common.apply_composite_cursor(
        stmt,
        cursor=None,
        sort_value_expr=t.c.name,
        row_id_expr=t.c.id,
        direction="asc",
    )
    assert out is stmt


def test_apply_composite_cursor_adds_where_for_asc_and_desc() -> None:
    t = table("items", column("id"), column("created_at"))
    base = select(t)
    cursor = common.encode_composite_cursor("2026-04-03T10:00:00+00:00", "row-1")
    asc_stmt = common.apply_composite_cursor(
        base,
        cursor=cursor,
        sort_value_expr=t.c.created_at,
        row_id_expr=t.c.id,
        direction="asc",
    )
    desc_stmt = common.apply_composite_cursor(
        base,
        cursor=cursor,
        sort_value_expr=t.c.created_at,
        row_id_expr=t.c.id,
        direction="desc",
    )
    assert len(asc_stmt._where_criteria) == 1
    assert len(desc_stmt._where_criteria) == 1
