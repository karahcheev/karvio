from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.modules.projects.models import User
from app.modules.test_cases.models import TestCase
from app.modules.test_cases.repositories import cases as test_case_repo
from app.modules.report_import.dataset_resolution import resolve_datasets_for_matches
from app.modules.report_import.junit_xml_parser import ParsedJunitCase
from app.modules.report_import.matching import (
    MatchedEntity,
    build_test_case_indexes,
    match_created_case,
    match_project_case,
)
from app.modules.report_import.normalization import normalize_case_name, normalize_suite_path
from app.modules.report_import.schemas.imports import JunitImportCreatedCase, JunitImportIssue
from app.modules.report_import.suite_resolution import build_suite_paths_by_id, ensure_suite_path
from app.modules.report_import.test_case_creation import create_auto_test_case


def _find_parsed_case_for_issue(
    parsed_cases: list[ParsedJunitCase],
    issue: JunitImportIssue,
) -> ParsedJunitCase | None:
    return next(
        (
            item
            for item in parsed_cases
            if item.name == issue.testcase_name
            and item.classname == issue.testcase_classname
            and item.automation_id == issue.automation_id
        ),
        None,
    )


def _register_preview_created_match(
    parsed_case: ParsedJunitCase,
    preview_match: MatchedEntity,
    *,
    created_by_automation_id: dict[str, MatchedEntity],
    created_by_suite_and_name: dict[tuple[tuple[str, ...], str], MatchedEntity],
    created_by_name: dict[str, MatchedEntity],
) -> None:
    normalized_name = normalize_case_name(parsed_case.title)
    normalized_suite_path = normalize_suite_path(parsed_case.suite_path)
    created_by_name[normalized_name] = preview_match
    if normalized_suite_path:
        created_by_suite_and_name[(normalized_suite_path, normalized_name)] = preview_match
    if parsed_case.automation_id:
        created_by_automation_id[parsed_case.automation_id] = preview_match


async def _persist_auto_case_for_unmatched(
    db: AsyncSession,
    *,
    project_id: str,
    parsed_case: ParsedJunitCase,
    issue: JunitImportIssue,
    current_user: User,
    created_by_automation_id: dict[str, MatchedEntity],
    created_by_suite_and_name: dict[tuple[tuple[str, ...], str], MatchedEntity],
    created_by_name: dict[str, MatchedEntity],
    matched_cases: list[tuple[ParsedJunitCase, MatchedEntity]],
    created_cases: list[JunitImportCreatedCase],
    created_count: int,
) -> tuple[int, list[JunitImportIssue]]:
    remaining: list[JunitImportIssue] = []
    try:
        suite_id = None
        try:
            suite_id = await ensure_suite_path(
                db,
                project_id=project_id,
                suite_path=parsed_case.suite_path,
                _current_user=current_user,
            )
        except DomainError:
            suite_id = None
        created_case = await create_auto_test_case(
            db,
            project_id=project_id,
            parsed_case=parsed_case,
            current_user=current_user,
            suite_id=suite_id,
        )
        created_count += 1
        created_match = MatchedEntity(
            test_case_id=created_case.id,
            matched_by="automation_id" if created_case.automation_id else "name",
        )
        matched_cases.append((parsed_case, created_match))
        normalized_name = normalize_case_name(parsed_case.title)
        normalized_suite_path = normalize_suite_path(parsed_case.suite_path)
        created_by_name[normalized_name] = created_match
        if normalized_suite_path:
            created_by_suite_and_name[(normalized_suite_path, normalized_name)] = created_match
        if parsed_case.automation_id:
            created_by_automation_id[parsed_case.automation_id] = created_match
        created_cases.append(
            JunitImportCreatedCase(
                id=created_case.id,
                key=created_case.key,
                title=created_case.title,
                automation_id=created_case.automation_id,
            )
        )
    except DomainError as exc:
        remaining.append(
            JunitImportIssue(
                testcase_name=issue.testcase_name,
                testcase_classname=issue.testcase_classname,
                automation_id=issue.automation_id,
                reason=exc.detail,
            )
        )
    return created_count, remaining


def _append_preview_created_case(
    parsed_case: ParsedJunitCase,
    *,
    created_count: int,
    matched_cases: list[tuple[ParsedJunitCase, MatchedEntity]],
    created_by_automation_id: dict[str, MatchedEntity],
    created_by_suite_and_name: dict[tuple[tuple[str, ...], str], MatchedEntity],
    created_by_name: dict[str, MatchedEntity],
    created_cases: list[JunitImportCreatedCase],
) -> int:
    created_count += 1
    preview_match = MatchedEntity(test_case_id=f"preview-created:{created_count}", matched_by="name")
    matched_cases.append((parsed_case, preview_match))
    _register_preview_created_match(
        parsed_case,
        preview_match,
        created_by_automation_id=created_by_automation_id,
        created_by_suite_and_name=created_by_suite_and_name,
        created_by_name=created_by_name,
    )
    created_cases.append(
        JunitImportCreatedCase(
            title=parsed_case.title,
            automation_id=parsed_case.automation_id,
        )
    )
    return created_count


def match_cases_to_project(
    *,
    parsed_cases: list[ParsedJunitCase],
    project_test_cases: list[TestCase],
    suite_paths_by_id: dict[str, tuple[str, ...]],
) -> tuple[list[tuple[ParsedJunitCase, MatchedEntity]], list[JunitImportIssue], list[JunitImportIssue]]:
    by_automation_id, by_name, by_suite_and_name = build_test_case_indexes(
        project_test_cases,
        suite_paths_by_id=suite_paths_by_id,
    )
    matched: list[tuple[ParsedJunitCase, MatchedEntity]] = []
    unmatched_cases: list[JunitImportIssue] = []
    ambiguous_cases: list[JunitImportIssue] = []
    for parsed_case in parsed_cases:
        matched_case, issue, issue_kind = match_project_case(
            parsed_case,
            by_automation_id=by_automation_id,
            by_name=by_name,
            by_suite_and_name=by_suite_and_name,
        )
        if matched_case is not None:
            matched.append((parsed_case, matched_case))
            continue
        if issue_kind == "ambiguous":
            ambiguous_cases.append(issue)
        else:
            unmatched_cases.append(issue)
    return matched, unmatched_cases, ambiguous_cases


async def resolve_project_matches(
    db: AsyncSession,
    *,
    project_id: str,
    parsed_cases: list[ParsedJunitCase],
    current_user: User,
    create_missing_cases: bool,
    persist_created_cases: bool,
) -> tuple[
    list[tuple[ParsedJunitCase, MatchedEntity]],
    list[JunitImportIssue],
    list[JunitImportIssue],
    int,
    list[JunitImportCreatedCase],
]:
    project_test_cases = await test_case_repo.list_matchable_by_project(db, project_id=project_id)
    suite_paths_by_id = await build_suite_paths_by_id(db, project_id=project_id)
    matched_cases, unmatched_cases, ambiguous_cases = match_cases_to_project(
        parsed_cases=parsed_cases,
        project_test_cases=project_test_cases,
        suite_paths_by_id=suite_paths_by_id,
    )
    created_count = 0
    created_cases: list[JunitImportCreatedCase] = []
    remaining_unmatched: list[JunitImportIssue] = list(unmatched_cases)
    if create_missing_cases and unmatched_cases:
        remaining_unmatched = []
        created_by_automation_id: dict[str, MatchedEntity] = {}
        created_by_suite_and_name: dict[tuple[tuple[str, ...], str], MatchedEntity] = {}
        created_by_name: dict[str, MatchedEntity] = {}
        for issue in unmatched_cases:
            parsed_case = _find_parsed_case_for_issue(parsed_cases, issue)
            if parsed_case is None:
                remaining_unmatched.append(issue)
                continue
            reused_match = match_created_case(
                parsed_case,
                created_by_automation_id=created_by_automation_id,
                created_by_suite_and_name=created_by_suite_and_name,
                created_by_name=created_by_name,
            )
            if reused_match is not None:
                matched_cases.append((parsed_case, reused_match))
                continue
            if not persist_created_cases:
                created_count = _append_preview_created_case(
                    parsed_case,
                    created_count=created_count,
                    matched_cases=matched_cases,
                    created_by_automation_id=created_by_automation_id,
                    created_by_suite_and_name=created_by_suite_and_name,
                    created_by_name=created_by_name,
                    created_cases=created_cases,
                )
                continue
            created_count, extra_remaining = await _persist_auto_case_for_unmatched(
                db,
                project_id=project_id,
                parsed_case=parsed_case,
                issue=issue,
                current_user=current_user,
                created_by_automation_id=created_by_automation_id,
                created_by_suite_and_name=created_by_suite_and_name,
                created_by_name=created_by_name,
                matched_cases=matched_cases,
                created_cases=created_cases,
                created_count=created_count,
            )
            remaining_unmatched.extend(extra_remaining)
    resolved_matches, dataset_unmatched_cases, _created_datasets = await resolve_datasets_for_matches(
        db,
        matched_cases=matched_cases,
        create_missing_cases=create_missing_cases,
        current_user=current_user,
    )
    return resolved_matches, remaining_unmatched + dataset_unmatched_cases, ambiguous_cases, created_count, created_cases
