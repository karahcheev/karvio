from __future__ import annotations

from dataclasses import dataclass

from app.modules.report_import.junit_xml_parser import ParsedJunitCase
from app.modules.report_import.schemas.imports import JunitImportIssue
from app.modules.test_cases.models import TestCase

from app.modules.report_import.normalization import normalize_case_name, normalize_suite_path


@dataclass(slots=True)
class MatchedEntity:
    test_case_id: str
    matched_by: str
    dataset_id: str | None = None


def build_test_case_indexes(
    test_cases: list[TestCase],
    *,
    suite_paths_by_id: dict[str, tuple[str, ...]],
) -> tuple[dict[str, list[TestCase]], dict[str, list[TestCase]], dict[tuple[tuple[str, ...], str], list[TestCase]]]:
    by_automation_id: dict[str, list[TestCase]] = {}
    by_name: dict[str, list[TestCase]] = {}
    by_suite_and_name: dict[tuple[tuple[str, ...], str], list[TestCase]] = {}
    for test_case in test_cases:
        if test_case.automation_id:
            by_automation_id.setdefault(test_case.automation_id, []).append(test_case)
        normalized_name = normalize_case_name(test_case.title)
        by_name.setdefault(normalized_name, []).append(test_case)
        normalized_suite_path = normalize_suite_path(suite_paths_by_id.get(test_case.suite_id or "", ()))
        if normalized_suite_path:
            by_suite_and_name.setdefault((normalized_suite_path, normalized_name), []).append(test_case)
    return by_automation_id, by_name, by_suite_and_name


def match_project_case(
    parsed_case: ParsedJunitCase,
    *,
    by_automation_id: dict[str, list[TestCase]],
    by_name: dict[str, list[TestCase]],
    by_suite_and_name: dict[tuple[tuple[str, ...], str], list[TestCase]],
) -> tuple[MatchedEntity | None, JunitImportIssue | None, str | None]:
    if parsed_case.automation_id:
        automation_matches = by_automation_id.get(parsed_case.automation_id, [])
        if len(automation_matches) == 1:
            return MatchedEntity(test_case_id=automation_matches[0].id, matched_by="automation_id"), None, None
        if len(automation_matches) > 1:
            return None, JunitImportIssue(
                testcase_name=parsed_case.name,
                testcase_classname=parsed_case.classname,
                automation_id=parsed_case.automation_id,
                reason="multiple test cases matched by automation_id",
            ), "ambiguous"

    normalized_name = normalize_case_name(parsed_case.title)
    normalized_suite_path = normalize_suite_path(parsed_case.suite_path)
    if normalized_suite_path:
        suite_name_matches = by_suite_and_name.get((normalized_suite_path, normalized_name), [])
        if len(suite_name_matches) == 1:
            return MatchedEntity(test_case_id=suite_name_matches[0].id, matched_by="name"), None, None
        if len(suite_name_matches) > 1:
            return None, JunitImportIssue(
                testcase_name=parsed_case.name,
                testcase_classname=parsed_case.classname,
                automation_id=parsed_case.automation_id,
                reason="multiple test cases matched by suite and name",
            ), "ambiguous"

    name_matches = by_name.get(normalized_name, [])
    if len(name_matches) == 1:
        return MatchedEntity(test_case_id=name_matches[0].id, matched_by="name"), None, None
    if len(name_matches) > 1:
        return None, JunitImportIssue(
            testcase_name=parsed_case.name,
            testcase_classname=parsed_case.classname,
            automation_id=parsed_case.automation_id,
            reason="multiple test cases matched by name",
        ), "ambiguous"
    return None, JunitImportIssue(
        testcase_name=parsed_case.name,
        testcase_classname=parsed_case.classname,
        automation_id=parsed_case.automation_id,
        reason="no matching test case found",
    ), "unmatched"


def match_created_case(
    parsed_case: ParsedJunitCase,
    *,
    created_by_automation_id: dict[str, MatchedEntity],
    created_by_suite_and_name: dict[tuple[tuple[str, ...], str], MatchedEntity],
    created_by_name: dict[str, MatchedEntity],
) -> MatchedEntity | None:
    if parsed_case.automation_id:
        matched = created_by_automation_id.get(parsed_case.automation_id)
        if matched is not None:
            return matched
    normalized_name = normalize_case_name(parsed_case.title)
    normalized_suite_path = normalize_suite_path(parsed_case.suite_path)
    if normalized_suite_path:
        matched = created_by_suite_and_name.get((normalized_suite_path, normalized_name))
        if matched is not None:
            return matched
    return created_by_name.get(normalized_name)
