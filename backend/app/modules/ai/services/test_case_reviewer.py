from __future__ import annotations

from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models.enums import ProjectMemberRole, TestCaseTemplateType
from app.modules.ai.schemas import ReviewTestCaseRequest, ReviewTestCaseResponse, SuggestedRevision
from app.modules.ai.services import settings as ai_settings_service
from app.modules.ai.services.duplicates import find_similar_cases
from app.modules.ai.services.prompts import SYSTEM_PROMPT, build_review_test_case_prompt
from app.modules.ai.services.provider import StructuredAiRequest
from app.modules.attachments.services.storage import get_test_case_or_404
from app.modules.integrations.jira.repositories import links as external_links_repo
from app.models.enums import ExternalIssueOwnerType, ExternalIssueProvider
from app.modules.projects.models import User
from app.modules.test_cases.repositories import steps as step_repo
from app.modules.test_cases.presenters import owner_and_suite_names_for_test_case
from app.services.access import ensure_project_role


async def review_test_case(
    db: AsyncSession,
    *,
    test_case_id: str,
    payload: ReviewTestCaseRequest,
    current_user: User,
    settings: Settings,
) -> ReviewTestCaseResponse:
    test_case = await get_test_case_or_404(db, test_case_id)
    await ensure_project_role(db, current_user, test_case.project_id, ProjectMemberRole.viewer)
    provider, effective_settings = await ai_settings_service.get_ai_provider_for_project(
        db,
        project_id=test_case.project_id,
        settings=settings,
    )
    steps = await step_repo.list_by_test_case(db, test_case.id) if test_case.template_type == TestCaseTemplateType.steps else []
    _, suite_name = await owner_and_suite_names_for_test_case(db, test_case)
    external_issues = await external_links_repo.list_by_owner(
        db,
        provider=ExternalIssueProvider.jira,
        owner_type=ExternalIssueOwnerType.test_case,
        owner_id=test_case.id,
    )
    similar = await find_similar_cases(
        db,
        project_id=test_case.project_id,
        title=test_case.title,
        preconditions=test_case.preconditions,
        steps=[(step.action, step.expected_result) for step in steps],
        tags=test_case.tags or [],
        component_ids=[coverage.component_id for coverage in test_case.component_coverages],
        exclude_test_case_id=test_case.id,
        duplicate_high_threshold=effective_settings.duplicate_high_threshold,
        duplicate_medium_threshold=effective_settings.duplicate_medium_threshold,
        limit=8,
    )
    context = {
        "mode": payload.mode,
        "test_case": {
            "id": test_case.id,
            "key": test_case.key,
            "title": test_case.title,
            "suite_name": suite_name,
            "preconditions": test_case.preconditions,
            "template_type": test_case.template_type.value,
            "steps": [{"action": step.action, "expected_result": step.expected_result} for step in steps],
            "priority": test_case.priority.value if test_case.priority else None,
            "status": test_case.status.value,
            "test_case_type": test_case.test_case_type.value,
            "tags": test_case.tags,
            "primary_product_id": test_case.primary_product_id,
            "component_coverages": [
                {
                    "component_id": coverage.component_id,
                    "coverage_type": coverage.coverage_type.value,
                    "coverage_strength": coverage.coverage_strength.value,
                    "is_mandatory_for_release": coverage.is_mandatory_for_release,
                    "notes": coverage.notes,
                }
                for coverage in test_case.component_coverages
            ],
            "external_jira_issue_links": [
                {
                    "key": issue.external_key,
                    "summary": issue.snapshot_summary,
                    "status": issue.snapshot_status,
                    "priority": issue.snapshot_priority,
                }
                for issue in external_issues
            ],
        },
        "similar_active_test_cases": [item.model_dump() for item in similar],
        "rules": ["Return suggestions only.", "Do not overwrite canonical data."],
    }
    result = await provider.generate_structured_response(
        StructuredAiRequest(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=build_review_test_case_prompt(context),
            schema_name="ReviewTestCaseResponse",
            response_model=ReviewTestCaseResponse,
        )
    )
    response = cast(ReviewTestCaseResponse, result.data)
    return _post_process_review(response, allowed_component_ids={coverage.component_id for coverage in test_case.component_coverages})


def _post_process_review(response: ReviewTestCaseResponse, *, allowed_component_ids: set[str]) -> ReviewTestCaseResponse:
    revision = response.suggested_revision
    coverages = revision.component_coverages
    if coverages is not None:
        coverages = [coverage for coverage in coverages if coverage.component_id in allowed_component_ids]
    return response.model_copy(
        update={
            "suggested_revision": SuggestedRevision(
                title=revision.title,
                preconditions=revision.preconditions,
                steps=revision.steps,
                priority=revision.priority,
                tags=revision.tags,
                component_coverages=coverages,
            )
        }
    )
