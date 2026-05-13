from __future__ import annotations

from datetime import datetime, timezone
import aiofiles

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ProjectMemberRole, TestRunStatus
from app.modules.projects.models import User
from app.modules.test_runs.repositories import run_items as run_item_repo
from app.services.access import ensure_project_role
from app.modules.report_import.import_persistence import PersistImportParams, persist_import
from app.modules.report_import.matching import MatchedEntity
from app.modules.report_import.normalization import require_non_empty_content
from app.modules.report_import.tms_results_json import parse_uploaded_report
from app.modules.report_import.project_matching import resolve_project_matches
from app.modules.report_import.run_application import apply_cases_to_run
from app.modules.report_import.schemas.imports import (
    JunitImportIssue,
    JunitImportRead,
    JunitImportSummary,
    JunitImportTargetRun,
    JunitXmlUpload,
)
from app.modules.report_import.target_run import (
    choose_target_run_name,
    create_target_run,
    ensure_run_accepts_import,
    find_matching_run,
    get_run_or_404,
)
from app.modules.report_import.junit_xml_parser import ParsedJunitCase


def _junit_issue_reasons_when_no_create_missing(
    unmatched_cases: list[JunitImportIssue],
    ambiguous_cases: list[JunitImportIssue],
) -> tuple[list[JunitImportIssue], list[JunitImportIssue]]:
    unmatched_cases = [
        issue.model_copy(update={"reason": "no matching run item found"}) for issue in unmatched_cases
    ]
    ambiguous_cases = [
        issue.model_copy(
            update={
                "reason": (
                    "multiple run items matched by automation_id"
                    if issue.reason.endswith("automation_id")
                    else "multiple run items matched by name"
                )
            }
        )
        for issue in ambiguous_cases
    ]
    return unmatched_cases, ambiguous_cases


async def _filter_matched_to_run_items(
    db: AsyncSession,
    *,
    test_run_id: str,
    matched: list[tuple[ParsedJunitCase, MatchedEntity]],
    summary: JunitImportSummary,
    unmatched_cases: list[JunitImportIssue],
) -> list[tuple[ParsedJunitCase, MatchedEntity]]:
    filtered_matched: list[tuple[ParsedJunitCase, MatchedEntity]] = []
    for parsed_case, matched_case in matched:
        run_item = await run_item_repo.get_by_run_and_case(
            db,
            test_run_id=test_run_id,
            test_case_id=matched_case.test_case_id,
        )
        if run_item:
            filtered_matched.append((parsed_case, matched_case))
            continue
        summary.unmatched += 1
        summary.unmatched -= 0
        if matched_case.matched_by == "automation_id":
            summary.matched_by_automation_id = max(0, summary.matched_by_automation_id - 1)
        else:
            summary.matched_by_name = max(0, summary.matched_by_name - 1)
        unmatched_cases.append(
            JunitImportIssue(
                testcase_name=parsed_case.name,
                testcase_classname=parsed_case.classname,
                automation_id=parsed_case.automation_id,
                reason="matching test case is not part of the target run",
            )
        )
    return filtered_matched


def _preview_dry_run_match_counts(
    summary: JunitImportSummary,
    matched: list[tuple[ParsedJunitCase, MatchedEntity]],
) -> None:
    for _, matched_case in matched:
        if matched_case.matched_by == "automation_id":
            summary.matched_by_automation_id += 1
        else:
            summary.matched_by_name += 1


async def _load_upload_content(upload: JunitXmlUpload) -> bytes:
    if upload.content is not None:
        return require_non_empty_content(upload.content)
    assert upload.path is not None
    async with aiofiles.open(upload.path, "rb") as in_file:
        content = await in_file.read()
    return require_non_empty_content(content)


async def import_junit_xml(
    db: AsyncSession,
    *,
    test_run_id: str,
    upload: JunitXmlUpload,
    dry_run: bool,
    create_missing_cases: bool,
    current_user: User,
) -> JunitImportRead:
    run = await get_run_or_404(db, test_run_id)
    await ensure_project_role(db, current_user, run.project_id, ProjectMemberRole.tester)
    ensure_run_accepts_import(run)

    content = await _load_upload_content(upload)
    report, kind = parse_uploaded_report(content)
    source_filename = upload.filename or ("report.json" if kind == "tms_json" else "junit.xml")
    matched, unmatched_cases, ambiguous_cases, created_test_cases, created_cases = await resolve_project_matches(
        db,
        project_id=run.project_id,
        parsed_cases=report.cases,
        current_user=current_user,
        create_missing_cases=create_missing_cases,
        persist_created_cases=not dry_run,
    )
    summary = JunitImportSummary(
        total_cases=len(report.cases),
        unmatched=len(unmatched_cases),
        ambiguous=len(ambiguous_cases),
        created_test_cases=created_test_cases,
    )
    error_cases: list[JunitImportIssue] = []

    if not create_missing_cases:
        unmatched_cases, ambiguous_cases = _junit_issue_reasons_when_no_create_missing(
            unmatched_cases,
            ambiguous_cases,
        )

    if not create_missing_cases:
        matched = await _filter_matched_to_run_items(
            db,
            test_run_id=run.id,
            matched=matched,
            summary=summary,
            unmatched_cases=unmatched_cases,
        )

    if not dry_run:
        if run.status == TestRunStatus.not_started:
            run.status = TestRunStatus.in_progress
            run.started_at = datetime.now(timezone.utc)
        run_summary, error_cases = await apply_cases_to_run(
            db,
            run=run,
            matched_cases=matched,
            current_user=current_user,
        )
        summary.matched_by_automation_id += run_summary.matched_by_automation_id
        summary.matched_by_name += run_summary.matched_by_name
        summary.updated += run_summary.updated
        summary.errors += run_summary.errors
        status = "completed" if not error_cases else "partial"
    else:
        _preview_dry_run_match_counts(summary, matched)
        status = "preview"

    target_run = JunitImportTargetRun(id=run.id, name=run.name, match_mode="existing")
    return await persist_import(
        db,
        params=PersistImportParams(
            run=run,
            source_filename=source_filename,
            source_content_type=upload.content_type,
            content=content,
            current_user=current_user,
            dry_run=dry_run,
            status=status,
            summary=summary,
            created_cases=created_cases,
            unmatched_cases=unmatched_cases,
            ambiguous_cases=ambiguous_cases,
            error_cases=error_cases,
            target_run=target_run,
        ),
    )


async def import_junit_xml_for_project(
    db: AsyncSession,
    *,
    project_id: str,
    upload: JunitXmlUpload,
    create_missing_cases: bool,
    current_user: User,
) -> JunitImportRead:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.tester)
    content = await _load_upload_content(upload)
    report, kind = parse_uploaded_report(content)
    source_filename = upload.filename or ("report.json" if kind == "tms_json" else "junit.xml")
    run_name = choose_target_run_name(report, source_filename)
    existing_run = await find_matching_run(db, project_id=project_id, run_name=run_name, report_timestamp=report.timestamp)
    run = existing_run or await create_target_run(db, project_id=project_id, run_name=run_name, current_user=current_user)
    ensure_run_accepts_import(run)

    matched_cases, unmatched_cases, ambiguous_cases, created_test_cases, created_cases = await resolve_project_matches(
        db,
        project_id=project_id,
        parsed_cases=report.cases,
        current_user=current_user,
        create_missing_cases=create_missing_cases,
        persist_created_cases=True,
    )
    summary, error_cases = await apply_cases_to_run(
        db,
        run=run,
        matched_cases=matched_cases,
        current_user=current_user,
    )
    summary.total_cases = len(report.cases)
    summary.created_test_cases = created_test_cases
    summary.unmatched = len(unmatched_cases)
    summary.ambiguous = len(ambiguous_cases)

    target_run = JunitImportTargetRun(
        id=run.id,
        name=run.name,
        match_mode="existing" if existing_run else "created",
    )
    return await persist_import(
        db,
        params=PersistImportParams(
            run=run,
            source_filename=source_filename,
            source_content_type=upload.content_type,
            content=content,
            current_user=current_user,
            dry_run=False,
            status="completed" if not error_cases else "partial",
            summary=summary,
            created_cases=created_cases,
            unmatched_cases=unmatched_cases,
            ambiguous_cases=ambiguous_cases,
            error_cases=error_cases,
            target_run=target_run,
        ),
    )
