from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from pydantic import BaseModel, Field


@dataclass(frozen=True, slots=True)
class JunitXmlUpload:
    """Upload payload + metadata for junit import service (transport-agnostic)."""

    content: bytes | None = None
    path: Path | None = None
    filename: str | None = None
    content_type: str | None = None

    def __post_init__(self) -> None:
        has_content = self.content is not None
        has_path = self.path is not None
        if has_content == has_path:
            raise ValueError("JunitXmlUpload must have exactly one of content or path")


class JunitImportIssue(BaseModel):
    testcase_name: str
    testcase_classname: str | None = None
    automation_id: str | None = None
    reason: str


class JunitImportCreatedCase(BaseModel):
    id: str | None = None
    key: str | None = None
    title: str
    automation_id: str | None = None


class JunitImportSummary(BaseModel):
    total_cases: int = 0
    matched_by_automation_id: int = 0
    matched_by_name: int = 0
    created_test_cases: int = 0
    updated: int = 0
    unmatched: int = 0
    ambiguous: int = 0
    errors: int = 0


class JunitImportTargetRun(BaseModel):
    id: str | None = None
    name: str
    match_mode: str


class JunitImportRead(BaseModel):
    id: str
    test_run_id: str
    target_run: JunitImportTargetRun | None = None
    source_filename: str
    source_content_type: str | None = None
    dry_run: bool
    status: str
    summary: JunitImportSummary
    created_cases: list[JunitImportCreatedCase] = Field(default_factory=list)
    unmatched_cases: list[JunitImportIssue] = Field(default_factory=list)
    ambiguous_cases: list[JunitImportIssue] = Field(default_factory=list)
    error_cases: list[JunitImportIssue] = Field(default_factory=list)
    created_at: datetime

    model_config = {"from_attributes": True}
