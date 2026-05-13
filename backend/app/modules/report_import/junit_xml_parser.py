from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import json
import xml.etree.ElementTree as ET

from app.core.domain_strings import TITLE_VALIDATION_ERROR
from app.core.errors import DomainError


@dataclass(slots=True)
class ParsedJunitCase:
    name: str
    title: str
    classname: str | None
    suite_path: tuple[str, ...]
    automation_id: str | None
    preconditions: str | None
    steps: str | None
    assertions: str | None
    dataset_key: str | None
    dataset_name: str | None
    dataset_data: dict[str, object]
    dataset_source_ref: str | None
    status: str
    duration_ms: int | None
    message: str | None
    details: str | None
    system_out: str | None
    system_err: str | None


@dataclass(slots=True)
class ParsedJunitReport:
    cases: list[ParsedJunitCase]
    run_name: str | None
    timestamp: datetime | None


def _property_map(element: ET.Element | None) -> dict[str, str]:
    if element is None:
        return {}
    properties = element.find("properties")
    if properties is None:
        return {}
    result: dict[str, str] = {}
    for item in properties.findall("property"):
        name = (item.attrib.get("name") or "").strip()
        value = (item.attrib.get("value") or (item.text or "")).strip()
        if name:
            result[name] = value
    return result


def _parse_duration_ms(raw: str | None) -> int | None:
    if raw is None or not raw.strip():
        return None
    try:
        return int(float(raw.strip()) * 1000)
    except ValueError:
        return None


def _parse_timestamp(raw: str | None) -> datetime | None:
    if raw is None or not raw.strip():
        return None
    value = raw.strip()
    if value.endswith("Z"):
        value = f"{value[:-1]}+00:00"
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _parse_suite_path(raw: str | None, *, fallback: tuple[str, ...]) -> tuple[str, ...]:
    if raw is None or not raw.strip():
        return fallback
    value = raw.strip()
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        parsed = None
    if isinstance(parsed, list):
        items = tuple(str(item).strip() for item in parsed if str(item).strip())
        return items or fallback
    parts = tuple(part.strip() for part in value.split("/") if part.strip())
    return parts or fallback


def _parse_json_object(raw: str | None) -> dict[str, object]:
    if raw is None or not raw.strip():
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _junit_case_status_and_details(case: ET.Element) -> tuple[str, ET.Element | None]:
    failure = case.find("failure")
    error = case.find("error")
    skipped = case.find("skipped")
    if failure is not None:
        details_element = failure
    elif error is not None:
        details_element = error
    else:
        details_element = skipped
    if failure is not None:
        status = "failure"
    elif error is not None:
        status = "error"
    elif skipped is not None:
        status = "skipped"
    else:
        status = "passed"
    return status, details_element


def _junit_strip_prop(case_properties: dict[str, str], key: str) -> str | None:
    value = (case_properties.get(key) or "").strip()
    return value or None


def _build_parsed_junit_case(
    case: ET.Element,
    *,
    case_properties: dict[str, str],
    suite_path: tuple[str, ...],
    raw_name: str,
    status: str,
    details_element: ET.Element | None,
) -> ParsedJunitCase:
    title = (case_properties.get("tms_test_title") or raw_name).strip()
    message = (details_element.attrib.get("message") if details_element is not None else None) or None
    details = ((details_element.text or "").strip() or None) if details_element is not None else None
    return ParsedJunitCase(
        name=raw_name,
        title=title,
        classname=(case.attrib.get("classname") or "").strip() or None,
        suite_path=_parse_suite_path(case_properties.get("tms_suite_path"), fallback=suite_path),
        automation_id=case_properties.get("automation_id") or None,
        preconditions=_junit_strip_prop(case_properties, "tms_preconditions"),
        steps=_junit_strip_prop(case_properties, "tms_steps"),
        assertions=_junit_strip_prop(case_properties, "tms_assertions"),
        dataset_key=_junit_strip_prop(case_properties, "tms_dataset_key"),
        dataset_name=_junit_strip_prop(case_properties, "tms_dataset_name"),
        dataset_data=_parse_json_object(case_properties.get("tms_dataset_data")),
        dataset_source_ref=_junit_strip_prop(case_properties, "tms_dataset_source_ref"),
        status=status,
        duration_ms=_parse_duration_ms(case.attrib.get("time")),
        message=message,
        details=details,
        system_out=((case.findtext("system-out") or "").strip() or None),
        system_err=((case.findtext("system-err") or "").strip() or None),
    )


def _parse_case(case: ET.Element, *, inherited_properties: dict[str, str], suite_path: tuple[str, ...]) -> ParsedJunitCase:
    case_properties = {**inherited_properties, **_property_map(case)}
    raw_name = (case.attrib.get("name") or "").strip()
    status, details_element = _junit_case_status_and_details(case)
    return _build_parsed_junit_case(
        case,
        case_properties=case_properties,
        suite_path=suite_path,
        raw_name=raw_name,
        status=status,
        details_element=details_element,
    )


def _collect_cases(
    suite: ET.Element,
    *,
    inherited_properties: dict[str, str],
    parent_suite_path: tuple[str, ...],
    out: list[ParsedJunitCase],
) -> None:
    suite_properties = {**inherited_properties, **_property_map(suite)}
    suite_name = (suite.attrib.get("name") or "").strip()
    suite_path = parent_suite_path + ((suite_name,) if suite_name else ())
    for testcase in suite.findall("testcase"):
        parsed_case = _parse_case(testcase, inherited_properties=suite_properties, suite_path=suite_path)
        if not parsed_case.name:
            raise DomainError(
                status_code=422,
                code="invalid_junit_xml",
                title=TITLE_VALIDATION_ERROR,
                detail="Each testcase in JUnit XML must have a non-empty name",
                errors={"file": ["testcase without a name"]},
            )
        out.append(parsed_case)
    for nested_suite in suite.findall("testsuite"):
        _collect_cases(
            nested_suite,
            inherited_properties=suite_properties,
            parent_suite_path=suite_path,
            out=out,
        )


def parse_junit_xml(content: bytes) -> ParsedJunitReport:
    try:
        root = ET.fromstring(content)
    except ET.ParseError as exc:
        raise DomainError(
            status_code=422,
            code="invalid_junit_xml",
            title=TITLE_VALIDATION_ERROR,
            detail="Uploaded file is not a valid JUnit XML document",
            errors={"file": [str(exc)]},
        ) from exc

    suites: list[ET.Element]
    if root.tag == "testsuite":
        suites = [root]
    elif root.tag == "testsuites":
        suites = root.findall("testsuite")
    else:
        raise DomainError(
            status_code=422,
            code="invalid_junit_xml",
            title=TITLE_VALIDATION_ERROR,
            detail="Root element must be testsuite or testsuites",
            errors={"file": ["unsupported JUnit XML root element"]},
        )

    parsed: list[ParsedJunitCase] = []
    run_name = (root.attrib.get("name") or "").strip() or None
    report_timestamp = _parse_timestamp(root.attrib.get("timestamp"))
    root_suite_path = ((run_name,) if run_name and root.tag == "testsuites" else ())
    for suite in suites:
        run_name = run_name or (suite.attrib.get("name") or "").strip() or None
        report_timestamp = report_timestamp or _parse_timestamp(suite.attrib.get("timestamp"))
        _collect_cases(
            suite,
            inherited_properties=_property_map(root),
            parent_suite_path=root_suite_path,
            out=parsed,
        )
    return ParsedJunitReport(cases=parsed, run_name=run_name, timestamp=report_timestamp)
