from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass(slots=True)
class ParsedPerformancePayload:
    adapter: str
    adapter_version: str
    confidence: float
    found: list[str]
    missing: list[str]
    parse_status: str
    issues: list[str]
    load_kind: str
    tool: str
    service: str
    env: str
    scenario: str
    load_profile: str
    branch: str
    commit: str
    build: str
    version: str
    started_at: datetime | None
    finished_at: datetime | None
    summary: dict[str, Any]
    transactions: list[dict[str, Any]] = field(default_factory=list)
    errors: list[dict[str, Any]] = field(default_factory=list)
    environment_snapshot: dict[str, Any] = field(default_factory=dict)
