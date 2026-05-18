from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import TestCaseTemplateType
from app.modules.projects.repositories import users as user_repo
from app.modules.test_cases.models import TestCase
from app.modules.test_cases.repositories import suites as suite_repo
from app.modules.test_cases.repositories import datasets as test_dataset_repo
from app.modules.test_cases.schemas.dataset import TestCaseDatasetBindingRead
from app.modules.test_cases.schemas.case import TestCaseRead
from app.modules.integrations.jira.schemas.integration import ExternalIssueLinkRead

from app.modules.test_cases.validation import collect_template_variables, has_text


def legacy_raw_test(payload: dict[str, object]) -> tuple[str | None, str | None]:
    raw_test = payload.get("raw_test")
    raw_test_language = payload.get("raw_test_language")
    if has_text(raw_test if isinstance(raw_test, str) else None):
        language = raw_test_language.strip() if isinstance(raw_test_language, str) and raw_test_language.strip() else "text"
        return str(raw_test).strip(), language

    sections: list[tuple[str, str]] = []
    legacy_parts = (
        ("Setup", payload.get("setup")),
        ("Execution Flow", payload.get("steps_text")),
        ("Assertions", payload.get("assertions")),
        ("Teardown", payload.get("teardown")),
    )
    for title, value in legacy_parts:
        if isinstance(value, str) and value.strip():
            sections.append((title, value.strip()))
    if not sections:
        return None, None
    body = "\n\n".join(f"# {title}\n{value}" for title, value in sections)
    return body, "text"


def serialize_test_case(
    test_case: TestCase,
    *,
    dataset_summary: dict[str, object],
    external_issues: list[ExternalIssueLinkRead] | None = None,
    owner_name: str | None = None,
    suite_name: str | None = None,
) -> TestCaseRead:
    payload = test_case.template_payload or {}
    variables_used = sorted(collect_template_variables(payload))
    raw_test, raw_test_language = (
        legacy_raw_test(payload) if test_case.template_type == TestCaseTemplateType.automated else (None, None)
    )
    return TestCaseRead.model_validate(
        {
            "id": test_case.id,
            "project_id": test_case.project_id,
            "suite_id": test_case.suite_id,
            "owner_id": test_case.owner_id,
            "primary_product_id": test_case.primary_product_id,
            "owner_name": owner_name,
            "suite_name": suite_name,
            "key": test_case.key,
            "automation_id": test_case.automation_id,
            "title": test_case.title,
            "preconditions": test_case.preconditions,
            "template_type": test_case.template_type,
            "steps_text": payload.get("steps_text"),
            "expected": payload.get("expected"),
            "raw_test": raw_test,
            "raw_test_language": raw_test_language,
            "time": test_case.time,
            "priority": test_case.priority,
            "status": test_case.status,
            "test_case_type": test_case.test_case_type,
            "tags": test_case.tags,
            "external_issues": external_issues or [],
            "variables_used": variables_used,
            "component_coverages": [cover for cover in test_case.component_coverages],
            "created_at": test_case.created_at,
            "updated_at": test_case.updated_at,
            **dataset_summary,
        }
    )


async def owner_and_suite_names_for_test_case(
    db: AsyncSession, test_case: TestCase
) -> tuple[str | None, str | None]:
    owner_name = None
    if test_case.owner_id:
        owner = await user_repo.get_by_id(db, test_case.owner_id)
        owner_name = owner.username if owner else None
    suite_name = None
    if test_case.suite_id:
        suite = await suite_repo.get_by_id(db, test_case.suite_id)
        suite_name = suite.name if suite else None
    return owner_name, suite_name


async def dataset_summary_by_case_id(db: AsyncSession, test_case_ids: list[str]) -> dict[str, dict[str, object]]:
    links = await test_dataset_repo.list_bindings_for_test_cases(db, test_case_ids)
    result: dict[str, dict[str, object]] = {test_case_id: {"dataset_bindings": []} for test_case_id in test_case_ids}
    for link in links:
        payload = TestCaseDatasetBindingRead.model_validate(link).model_copy(
            update={"dataset_name": link.dataset.name if link.dataset else None}
        )
        result.setdefault(link.test_case_id, {"dataset_bindings": []})["dataset_bindings"].append(payload)
    return result
