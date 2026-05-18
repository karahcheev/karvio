from __future__ import annotations

import re

from app.core.errors import DomainError


def normalize_case_name(value: str) -> str:
    normalized = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", value)
    normalized = normalized.replace("_", " ").replace("-", " ")
    normalized = re.sub(r"\btest\b", " ", normalized, flags=re.IGNORECASE)
    return " ".join(normalized.split()).strip().casefold()


def normalize_suite_part(value: str) -> str:
    return normalize_case_name(value)


def normalize_suite_path(value: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(part for part in (normalize_suite_part(item) for item in value) if part)


def require_non_empty_content(content: bytes) -> bytes:
    if content:
        return content
    raise DomainError(
        status_code=422,
        code="empty_upload",
        title="Validation error",
        detail="Uploaded report file is empty",
        errors={"file": ["empty file"]},
    )
