from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainError
from app.models.enums import TestCaseStatus, TestCaseTemplateType, TestCaseType
from app.modules.projects.models import User
from app.modules.test_cases.models import TestCase
from app.modules.test_cases.owner_resolution import resolve_owner_id
from app.modules.test_cases.repositories import cases as test_case_repo
from app.modules.audit.services import audit as audit_service
from app.modules.report_import.junit_xml_parser import ParsedJunitCase


async def create_auto_test_case(
    db: AsyncSession,
    *,
    project_id: str,
    parsed_case: ParsedJunitCase,
    current_user: User,
    suite_id: str | None,
) -> TestCase:
    automation_id = parsed_case.automation_id.strip() if parsed_case.automation_id else None
    if automation_id:
        existing = await test_case_repo.get_by_project_and_automation_id(db, project_id=project_id, automation_id=automation_id)
        if existing:
            raise DomainError(
                status_code=409,
                code="automation_id_already_exists",
                title="Conflict",
                detail="automation_id must be unique within the project",
            )

    test_case = TestCase(
        project_id=project_id,
        key=f"TC-{uuid.uuid4().hex[:6].upper()}",
        automation_id=automation_id,
        title=parsed_case.title,
        suite_id=suite_id,
        owner_id=resolve_owner_id(None, current_user=current_user),
        status=TestCaseStatus.active,
        template_type=TestCaseTemplateType.automated,
        template_payload={
            "raw_test": parsed_case.steps or parsed_case.name.strip() or parsed_case.title,
            "raw_test_language": "python",
        },
        test_case_type=TestCaseType.automated,
        tags=["auto-imported"],
    )
    db.add(test_case)
    await db.flush()
    await audit_service.queue_create_event(
        db,
        action="test_case.create",
        resource_type="test_case",
        entity=test_case,
        tenant_id=project_id,
    )
    await db.flush()
    await db.refresh(test_case)
    return test_case
