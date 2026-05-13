from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.models.enums import RunItemStatus, TestRunStatus
from app.modules.projects.models import User
from app.modules.test_runs.models import RunCaseRow, RunItem, TestRun
from app.modules.test_runs.repositories import run_items as run_item_repo
from app.modules.test_runs.services import run_cases
from app.modules.report_import.junit_xml_parser import ParsedJunitCase
from app.modules.report_import.matching import MatchedEntity
from app.modules.report_import.schemas.imports import JunitImportIssue, JunitImportSummary


def map_junit_status(value: str) -> RunItemStatus:
    if value == "passed":
        return RunItemStatus.passed
    if value == "failure":
        return RunItemStatus.failure
    if value == "error":
        return RunItemStatus.error
    if value == "skipped":
        return RunItemStatus.skipped
    if value == "xfailed":
        return RunItemStatus.xfailed
    if value == "xpassed":
        return RunItemStatus.xpassed
    raise DomainError(
        status_code=422,
        code="unsupported_junit_status",
        title="Validation error",
        detail=f"Unsupported JUnit testcase status: {value}",
    )


def build_comment(parsed_case: ParsedJunitCase) -> str | None:
    if parsed_case.message and parsed_case.details:
        return f"{parsed_case.message}\n\n{parsed_case.details}".strip()
    return parsed_case.message or parsed_case.details


def _imported_dataset_entries(
    matched_case: MatchedEntity,
    parsed_case: ParsedJunitCase,
) -> list[dict]:
    if not (matched_case.dataset_id or parsed_case.dataset_key):
        return []
    return [
        {
            "dataset_alias": "imported",
            "dataset_id": matched_case.dataset_id,
            "revision_number": None,
            "row_key": parsed_case.dataset_key,
            "scenario_label": parsed_case.dataset_name or parsed_case.dataset_key,
            "values": dict(parsed_case.dataset_data or {}),
        }
    ]


def _row_snapshot_for_import(
    matched_case: MatchedEntity,
    parsed_case: ParsedJunitCase,
) -> dict:
    return {"datasets": _imported_dataset_entries(matched_case, parsed_case)}


async def apply_imported_result(
    *,
    run_row: RunCaseRow,
    parsed_case: ParsedJunitCase,
    current_user: User,
) -> None:
    target_status = map_junit_status(parsed_case.status)
    run_row.status = target_status
    run_row.comment = build_comment(parsed_case)
    run_row.system_out = parsed_case.system_out
    run_row.system_err = parsed_case.system_err
    run_row.executed_by = current_user.id
    run_row.started_at = run_row.started_at or datetime.now(timezone.utc)
    run_row.duration_ms = parsed_case.duration_ms
    run_row.execution_count += 1
    run_row.last_executed_at = datetime.now(timezone.utc)


async def ensure_run_items(
    db: AsyncSession,
    *,
    run: TestRun,
    matched_cases: list[tuple[ParsedJunitCase, MatchedEntity]],
) -> dict[str, RunItem]:
    entries = [(matched_case.test_case_id, matched_case.dataset_id) for _, matched_case in matched_cases]
    created_items = await run_cases.bulk_create_run_case_entries(db, run=run, entries=entries)
    return {f"{item.test_case_id}:": item for item in created_items}


async def _maybe_reset_untested_rows_for_duplicate_case(
    db: AsyncSession,
    *,
    matched_case: MatchedEntity,
    rows: list[RunCaseRow],
    case_occurrences: Counter,
    initialized_cases: set[str],
) -> list[RunCaseRow]:
    if matched_case.test_case_id in initialized_cases:
        return rows
    should_reset = (
        case_occurrences[matched_case.test_case_id] > 1
        and rows
        and all(row.status == RunItemStatus.untested and row.execution_count == 0 for row in rows)
    )
    if should_reset:
        for row in rows:
            await db.delete(row)
        await db.flush()
        rows = []
    initialized_cases.add(matched_case.test_case_id)
    return rows


def _scenario_label_for_import(parsed_case: ParsedJunitCase) -> str:
    return parsed_case.dataset_name or parsed_case.dataset_key or parsed_case.name


async def _find_or_create_run_row_for_import(
    db: AsyncSession,
    *,
    run_item: RunItem,
    matched_case: MatchedEntity,
    parsed_case: ParsedJunitCase,
    rows: list[RunCaseRow],
) -> RunCaseRow | None:
    scenario_label = _scenario_label_for_import(parsed_case)
    run_row = next((row for row in rows if row.scenario_label == scenario_label), None)
    if run_row is None and len(rows) == 1:
        candidate = rows[0]
        if (
            candidate.status == RunItemStatus.untested
            and candidate.execution_count == 0
            and candidate.scenario_label in {"Default scenario", "row_1"}
        ):
            candidate.scenario_label = scenario_label
            candidate.row_snapshot = _row_snapshot_for_import(matched_case, parsed_case)
            run_row = candidate
    if run_row is not None:
        return run_row

    next_order = max((row.row_order for row in rows), default=0) + 1
    new_row = RunCaseRow(
        run_case_id=run_item.id,
        row_order=next_order,
        scenario_label=scenario_label,
        row_snapshot=_row_snapshot_for_import(matched_case, parsed_case),
        status=RunItemStatus.untested,
    )
    db.add(new_row)
    await db.flush()
    return new_row


def _copy_run_row_into_run_item(run_item: RunItem, run_row: RunCaseRow) -> None:
    run_item.comment = run_row.comment
    run_item.system_out = run_row.system_out
    run_item.system_err = run_row.system_err
    run_item.actual_result = run_row.actual_result
    run_item.defect_ids = list(run_row.defect_ids or [])
    run_item.executed_by = run_row.executed_by
    run_item.execution_count = run_row.execution_count
    run_item.last_executed_at = run_row.last_executed_at
    run_item.started_at = run_row.started_at
    run_item.finished_at = run_row.finished_at
    run_item.duration_ms = run_row.duration_ms


async def _process_single_junit_match(
    db: AsyncSession,
    *,
    run: TestRun,
    parsed_case: ParsedJunitCase,
    matched_case: MatchedEntity,
    run_items_by_case_id: dict[str, RunItem],
    case_occurrences: Counter,
    initialized_cases: set[str],
    current_user: User,
    summary: JunitImportSummary,
    error_cases: list[JunitImportIssue],
) -> None:
    if matched_case.matched_by == "automation_id":
        summary.matched_by_automation_id += 1
    else:
        summary.matched_by_name += 1
    run_item_key = f"{matched_case.test_case_id}:"
    run_item = run_items_by_case_id.get(run_item_key) or await run_item_repo.get_by_run_and_case(
        db,
        test_run_id=run.id,
        test_case_id=matched_case.test_case_id,
    )
    if not run_item:
        summary.errors += 1
        error_cases.append(
            JunitImportIssue(
                testcase_name=parsed_case.name,
                testcase_classname=parsed_case.classname,
                automation_id=parsed_case.automation_id,
                reason="run item could not be created for matched test case",
            )
        )
        return

    rows_page = await run_item_repo.list_rows_by_run_case(db, run_case_id=run_item.id, page=1, page_size=100000)
    rows = list(rows_page.items)
    rows = await _maybe_reset_untested_rows_for_duplicate_case(
        db,
        matched_case=matched_case,
        rows=rows,
        case_occurrences=case_occurrences,
        initialized_cases=initialized_cases,
    )
    run_row = await _find_or_create_run_row_for_import(
        db,
        run_item=run_item,
        matched_case=matched_case,
        parsed_case=parsed_case,
        rows=rows,
    )
    if not run_row:
        summary.errors += 1
        error_cases.append(
            JunitImportIssue(
                testcase_name=parsed_case.name,
                testcase_classname=parsed_case.classname,
                automation_id=parsed_case.automation_id,
                reason="run row could not be created for matched test case",
            )
        )
        return
    try:
        await apply_imported_result(run_row=run_row, parsed_case=parsed_case, current_user=current_user)
        await db.flush()
        await run_item_repo.recalc_run_case_aggregate(db, run_item.id)
        _copy_run_row_into_run_item(run_item, run_row)
        summary.updated += 1
    except DomainError as exc:
        summary.errors += 1
        error_cases.append(
            JunitImportIssue(
                testcase_name=parsed_case.name,
                testcase_classname=parsed_case.classname,
                automation_id=parsed_case.automation_id,
                reason=exc.detail,
            )
        )


async def apply_cases_to_run(
    db: AsyncSession,
    *,
    run: TestRun,
    matched_cases: list[tuple[ParsedJunitCase, MatchedEntity]],
    current_user: User,
) -> tuple[JunitImportSummary, list[JunitImportIssue]]:
    summary = JunitImportSummary(total_cases=len(matched_cases))
    error_cases: list[JunitImportIssue] = []
    run_items_by_case_id = await ensure_run_items(db, run=run, matched_cases=matched_cases)
    case_occurrences = Counter(matched_case.test_case_id for _, matched_case in matched_cases)
    initialized_cases: set[str] = set()

    if run.status == TestRunStatus.not_started:
        run.status = TestRunStatus.in_progress
        run.started_at = datetime.now(timezone.utc)

    for parsed_case, matched_case in matched_cases:
        await _process_single_junit_match(
            db,
            run=run,
            parsed_case=parsed_case,
            matched_case=matched_case,
            run_items_by_case_id=run_items_by_case_id,
            case_occurrences=case_occurrences,
            initialized_cases=initialized_cases,
            current_user=current_user,
            summary=summary,
            error_cases=error_cases,
        )
    return summary, error_cases
