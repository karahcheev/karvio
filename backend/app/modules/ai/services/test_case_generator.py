from __future__ import annotations

from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.models.enums import ProjectMemberRole
from app.modules.ai.schemas import AiDraftTestCase, GenerateTestCasesRequest, GenerateTestCasesResponse
from app.modules.ai.services import settings as ai_settings_service
from app.modules.ai.services.context import (
    allowed_component_ids,
    load_component_context,
    load_product_context,
    load_project_context,
    load_suite_context,
)
from app.modules.ai.services.duplicates import find_similar_cases
from app.modules.ai.services.prompts import SYSTEM_PROMPT, build_generate_test_cases_prompt
from app.modules.ai.services.provider import StructuredAiRequest
from app.modules.projects.models import User
from app.services.access import ensure_project_role


async def generate_test_cases(
    db: AsyncSession,
    *,
    payload: GenerateTestCasesRequest,
    current_user: User,
    settings: Settings,
) -> GenerateTestCasesResponse:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.viewer)
    provider, effective_settings = await ai_settings_service.get_ai_provider_for_project(
        db,
        project_id=payload.project_id,
        settings=settings,
    )
    project = await load_project_context(db, project_id=payload.project_id)
    suite = await load_suite_context(db, project_id=payload.project_id, suite_id=payload.suite_id)
    product = await load_product_context(db, project_id=payload.project_id, product_id=payload.primary_product_id)
    components = await load_component_context(db, project_id=payload.project_id, component_ids=payload.component_ids)
    existing_similar = await find_similar_cases(
        db,
        project_id=payload.project_id,
        title=payload.source_text or "Generated test cases",
        preconditions=None,
        steps=[],
        tags=list(payload.test_focus),
        component_ids=payload.component_ids,
        exclude_test_case_id=None,
        duplicate_high_threshold=effective_settings.duplicate_high_threshold,
        duplicate_medium_threshold=effective_settings.duplicate_medium_threshold,
        limit=8,
    )

    context = {
        "project": project,
        "suite": suite,
        "selected_product": product,
        "selected_components": components,
        "source_text": payload.source_text,
        "test_focus": payload.test_focus,
        "priority_preference": payload.priority_preference.value if payload.priority_preference else None,
        "requested_count": payload.count,
        "similar_active_test_cases": [item.model_dump() for item in existing_similar],
        "rules": [
            "Return draft suggestions only.",
            "Use selected component IDs only when creating component_coverages.",
            "Avoid duplicating similar_active_test_cases.",
        ],
    }
    result = await provider.generate_structured_response(
        StructuredAiRequest(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=build_generate_test_cases_prompt(context),
            schema_name="GenerateTestCasesResponse",
            response_model=GenerateTestCasesResponse,
        )
    )
    response = cast(GenerateTestCasesResponse, result.data)
    return await _post_process_response(
        db,
        payload=payload,
        response=response,
        duplicate_high_threshold=effective_settings.duplicate_high_threshold,
        duplicate_medium_threshold=effective_settings.duplicate_medium_threshold,
        allowed_components=allowed_component_ids(components),
    )


async def _post_process_response(
    db: AsyncSession,
    *,
    payload: GenerateTestCasesRequest,
    response: GenerateTestCasesResponse,
    duplicate_high_threshold: float,
    duplicate_medium_threshold: float,
    allowed_components: set[str],
) -> GenerateTestCasesResponse:
    warnings = list(response.warnings)
    drafts: list[AiDraftTestCase] = []
    for draft in response.draft_test_cases[: payload.count]:
        coverages = [coverage for coverage in draft.component_coverages if coverage.component_id in allowed_components]
        if len(coverages) != len(draft.component_coverages):
            warnings.append(f"Removed invalid component coverage from draft '{draft.title}'.")
        duplicates = await find_similar_cases(
            db,
            project_id=payload.project_id,
            title=draft.title,
            preconditions=draft.preconditions,
            steps=[(step.action, step.expected_result) for step in draft.steps],
            tags=draft.tags,
            component_ids=[coverage.component_id for coverage in coverages],
            exclude_test_case_id=None,
            duplicate_high_threshold=duplicate_high_threshold,
            duplicate_medium_threshold=duplicate_medium_threshold,
            limit=5,
        )
        drafts.append(
            draft.model_copy(
                update={
                    "primary_product_id": payload.primary_product_id,
                    "component_coverages": coverages,
                    "possible_duplicates": duplicates,
                }
            )
        )
    return GenerateTestCasesResponse(
        draft_test_cases=drafts,
        source_references=response.source_references,
        warnings=list(dict.fromkeys(warnings)),
    )
