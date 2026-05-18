from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.core.errors import DomainError
from app.models.enums import TestCasePriority, TestCaseStatus, TestCaseTemplateType, TestCaseType
from app.modules.test_cases.schemas.case import TestCaseBulkAction, TestCaseBulkOperation
from app.modules.test_cases import validation


def test_extract_and_collect_template_variables() -> None:
    text = "run {{ data.username }} and {{data.password}} and {{ bad-format }}"
    assert validation.extract_dataset_variables(text) == {"data.username", "data.password"}
    assert validation.extract_dataset_variables(None) == set()
    payload = {"steps_text": text, "expected": "{{data.result}}", "raw_test": 123}
    assert validation.collect_template_variables(payload) == {"data.username", "data.password", "data.result"}


def test_validate_variables_against_bindings_raises_for_unknown_alias_and_column() -> None:
    with pytest.raises(DomainError) as exc:
        validation.validate_variables_against_bindings(
            variables={"users.name", "env.region"},
            available_columns_by_alias={"users": {"id"}},
        )
    assert exc.value.code == "unknown_dataset_variable"
    assert "dataset_alias" in exc.value.errors
    assert "variables" in exc.value.errors


def test_validate_variables_against_bindings_passes_for_known_variables() -> None:
    validation.validate_variables_against_bindings(
        variables={"users.name", "env.region"},
        available_columns_by_alias={"users": {"name"}, "env": {"region"}},
    )


@pytest.mark.asyncio
async def test_validate_suite_and_owner_errors() -> None:
    db = AsyncMock()
    with (
        patch("app.modules.test_cases.validation.suite_repo.get_by_id", new_callable=AsyncMock, return_value=None),
    ):
        with pytest.raises(DomainError) as exc:
            await validation.validate_suite_and_owner(db, "p1", "suite1", None)
    assert exc.value.code == "suite_not_found"

    with (
        patch("app.modules.test_cases.validation.suite_repo.get_by_id", new_callable=AsyncMock, return_value=SimpleNamespace(project_id="other")),
    ):
        with pytest.raises(DomainError) as exc:
            await validation.validate_suite_and_owner(db, "p1", "suite1", None)
    assert exc.value.code == "suite_project_mismatch"

    with (
        patch("app.modules.test_cases.validation.suite_repo.get_by_id", new_callable=AsyncMock, return_value=SimpleNamespace(project_id="p1")),
        patch("app.modules.test_cases.validation.user_repo.get_by_id", new_callable=AsyncMock, return_value=None),
    ):
        with pytest.raises(DomainError) as exc:
            await validation.validate_suite_and_owner(db, "p1", "suite1", "u1")
    assert exc.value.code == "user_not_found"


@pytest.mark.asyncio
async def test_validate_suite_and_owner_owner_not_member() -> None:
    db = AsyncMock()
    with (
        patch("app.modules.test_cases.validation.suite_repo.get_by_id", new_callable=AsyncMock, return_value=SimpleNamespace(project_id="p1")),
        patch("app.modules.test_cases.validation.user_repo.get_by_id", new_callable=AsyncMock, return_value=SimpleNamespace(id="u1")),
        patch("app.modules.test_cases.validation.project_member_repo.membership_exists", new_callable=AsyncMock, return_value=False),
    ):
        with pytest.raises(DomainError) as exc:
            await validation.validate_suite_and_owner(db, "p1", "suite1", "u1")
    assert exc.value.code == "owner_not_project_member"


@pytest.mark.asyncio
async def test_validate_suite_and_owner_success() -> None:
    db = AsyncMock()
    with (
        patch("app.modules.test_cases.validation.suite_repo.get_by_id", new_callable=AsyncMock, return_value=SimpleNamespace(project_id="p1")),
        patch("app.modules.test_cases.validation.user_repo.get_by_id", new_callable=AsyncMock, return_value=SimpleNamespace(id="u1")),
        patch("app.modules.test_cases.validation.project_member_repo.membership_exists", new_callable=AsyncMock, return_value=True),
    ):
        await validation.validate_suite_and_owner(db, "p1", "suite1", "u1")


def test_validate_template_contract_text_and_steps_rules() -> None:
    with pytest.raises(DomainError):
        validation.validate_template_contract(
            template_type=TestCaseTemplateType.text,
            preconditions=None,
            automation_id=None,
            test_case_type=None,
            template_payload={"raw_test": "print(1)"},
        )
    with pytest.raises(DomainError):
        validation.validate_template_contract(
            template_type=TestCaseTemplateType.text,
            preconditions=None,
            automation_id=None,
            test_case_type=None,
            template_payload={},
        )
    with pytest.raises(DomainError):
        validation.validate_template_contract(
            template_type=TestCaseTemplateType.steps,
            preconditions=None,
            automation_id=None,
            test_case_type=None,
            template_payload={"steps_text": "x"},
        )


def test_validate_template_contract_automated_rules() -> None:
    with pytest.raises(DomainError):
        validation.validate_template_contract(
            template_type=TestCaseTemplateType.automated,
            preconditions="pre",
            automation_id=None,
            test_case_type=None,
            template_payload={"raw_test": "pytest -k smoke"},
        )
    with pytest.raises(DomainError):
        validation.validate_template_contract(
            template_type=TestCaseTemplateType.automated,
            preconditions=None,
            automation_id=None,
            test_case_type=TestCaseType.manual,
            template_payload={"raw_test": "pytest -k smoke"},
        )
    with pytest.raises(DomainError):
        validation.validate_template_contract(
            template_type=TestCaseTemplateType.automated,
            preconditions=None,
            automation_id=None,
            test_case_type=TestCaseType.automated,
            template_payload={},
        )
    validation.validate_template_contract(
        template_type=TestCaseTemplateType.automated,
        preconditions=None,
        automation_id=None,
        test_case_type=TestCaseType.automated,
        template_payload={"raw_test": "pytest -k smoke"},
    )


def test_normalize_helpers() -> None:
    data = {"steps_text": "  step ", "expected": " ", "x": 1}
    payload = validation.normalize_template_payload(data)
    assert payload == {"steps_text": "step"}
    payload2 = validation.normalize_template_payload({"raw_test": 123})
    assert payload2 == {"raw_test": 123}
    assert validation.normalize_automation_id("  AUTO-1  ") == "AUTO-1"
    assert validation.normalize_automation_id("  ") is None
    assert validation.normalize_automation_id(None) is None


@pytest.mark.asyncio
async def test_validate_automation_id_unique() -> None:
    db = AsyncMock()
    await validation.validate_automation_id_unique(db, project_id="p1", automation_id=None)
    with patch(
        "app.modules.test_cases.validation.test_case_repo.get_by_project_and_automation_id",
        new_callable=AsyncMock,
        return_value=SimpleNamespace(id="tc1"),
    ):
        with pytest.raises(DomainError) as exc:
            await validation.validate_automation_id_unique(db, project_id="p1", automation_id="AUTO-1")
    assert exc.value.code == "automation_id_already_exists"

    with patch(
        "app.modules.test_cases.validation.test_case_repo.get_by_project_and_automation_id",
        new_callable=AsyncMock,
        return_value=SimpleNamespace(id="tc1"),
    ):
        await validation.validate_automation_id_unique(
            db, project_id="p1", automation_id="AUTO-1", exclude_test_case_id="tc1"
        )


@pytest.mark.asyncio
async def test_get_project_test_cases_or_404_errors_and_success() -> None:
    db = AsyncMock()
    with patch(
        "app.modules.test_cases.validation.test_case_repo.list_by_ids",
        new_callable=AsyncMock,
        return_value=[SimpleNamespace(id="tc1", project_id="p1")],
    ):
        with pytest.raises(DomainError) as exc:
            await validation.get_project_test_cases_or_404(db, "p1", ["tc1", "tc2"])
    assert exc.value.code == "test_case_not_found"

    with patch(
        "app.modules.test_cases.validation.test_case_repo.list_by_ids",
        new_callable=AsyncMock,
        return_value=[SimpleNamespace(id="tc1", project_id="other")],
    ):
        with pytest.raises(DomainError) as exc:
            await validation.get_project_test_cases_or_404(db, "p1", ["tc1"])
    assert exc.value.code == "test_case_project_mismatch"

    expected = [SimpleNamespace(id="tc1", project_id="p1")]
    with patch(
        "app.modules.test_cases.validation.test_case_repo.list_by_ids",
        new_callable=AsyncMock,
        return_value=expected,
    ):
        out = await validation.get_project_test_cases_or_404(db, "p1", ["tc1", "tc1"])
    assert out == expected


def test_collect_bulk_update_field_keys_and_require_bulk_field() -> None:
    payload = TestCaseBulkOperation(
        project_id="p1",
        test_case_ids=["tc1"],
        action=TestCaseBulkAction.update,
        suite_id="s1",
        owner_id="u1",
        priority=TestCasePriority.high,
        status=TestCaseStatus.active,
        tag=" smoke ",
    )
    keys = validation.collect_bulk_update_field_keys(payload)
    assert keys == {"suite_id", "owner_id", "priority", "status", "tag"}

    for kwargs, expected_code in [
        ({"status": None}, "validation_error"),
        ({"priority": None}, "validation_error"),
        ({"tag": "   "}, "validation_error"),
    ]:
        bad = TestCaseBulkOperation(
            project_id="p1",
            test_case_ids=["tc1"],
            action=TestCaseBulkAction.update,
            **kwargs,
        )
        with pytest.raises(DomainError) as exc:
            validation.collect_bulk_update_field_keys(bad)
        assert exc.value.code == expected_code

    validation.require_bulk_field(payload, "suite_id", TestCaseBulkAction.move)
    missing = TestCaseBulkOperation(project_id="p1", test_case_ids=["tc1"], action=TestCaseBulkAction.move)
    with pytest.raises(DomainError) as exc:
        validation.require_bulk_field(missing, "suite_id", TestCaseBulkAction.move)
    assert exc.value.code == "validation_error"
