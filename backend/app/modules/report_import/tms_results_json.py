from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.domain_strings import TITLE_VALIDATION_ERROR
from app.core.errors import DomainError
from app.modules.report_import.junit_xml_parser import ParsedJunitCase, ParsedJunitReport


class TmsResultsCase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    title: str | None = None
    classname: str | None = None
    suite_path: list[str] = Field(default_factory=list)
    automation_id: str | None = None
    preconditions: str | None = None
    steps: str | None = None
    assertions: str | None = None
    dataset_key: str | None = None
    dataset_name: str | None = None
    dataset_data: dict[str, Any] = Field(default_factory=dict)
    dataset_source_ref: str | None = None
    status: str
    duration_ms: int | None = None
    message: str | None = None
    details: str | None = None
    system_out: str | None = None
    system_err: str | None = None


class TmsResultsPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    format: str | None = None
    version: int | None = None
    run_name: str | None = None
    timestamp: datetime | None = None
    cases: list[TmsResultsCase]


_ALLOWED_STATUS = frozenset({"passed", "failure", "error", "skipped", "xfailed", "xpassed"})


def _require_allowed_tms_case_status(row: TmsResultsCase) -> None:
    if row.status not in _ALLOWED_STATUS:
        raise DomainError(
            status_code=422,
            code="invalid_tms_results_json",
            title=TITLE_VALIDATION_ERROR,
            detail=f"Unsupported testcase status: {row.status!r}",
            errors={"file": [f"status must be one of {sorted(_ALLOWED_STATUS)}"]},
        )


def _require_non_empty_tms_case_name(row: TmsResultsCase) -> str:
    name = row.name.strip()
    if not name:
        raise DomainError(
            status_code=422,
            code="invalid_tms_results_json",
            title=TITLE_VALIDATION_ERROR,
            detail="Each case must have a non-empty name",
            errors={"file": ["empty case name"]},
        )
    return name


def _tms_strip_opt(value: str | None) -> str | None:
    stripped = (value or "").strip()
    return stripped or None


def _parsed_junit_case_from_tms_row(
    row: TmsResultsCase,
    *,
    name: str,
    title: str,
    suite: tuple[str, ...],
) -> ParsedJunitCase:
    return ParsedJunitCase(
        name=name,
        title=title,
        classname=_tms_strip_opt(row.classname),
        suite_path=suite,
        automation_id=_tms_strip_opt(row.automation_id),
        preconditions=_tms_strip_opt(row.preconditions),
        steps=_tms_strip_opt(row.steps),
        assertions=_tms_strip_opt(row.assertions),
        dataset_key=_tms_strip_opt(row.dataset_key),
        dataset_name=_tms_strip_opt(row.dataset_name),
        dataset_data=dict(row.dataset_data),
        dataset_source_ref=_tms_strip_opt(row.dataset_source_ref),
        status=row.status,
        duration_ms=row.duration_ms,
        message=_tms_strip_opt(row.message),
        details=_tms_strip_opt(row.details),
        system_out=_tms_strip_opt(row.system_out),
        system_err=_tms_strip_opt(row.system_err),
    )


def _as_parsed_case(row: TmsResultsCase) -> ParsedJunitCase:
    _require_allowed_tms_case_status(row)
    name = _require_non_empty_tms_case_name(row)
    title = (row.title or name).strip()
    suite = tuple(part.strip() for part in row.suite_path if str(part).strip())
    return _parsed_junit_case_from_tms_row(row, name=name, title=title, suite=suite)


def parse_tms_results_json(content: bytes) -> ParsedJunitReport:
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise DomainError(
            status_code=422,
            code="invalid_tms_results_json",
            title=TITLE_VALIDATION_ERROR,
            detail="Uploaded JSON is not valid UTF-8",
            errors={"file": [str(exc)]},
        ) from exc
    try:
        payload = TmsResultsPayload.model_validate_json(text)
    except Exception as exc:
        raise DomainError(
            status_code=422,
            code="invalid_tms_results_json",
            title=TITLE_VALIDATION_ERROR,
            detail="Uploaded file is not valid Karvio results JSON",
            errors={"file": [str(exc)]},
        ) from exc
    if not payload.cases:
        raise DomainError(
            status_code=422,
            code="invalid_tms_results_json",
            title=TITLE_VALIDATION_ERROR,
            detail="Karvio results JSON must contain a non-empty cases array",
            errors={"file": ["no cases"]},
        )
    parsed = [_as_parsed_case(item) for item in payload.cases]
    return ParsedJunitReport(cases=parsed, run_name=payload.run_name, timestamp=payload.timestamp)


def sniff_report_format(content: bytes) -> Literal["junit_xml", "tms_json"]:
    if not content:
        raise DomainError(
            status_code=422,
            code="empty_upload",
            title=TITLE_VALIDATION_ERROR,
            detail="Uploaded report file is empty",
            errors={"file": ["empty file"]},
        )
    body = content.lstrip()
    if body.startswith(b"\xef\xbb\xbf"):
        body = body[3:].lstrip()
    if not body:
        raise DomainError(
            status_code=422,
            code="empty_upload",
            title=TITLE_VALIDATION_ERROR,
            detail="Uploaded report file is empty",
            errors={"file": ["empty file"]},
        )
    if body[:1] == b"<":
        return "junit_xml"
    if body[:1] in (b"{", b"["):
        return "tms_json"
    raise DomainError(
        status_code=422,
        code="unsupported_report_format",
        title=TITLE_VALIDATION_ERROR,
        detail="Could not detect report format (expected JUnit XML or Karvio JSON)",
        errors={"file": ["unrecognized content"]},
    )


def parse_uploaded_report(content: bytes) -> tuple[ParsedJunitReport, Literal["junit_xml", "tms_json"]]:
    kind = sniff_report_format(content)
    if kind == "junit_xml":
        from app.modules.report_import.junit_xml_parser import parse_junit_xml

        return parse_junit_xml(content), kind
    return parse_tms_results_json(content), kind
