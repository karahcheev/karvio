from __future__ import annotations
import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.core.errors import DomainError
from app.models.enums import TestCaseTemplateType, TestCaseType
from app.modules.test_cases.models import TestCase
from app.modules.projects.repositories import members as project_member_repo
from app.modules.projects.repositories import users as user_repo
from app.modules.test_cases.repositories import suites as suite_repo
from app.modules.test_cases.repositories import cases as test_case_repo
from app.modules.test_cases.schemas.case import TestCaseBulkAction, TestCaseBulkOperation

TEMPLATE_PAYLOAD_KEYS = ("steps_text", "expected", "raw_test", "raw_test_language")
DATASET_VARIABLE_PATTERN = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*\}\}")


def has_text(value: str | None) -> bool:
    return value is not None and bool(value.strip())


def extract_dataset_variables(text: str | None) -> set[str]:
    if not text:
        return set()
    return {f"{alias}.{column}" for alias, column in DATASET_VARIABLE_PATTERN.findall(text)}


def collect_template_variables(template_payload: dict[str, object]) -> set[str]:
    variables: set[str] = set()
    for key in TEMPLATE_PAYLOAD_KEYS:
        value = template_payload.get(key)
        if isinstance(value, str):
            variables.update(extract_dataset_variables(value))
    return variables


def validate_variables_against_bindings(
    *,
    variables: set[str],
    available_columns_by_alias: dict[str, set[str]],
) -> None:
    unknown_aliases: set[str] = set()
    unknown_columns: list[str] = []
    for variable in sorted(variables):
        alias, column = variable.split(".", 1)
        columns = available_columns_by_alias.get(alias)
        if columns is None:
            unknown_aliases.add(alias)
            continue
        if column not in columns:
            unknown_columns.append(variable)
    if unknown_aliases or unknown_columns:
        errors: dict[str, list[str]] = {}
        if unknown_aliases:
            errors["dataset_alias"] = [f"unknown dataset aliases: {', '.join(sorted(unknown_aliases))}"]
        if unknown_columns:
            errors["variables"] = [f"unknown dataset variables: {', '.join(unknown_columns)}"]
        raise DomainError(
            status_code=422,
            code="unknown_dataset_variable",
            title="Validation error",
            detail="Dataset placeholders reference unknown aliases or columns",
            errors=errors,
        )


async def validate_suite_and_owner(
    db: AsyncSession, project_id: str, suite_id: str | None, owner_id: str | None
) -> None:
    if suite_id is not None:
        suite = await suite_repo.get_by_id(db, suite_id)
        if not suite:
            raise not_found("suite")
        if suite.project_id != project_id:
            raise DomainError(
                status_code=422,
                code="suite_project_mismatch",
                title="Validation error",
                detail="suite does not belong to project",
                errors={"suite_id": ["suite does not belong to project"]},
            )

    if owner_id is not None:
        owner = await user_repo.get_by_id(db, owner_id)
        if not owner:
            raise not_found("user")
        if not await project_member_repo.membership_exists(db, project_id=project_id, user_id=owner_id):
            raise DomainError(
                status_code=422,
                code="owner_not_project_member",
                title="Validation error",
                detail="owner must be a project member",
                errors={"owner_id": ["owner must be a project member"]},
            )


def _validate_text_template_contract(
    *,
    steps_text: object,
    expected: object,
    raw_test: object,
    raw_test_language: object,
) -> None:
    if any(has_text(value) for value in (raw_test, raw_test_language)):
        raise DomainError(
            status_code=422,
            code="invalid_template_payload",
            title="Validation error",
            detail="text template does not support raw_test/raw_test_language",
        )
    if not (has_text(steps_text) or has_text(expected)):
        raise DomainError(
            status_code=422,
            code="invalid_template_payload",
            title="Validation error",
            detail="text template requires steps_text or expected",
        )


def _validate_steps_template_contract(
    *,
    steps_text: object,
    expected: object,
    raw_test: object,
    raw_test_language: object,
) -> None:
    if any(has_text(value) for value in (steps_text, expected, raw_test, raw_test_language)):
        raise DomainError(
            status_code=422,
            code="invalid_template_payload",
            title="Validation error",
            detail="steps template only supports structured steps",
        )


def _validate_automated_template_contract(
    *,
    preconditions: str | None,
    steps_text: object,
    expected: object,
    raw_test: object,
    test_case_type: TestCaseType | None,
) -> None:
    if has_text(preconditions):
        raise DomainError(
            status_code=422,
            code="invalid_template_payload",
            title="Validation error",
            detail="automated template does not support preconditions",
        )
    if has_text(expected):
        raise DomainError(
            status_code=422,
            code="invalid_template_payload",
            title="Validation error",
            detail="automated template does not support expected",
        )
    if has_text(steps_text):
        raise DomainError(
            status_code=422,
            code="invalid_template_payload",
            title="Validation error",
            detail="automated template does not support steps_text",
        )
    if test_case_type is not None and test_case_type != TestCaseType.automated:
        raise DomainError(
            status_code=422,
            code="validation_error",
            title="Validation error",
            detail="automated template requires test_case_type=automated",
            errors={"test_case_type": ["automated template requires test_case_type=automated"]},
        )
    if not has_text(raw_test):
        raise DomainError(
            status_code=422,
            code="invalid_template_payload",
            title="Validation error",
            detail="automated template requires raw_test",
        )


def validate_template_contract(
    *,
    template_type: TestCaseTemplateType,
    preconditions: str | None,
    automation_id: str | None,
    test_case_type: TestCaseType | None,
    template_payload: dict[str, object],
) -> None:
    steps_text = template_payload.get("steps_text")
    expected = template_payload.get("expected")
    raw_test = template_payload.get("raw_test")
    raw_test_language = template_payload.get("raw_test_language")

    if template_type == TestCaseTemplateType.text:
        _validate_text_template_contract(
            steps_text=steps_text,
            expected=expected,
            raw_test=raw_test,
            raw_test_language=raw_test_language,
        )
    elif template_type == TestCaseTemplateType.steps:
        _validate_steps_template_contract(
            steps_text=steps_text,
            expected=expected,
            raw_test=raw_test,
            raw_test_language=raw_test_language,
        )
    elif template_type == TestCaseTemplateType.automated:
        _validate_automated_template_contract(
            preconditions=preconditions,
            steps_text=steps_text,
            expected=expected,
            raw_test=raw_test,
            test_case_type=test_case_type,
        )


def normalize_template_payload(data: dict[str, object]) -> dict[str, object]:
    payload: dict[str, object] = {}
    for key in TEMPLATE_PAYLOAD_KEYS:
        value = data.pop(key, None)
        if value is None:
            continue
        if isinstance(value, str):
            trimmed = value.strip()
            if trimmed:
                payload[key] = trimmed
        else:
            payload[key] = value
    return payload


def normalize_automation_id(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


async def validate_automation_id_unique(
    db: AsyncSession,
    *,
    project_id: str,
    automation_id: str | None,
    exclude_test_case_id: str | None = None,
) -> None:
    if not automation_id:
        return
    existing = await test_case_repo.get_by_project_and_automation_id(db, project_id=project_id, automation_id=automation_id)
    if not existing or existing.id == exclude_test_case_id:
        return
    raise DomainError(
        status_code=409,
        code="automation_id_already_exists",
        title="Conflict",
        detail="automation_id must be unique within the project",
        errors={"automation_id": ["automation_id must be unique within the project"]},
    )


async def get_project_test_cases_or_404(db: AsyncSession, project_id: str, test_case_ids: list[str]) -> list[TestCase]:
    requested_ids = list(dict.fromkeys(test_case_ids))
    test_cases = await test_case_repo.list_by_ids(db, requested_ids)
    test_case_ids_set = {item.id for item in test_cases}
    missing_ids = [test_case_id for test_case_id in requested_ids if test_case_id not in test_case_ids_set]

    if missing_ids:
        missing = ", ".join(missing_ids)
        raise DomainError(
            status_code=404,
            code="test_case_not_found",
            title="Not found",
            detail="one or more test cases not found",
            errors={"test_case_ids": [f"unknown test_case_ids: {missing}"]},
        )

    out_of_project = [item.id for item in test_cases if item.project_id != project_id]
    if out_of_project:
        invalid = ", ".join(out_of_project)
        raise DomainError(
            status_code=422,
            code="test_case_project_mismatch",
            title="Validation error",
            detail="test case does not belong to project",
            errors={"test_case_ids": [f"test case does not belong to project: {invalid}"]},
        )

    return test_cases


def collect_bulk_update_field_keys(payload: TestCaseBulkOperation) -> frozenset[str]:
    """Fields to apply for action=update (from JSON keys present on the payload)."""
    keys: set[str] = set()
    if "suite_id" in payload.model_fields_set:
        keys.add("suite_id")
    if "status" in payload.model_fields_set:
        if payload.status is None:
            raise DomainError(
                status_code=422,
                code="validation_error",
                title="Validation error",
                detail="status is required when set for action 'update'",
                errors={"status": ["status is required when set for action 'update'"]},
            )
        keys.add("status")
    if "owner_id" in payload.model_fields_set:
        keys.add("owner_id")
    if "priority" in payload.model_fields_set:
        if payload.priority is None:
            raise DomainError(
                status_code=422,
                code="validation_error",
                title="Validation error",
                detail="priority is required when set for action 'update'",
                errors={"priority": ["priority is required when set for action 'update'"]},
            )
        keys.add("priority")
    if "tag" in payload.model_fields_set:
        if payload.tag is None or not str(payload.tag).strip():
            raise DomainError(
                status_code=422,
                code="validation_error",
                title="Validation error",
                detail="tag is required when set for action 'update'",
                errors={"tag": ["tag is required when set for action 'update'"]},
            )
        keys.add("tag")
    return frozenset(keys)


def require_bulk_field(
    payload: TestCaseBulkOperation,
    field_name: str,
    action: TestCaseBulkAction,
) -> None:
    if field_name in payload.model_fields_set:
        return

    raise DomainError(
        status_code=422,
        code="validation_error",
        title="Validation error",
        detail=f"{field_name} is required for action '{action.value}'",
        errors={field_name: [f"{field_name} is required for action '{action.value}'"]},
    )
