"""JSON export for reports."""

from __future__ import annotations

import json


def serialize_report_json(payload: dict) -> tuple[bytes, str, str]:
    """Serializes payload to JSON. Returns (content, media_type, extension)."""
    content = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    return content, "application/json", "json"
