from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Generic, Literal, TypeVar

from sqlalchemy import and_, or_
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.sql import Select

T = TypeVar("T")
CursorValue = datetime | str
CursorScalar = datetime | str | int | float | bool
SortDirection = Literal["asc", "desc"]


@dataclass(slots=True)
class Page(Generic[T]):
    items: list[T]
    next_cursor: str | None = None


@dataclass(slots=True)
class OffsetPage(Generic[T]):
    items: list[T]
    page: int
    page_size: int
    has_next: bool
    """Total rows matching the same filters (list endpoints may omit)."""
    total: int | None = None


def to_cursor(value: CursorValue) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _encode_cursor_scalar(value: CursorScalar) -> dict[str, Any]:
    if isinstance(value, datetime):
        return {"type": "datetime", "value": value.isoformat()}
    if isinstance(value, bool):
        return {"type": "bool", "value": value}
    if isinstance(value, int):
        return {"type": "int", "value": value}
    if isinstance(value, float):
        return {"type": "float", "value": value}
    return {"type": "str", "value": value}


def _decode_cursor_scalar(payload: dict[str, Any]) -> CursorScalar:
    value_type = payload["type"]
    value = payload["value"]
    if value_type == "datetime":
        return datetime.fromisoformat(value)
    if value_type == "bool":
        return bool(value)
    if value_type == "int":
        return int(value)
    if value_type == "float":
        return float(value)
    return str(value)


def encode_composite_cursor(value: CursorScalar, row_id: str) -> str:
    payload = {
        "row_id": row_id,
        "value": _encode_cursor_scalar(value),
    }
    encoded = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    return encoded.decode("ascii").rstrip("=")


def decode_composite_cursor(cursor: str) -> tuple[CursorScalar, str]:
    padding = "=" * (-len(cursor) % 4)
    payload = json.loads(base64.urlsafe_b64decode(f"{cursor}{padding}").decode("utf-8"))
    return _decode_cursor_scalar(payload["value"]), str(payload["row_id"])


def apply_composite_cursor(
    stmt: Select,
    *,
    cursor: str | None,
    sort_value_expr: ColumnElement[Any],
    row_id_expr: ColumnElement[Any],
    direction: SortDirection,
) -> Select:
    if not cursor:
        return stmt

    cursor_value, row_id = decode_composite_cursor(cursor)
    value_comparison = sort_value_expr > cursor_value if direction == "asc" else sort_value_expr < cursor_value
    id_comparison = row_id_expr > row_id if direction == "asc" else row_id_expr < row_id
    return stmt.where(or_(value_comparison, and_(sort_value_expr == cursor_value, id_comparison)))
