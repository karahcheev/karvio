from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import TestCaseTemplateType
from app.modules.projects.models import Suite
from app.modules.projects.repositories import users as user_repo
from app.modules.test_cases.models import TestCase
from app.modules.test_cases.presenters import legacy_raw_test
from app.modules.test_cases.repositories import steps as step_repo
from sqlalchemy import select


@dataclass(frozen=True, slots=True)
class ExportStep:
    number: int
    action: str
    expected: str


@dataclass(frozen=True, slots=True)
class ExportTestCase:
    id: str
    project_id: str
    key: str
    title: str
    suite_name: str | None
    owner_name: str | None
    priority: str | None
    status: str
    test_case_type: str
    template_type: str
    preconditions: str | None
    estimate: str | None
    automation_id: str | None
    tags: list[str]
    steps_text: str | None
    expected: str | None
    raw_test: str | None
    raw_test_language: str | None
    steps: list[ExportStep] = field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None


def _enum_value(value: object) -> str | None:
    if value is None:
        return None
    return value.value if hasattr(value, "value") else str(value)


async def build_export_cases(
    db: AsyncSession, test_cases: list[TestCase]
) -> list[ExportTestCase]:
    """Build the normalized export model with steps, owner and suite names resolved in bulk."""
    if not test_cases:
        return []

    case_ids = [tc.id for tc in test_cases]
    steps_by_case = await step_repo.list_by_test_case_ids(db, case_ids)

    owner_ids = list({tc.owner_id for tc in test_cases if tc.owner_id})
    owner_name_by_id = {
        user.id: user.username for user in await user_repo.list_by_ids(db, owner_ids)
    }

    suite_ids = list({tc.suite_id for tc in test_cases if tc.suite_id})
    suite_name_by_id: dict[str, str] = {}
    if suite_ids:
        rows = await db.scalars(select(Suite).where(Suite.id.in_(suite_ids)))
        suite_name_by_id = {suite.id: suite.name for suite in rows.all()}

    exported: list[ExportTestCase] = []
    for tc in test_cases:
        payload = tc.template_payload or {}
        raw_test, raw_test_language = (
            legacy_raw_test(payload)
            if tc.template_type == TestCaseTemplateType.automated
            else (None, None)
        )
        ordered_steps = [
            ExportStep(number=index + 1, action=step.action, expected=step.expected_result)
            for index, step in enumerate(steps_by_case.get(tc.id, []))
        ]
        exported.append(
            ExportTestCase(
                id=tc.id,
                project_id=tc.project_id,
                key=tc.key,
                title=tc.title,
                suite_name=suite_name_by_id.get(tc.suite_id) if tc.suite_id else None,
                owner_name=owner_name_by_id.get(tc.owner_id) if tc.owner_id else None,
                priority=_enum_value(tc.priority),
                status=_enum_value(tc.status) or "draft",
                test_case_type=_enum_value(tc.test_case_type) or "manual",
                template_type=_enum_value(tc.template_type) or "steps",
                preconditions=tc.preconditions,
                estimate=tc.time,
                automation_id=tc.automation_id,
                tags=list(tc.tags or []),
                steps_text=payload.get("steps_text") if isinstance(payload, dict) else None,
                expected=payload.get("expected") if isinstance(payload, dict) else None,
                raw_test=raw_test,
                raw_test_language=raw_test_language,
                steps=ordered_steps,
                created_at=tc.created_at,
                updated_at=tc.updated_at,
            )
        )
    return exported
