from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.projects.models import User
from app.modules.test_runs.models import TestRun, TestRunImport
from app.modules.report_import.schemas.imports import (
    JunitImportCreatedCase,
    JunitImportIssue,
    JunitImportRead,
    JunitImportSummary,
    JunitImportTargetRun,
)


@dataclass(slots=True, kw_only=True)
class PersistImportParams:
    run: TestRun
    source_filename: str
    source_content_type: str | None
    content: bytes
    current_user: User
    dry_run: bool
    status: str
    summary: JunitImportSummary
    created_cases: list[JunitImportCreatedCase]
    unmatched_cases: list[JunitImportIssue]
    ambiguous_cases: list[JunitImportIssue]
    error_cases: list[JunitImportIssue]
    target_run: JunitImportTargetRun


async def save_import_record(
    db: AsyncSession,
    *,
    run: TestRun,
    current_user: User,
    filename: str,
    content_type: str | None,
    source_xml: str,
    dry_run: bool,
    status: str,
    summary_payload: dict,
) -> TestRunImport:
    record = TestRunImport(
        test_run_id=run.id,
        created_by=current_user.id,
        source_filename=filename,
        source_content_type=content_type,
        source_xml=source_xml,
        dry_run=dry_run,
        status=status,
        summary=summary_payload,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


def build_import_response(
    *,
    record: TestRunImport,
    summary: JunitImportSummary,
    created_cases: list[JunitImportCreatedCase],
    unmatched_cases: list[JunitImportIssue],
    ambiguous_cases: list[JunitImportIssue],
    error_cases: list[JunitImportIssue],
    target_run: JunitImportTargetRun,
) -> JunitImportRead:
    return JunitImportRead(
        id=record.id,
        test_run_id=record.test_run_id,
        target_run=target_run,
        source_filename=record.source_filename,
        source_content_type=record.source_content_type,
        dry_run=record.dry_run,
        status=record.status,
        summary=summary,
        created_cases=created_cases,
        unmatched_cases=unmatched_cases,
        ambiguous_cases=ambiguous_cases,
        error_cases=error_cases,
        created_at=record.created_at,
    )


async def persist_import(db: AsyncSession, *, params: PersistImportParams) -> JunitImportRead:
    summary_payload = {
        "summary": params.summary.model_dump(),
        "created_cases": [item.model_dump() for item in params.created_cases],
        "unmatched_cases": [item.model_dump() for item in params.unmatched_cases],
        "ambiguous_cases": [item.model_dump() for item in params.ambiguous_cases],
        "error_cases": [item.model_dump() for item in params.error_cases],
        "target_run": params.target_run.model_dump(),
    }
    record = await save_import_record(
        db,
        run=params.run,
        current_user=params.current_user,
        filename=params.source_filename,
        content_type=params.source_content_type,
        source_xml=params.content.decode("utf-8", errors="replace"),
        dry_run=params.dry_run,
        status=params.status,
        summary_payload=summary_payload,
    )
    return build_import_response(
        record=record,
        summary=params.summary,
        created_cases=params.created_cases,
        unmatched_cases=params.unmatched_cases,
        ambiguous_cases=params.ambiguous_cases,
        error_cases=params.error_cases,
        target_run=params.target_run,
    )
