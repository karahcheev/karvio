from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import DatasetBindingMode, DatasetSourceType
from app.modules.projects.models import User
from app.modules.test_cases.models import TestCase, TestCaseDatasetBinding, TestDataset
from app.modules.audit.services import audit as audit_service
from app.modules.report_import.junit_xml_parser import ParsedJunitCase
from app.modules.report_import.matching import MatchedEntity
from app.modules.report_import.schemas.imports import JunitImportIssue
from app.modules.test_cases.repositories import cases as test_case_repo
from app.modules.test_cases.repositories import datasets as test_dataset_repo


def dataset_display_name(parsed_case: ParsedJunitCase) -> str:
    if parsed_case.dataset_name:
        return parsed_case.dataset_name
    if parsed_case.dataset_key:
        return parsed_case.dataset_key
    return "Pytest dataset"


async def create_dataset_for_case(
    db: AsyncSession,
    *,
    project_id: str,
    test_case_id: str,
    parsed_case: ParsedJunitCase,
    current_user: User,
) -> str:
    dataset = TestDataset(
        project_id=project_id,
        name=dataset_display_name(parsed_case),
        source_type=DatasetSourceType.pytest_parametrize,
        source_ref=parsed_case.dataset_source_ref,
        created_by=current_user.id,
    )
    db.add(dataset)
    await db.flush()
    row_values = {key: str(value) for key, value in dict(parsed_case.dataset_data or {}).items()}
    columns = [
        {
            "column_key": key,
            "display_name": key,
            "data_type": "string",
            "required": False,
            "default_value": None,
            "is_scenario_label": False,
        }
        for key in sorted(row_values.keys())
    ]
    rows = [
        {
            "row_key": parsed_case.dataset_key or "imported-row",
            "scenario_label": parsed_case.dataset_name or parsed_case.dataset_key,
            "values": row_values,
            "is_active": True,
        }
    ]
    await test_dataset_repo.create_revision(
        db,
        dataset=dataset,
        columns=columns,
        rows=rows,
        created_by=current_user.id,
        change_summary="Imported from junit report",
    )
    await audit_service.queue_create_event(
        db,
        action="dataset.create",
        resource_type="dataset",
        entity=dataset,
        tenant_id=project_id,
    )
    await db.flush()

    alias_seed = (parsed_case.dataset_key or parsed_case.dataset_name or "imported").strip().lower().replace(" ", "_")
    alias_seed = "".join(ch if ch.isalnum() or ch == "_" else "_" for ch in alias_seed) or "imported"
    link = TestCaseDatasetBinding(
        test_case_id=test_case_id,
        dataset_id=dataset.id,
        dataset_alias=f"imported_{alias_seed}"[:120],
        mode=DatasetBindingMode.follow_latest,
    )
    db.add(link)
    await db.flush()
    await db.refresh(dataset)
    return dataset.id


async def resolve_dataset_for_case(
    db: AsyncSession,
    *,
    test_case: TestCase,
    parsed_case: ParsedJunitCase,
    create_missing_cases: bool,
    current_user: User,
) -> tuple[str | None, JunitImportIssue | None]:
    if not parsed_case.dataset_key:
        return None, None

    links = await test_dataset_repo.list_bindings_by_test_case(db, test_case.id)
    for link in links:
        if not link.dataset:
            continue
        if (
            link.dataset.name == dataset_display_name(parsed_case)
            and (link.dataset.source_ref or "") == (parsed_case.dataset_source_ref or "")
        ):
            return link.dataset.id, None

    if not create_missing_cases:
        return None, JunitImportIssue(
            testcase_name=parsed_case.name,
            testcase_classname=parsed_case.classname,
            automation_id=parsed_case.automation_id,
            reason="matching dataset was not found for the matched test case",
        )

    dataset_id = await create_dataset_for_case(
        db,
        project_id=test_case.project_id,
        test_case_id=test_case.id,
        parsed_case=parsed_case,
        current_user=current_user,
    )
    return dataset_id, None


async def resolve_datasets_for_matches(
    db: AsyncSession,
    *,
    matched_cases: list[tuple[ParsedJunitCase, MatchedEntity]],
    create_missing_cases: bool,
    current_user: User,
) -> tuple[list[tuple[ParsedJunitCase, MatchedEntity]], list[JunitImportIssue], int]:
    resolved_matches: list[tuple[ParsedJunitCase, MatchedEntity]] = []
    unmatched_cases: list[JunitImportIssue] = []
    created_datasets = 0
    for parsed_case, matched_case in matched_cases:
        test_case = await test_case_repo.get_by_id(db, matched_case.test_case_id)
        if not test_case:
            unmatched_cases.append(
                JunitImportIssue(
                    testcase_name=parsed_case.name,
                    testcase_classname=parsed_case.classname,
                    automation_id=parsed_case.automation_id,
                    reason="matched test case disappeared before dataset resolution",
                )
            )
            continue
        existing_dataset_id = matched_case.dataset_id
        dataset_id, issue = await resolve_dataset_for_case(
            db,
            test_case=test_case,
            parsed_case=parsed_case,
            create_missing_cases=create_missing_cases,
            current_user=current_user,
        )
        if issue:
            unmatched_cases.append(issue)
            continue
        if parsed_case.dataset_key and dataset_id and existing_dataset_id != dataset_id:
            links = await test_dataset_repo.list_bindings_by_test_case(db, test_case.id)
            if any(item.dataset_id == dataset_id for item in links) and existing_dataset_id is None:
                created_datasets += 1
        resolved_matches.append(
            (
                parsed_case,
                MatchedEntity(test_case_id=test_case.id, matched_by=matched_case.matched_by, dataset_id=dataset_id),
            )
        )
    return resolved_matches, unmatched_cases, created_datasets
