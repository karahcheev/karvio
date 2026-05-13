from types import SimpleNamespace

import pytest
import httpx
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import DomainError
from app.core.token_crypto import decrypt_secret
from app.models.enums import ProjectMemberRole, TestCaseStatus as CaseStatus, TestCaseTemplateType as CaseTemplateType
from app.modules.ai.models import ProjectAiSettings
from app.modules.ai.providers.openai_provider import OpenAiProvider
from app.modules.ai.schemas import (
    DuplicateCheckRequest,
    GenerateTestCasesResponse,
    ReviewTestCaseResponse,
)
from app.modules.ai.services import prompts
from app.modules.ai.services import settings as ai_settings_service
from app.modules.ai.services.provider import StructuredAiRequest, StructuredAiResult
from app.modules.projects.models import Project, ProjectMember, Suite
from app.modules.test_cases.models import TestCase as CaseModel, TestCaseStep as CaseStepModel


class FakeAiProvider:
    async def generate_structured_response(self, request: StructuredAiRequest) -> StructuredAiResult:
        if request.response_model is GenerateTestCasesResponse:
            data = request.response_model.model_validate(
                {
                    "draft_test_cases": [
                        {
                            "title": "Checkout rejects expired card",
                            "preconditions": "User has items in cart.",
                            "steps": [
                                {
                                    "action": "Pay with an expired card.",
                                    "expected_result": "Payment is rejected with a clear error.",
                                }
                            ],
                            "priority": "high",
                            "test_case_type": "manual",
                            "tags": ["checkout", "negative"],
                            "primary_product_id": None,
                            "component_coverages": [],
                            "risk_reason": "Payment failures are business critical.",
                            "suggestion_reason": "Covers a negative checkout path.",
                            "ai_confidence": 0.84,
                            "possible_duplicates": [],
                        }
                    ],
                    "source_references": [],
                    "warnings": [],
                }
            )
            return StructuredAiResult(data=data)
        data = request.response_model.model_validate(
            {
                "quality_score": 78,
                "summary": "Useful case with clearer expected results needed.",
                "issues": [
                    {
                        "severity": "medium",
                        "field": "steps",
                        "problem": "Expected result is broad.",
                        "recommendation": "State the exact UI or API outcome.",
                    }
                ],
                "suggested_revision": {
                    "title": "Checkout rejects expired card",
                    "preconditions": None,
                    "steps": [{"action": "Submit expired card.", "expected_result": "Card is declined."}],
                    "priority": "high",
                    "tags": ["checkout"],
                    "component_coverages": [],
                },
                "missing_edge_cases": ["Network timeout during payment"],
                "automation_readiness": {
                    "score": 70,
                    "blocking_issues": [],
                    "recommendations": ["Mock the payment gateway."],
                },
            }
        )
        return StructuredAiResult(data=data)


@pytest.fixture
def ai_enabled(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "ai_test_case_assistant_enabled", True)
    monkeypatch.setattr(settings, "ai_provider", "openai")
    monkeypatch.setattr(settings, "ai_model", "test-model")
    monkeypatch.setattr(settings, "ai_api_key", "test-key")
    monkeypatch.setattr(settings, "ai_duplicate_high_threshold", 0.88)
    monkeypatch.setattr(settings, "ai_duplicate_medium_threshold", 0.72)

    async def fake_project_provider(*args, **kwargs):
        return (
            FakeAiProvider(),
            SimpleNamespace(
                duplicate_high_threshold=settings.ai_duplicate_high_threshold,
                duplicate_medium_threshold=settings.ai_duplicate_medium_threshold,
            ),
        )

    monkeypatch.setattr(ai_settings_service, "get_ai_provider_for_project", fake_project_provider)
    yield settings


async def _seed_project(db_session: AsyncSession, user_id: str, role: ProjectMemberRole = ProjectMemberRole.tester):
    project = Project(id="proj_ai_1", name="AI Project")
    suite = Suite(id="suite_ai_1", project_id=project.id, name="Checkout")
    membership = ProjectMember(project_id=project.id, user_id=user_id, role=role)
    db_session.add_all([project, suite, membership])
    await db_session.commit()
    return project, suite


async def test_ai_generate_endpoint_success(client, db_session: AsyncSession, auth_user, auth_headers, ai_enabled):
    project, suite = await _seed_project(db_session, auth_user.id, ProjectMemberRole.viewer)

    response = await client.post(
        "/api/v1/ai/test-cases/generate",
        json={
            "project_id": project.id,
            "source_text": "Checkout card handling",
            "suite_id": suite.id,
            "primary_product_id": None,
            "component_ids": [],
            "test_focus": ["negative"],
            "priority_preference": "high",
            "count": 1,
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["draft_test_cases"][0]["title"] == "Checkout rejects expired card"
    assert body["draft_test_cases"][0]["possible_duplicates"] == []


async def test_ai_review_endpoint_success(client, db_session: AsyncSession, auth_user, auth_headers, ai_enabled):
    project, _ = await _seed_project(db_session, auth_user.id, ProjectMemberRole.viewer)
    test_case = CaseModel(
        id="tc_ai_review_1",
        project_id=project.id,
        key="TC-AI-1",
        title="Checkout card",
        template_type=CaseTemplateType.steps,
        status=CaseStatus.active,
        tags=[],
    )
    step = CaseStepModel(
        id="step_ai_review_1",
        test_case_id=test_case.id,
        position=1,
        action="Pay",
        expected_result="Works",
    )
    db_session.add_all([test_case, step])
    await db_session.commit()

    response = await client.post(
        f"/api/v1/ai/test-cases/{test_case.id}/review",
        json={"mode": "all"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["quality_score"] == 78
    assert body["issues"][0]["field"] == "steps"


async def test_ai_duplicate_endpoint_success(client, db_session: AsyncSession, auth_user, auth_headers, ai_enabled):
    project, _ = await _seed_project(db_session, auth_user.id, ProjectMemberRole.viewer)
    existing = CaseModel(
        id="tc_ai_dup_1",
        project_id=project.id,
        key="TC-DUP-1",
        title="Checkout rejects expired card",
        status=CaseStatus.active,
        tags=["checkout", "negative"],
    )
    existing_step = CaseStepModel(
        id="step_ai_dup_1",
        test_case_id=existing.id,
        position=1,
        action="Submit expired card",
        expected_result="Card is declined",
    )
    db_session.add_all([existing, existing_step])
    await db_session.commit()

    response = await client.post(
        "/api/v1/ai/test-cases/duplicates/check",
        json={
            "project_id": project.id,
            "test_case": {
                "title": "Checkout rejects expired card",
                "preconditions": None,
                "steps": [{"action": "Submit expired card", "expected_result": "Card is declined"}],
                "tags": ["checkout", "negative"],
                "component_ids": [],
            },
            "exclude_test_case_id": None,
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    duplicate = response.json()["duplicates"][0]
    assert duplicate["candidate_test_case_id"] == existing.id
    assert duplicate["similarity_score"] >= ai_enabled.ai_duplicate_high_threshold
    assert duplicate["recommendation"] == "merge"


async def test_ai_feature_disabled_returns_not_found(client, db_session: AsyncSession, auth_user, auth_headers, monkeypatch):
    project, _ = await _seed_project(db_session, auth_user.id, ProjectMemberRole.viewer)
    monkeypatch.setattr(get_settings(), "ai_test_case_assistant_enabled", False)

    response = await client.post(
        "/api/v1/ai/test-cases/generate",
        json={"project_id": project.id, "component_ids": [], "test_focus": [], "count": 1},
        headers=auth_headers,
    )

    assert response.status_code == 404
    assert response.json()["code"] == "ai_test_case_assistant_disabled"


async def test_ai_permission_denial(client, db_session: AsyncSession, auth_headers, ai_enabled):
    project = Project(id="proj_ai_no_access", name="No Access")
    db_session.add(project)
    await db_session.commit()

    response = await client.post(
        "/api/v1/ai/test-cases/duplicates/check",
        json={
            "project_id": project.id,
            "test_case": {"title": "A", "preconditions": None, "steps": [], "tags": [], "component_ids": []},
            "exclude_test_case_id": None,
        },
        headers=auth_headers,
    )

    assert response.status_code == 403
    assert response.json()["code"] == "project_access_denied"


async def test_project_ai_settings_can_be_saved_by_project_manager(
    client,
    db_session: AsyncSession,
    auth_user,
    auth_headers,
):
    project, _ = await _seed_project(db_session, auth_user.id, ProjectMemberRole.manager)

    response = await client.put(
        "/api/v1/settings/ai",
        json={
            "project_id": project.id,
            "enabled": True,
            "provider": "openai",
            "model": "gpt-test",
            "api_key": "sk-test-secret",
            "timeout_ms": 12000,
            "http_max_retries": 1,
            "duplicate_high_threshold": 0.9,
            "duplicate_medium_threshold": 0.7,
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is True
    assert body["api_key_configured"] is True
    assert "api_key" not in body
    saved = await db_session.scalar(select(ProjectAiSettings).where(ProjectAiSettings.project_id == project.id))
    assert saved is not None
    assert saved.api_key_encrypted != "sk-test-secret"
    assert decrypt_secret(saved.api_key_encrypted) == "sk-test-secret"

    status_response = await client.get(
        f"/api/v1/ai/test-cases/status?project_id={project.id}",
        headers=auth_headers,
    )
    assert status_response.status_code == 200
    assert status_response.json() == {"enabled": True, "provider": "openai", "model": "gpt-test"}


async def test_project_ai_settings_require_project_manager(client, db_session: AsyncSession, auth_user, auth_headers):
    project, _ = await _seed_project(db_session, auth_user.id, ProjectMemberRole.tester)

    response = await client.put(
        "/api/v1/settings/ai",
        json={
            "project_id": project.id,
            "enabled": True,
            "provider": "openai",
            "model": "gpt-test",
            "api_key": "sk-test-secret",
            "timeout_ms": 12000,
            "http_max_retries": 1,
            "duplicate_high_threshold": 0.9,
            "duplicate_medium_threshold": 0.7,
        },
        headers=auth_headers,
    )

    assert response.status_code == 403
    assert response.json()["code"] == "insufficient_project_role"


def test_prompt_builders_request_strict_json():
    prompt = prompts.build_generate_test_cases_prompt({"source_text": "Checkout"})

    assert "Return exactly one JSON object" in prompt
    assert "draft_test_cases" in prompt
    assert prompts.SYSTEM_PROMPT.startswith("You are Karvio")


def test_ai_schema_validation_rejects_invalid_confidence():
    with pytest.raises(ValidationError):
        GenerateTestCasesResponse.model_validate(
            {
                "draft_test_cases": [
                    {
                        "title": "Invalid",
                        "preconditions": None,
                        "steps": [{"action": "A", "expected_result": "B"}],
                        "priority": "high",
                        "test_case_type": "manual",
                        "tags": [],
                        "primary_product_id": None,
                        "component_coverages": [],
                        "risk_reason": None,
                        "suggestion_reason": "reason",
                        "ai_confidence": 2,
                        "possible_duplicates": [],
                    }
                ],
                "source_references": [],
                "warnings": [],
            }
        )


def test_duplicate_request_schema_requires_title():
    with pytest.raises(ValidationError):
        DuplicateCheckRequest.model_validate(
            {
                "project_id": "p1",
                "test_case": {"title": " ", "preconditions": None, "steps": [], "tags": [], "component_ids": []},
                "exclude_test_case_id": None,
            }
        )


async def test_openai_provider_malformed_response():
    class FakeResponse:
        status_code = 200

        def json(self):
            return {"choices": [{"message": {"content": "not json"}}]}

    class FakeClient:
        async def post(self, *args, **kwargs):
            return FakeResponse()

    provider = OpenAiProvider(
        api_key="key",
        model="model",
        timeout_ms=1000,
        max_retries=0,
        client_factory=lambda: FakeClient(),
    )

    with pytest.raises(DomainError) as exc:
        await provider.generate_structured_response(
            StructuredAiRequest(
                system_prompt="system",
                user_prompt="user",
                schema_name="ReviewTestCaseResponse",
                response_model=ReviewTestCaseResponse,
            )
        )
    assert exc.value.code == "ai_response_malformed"


async def test_openai_provider_timeout_failure():
    class FakeClient:
        async def post(self, *args, **kwargs):
            raise httpx.TimeoutException("timeout")

    provider = OpenAiProvider(
        api_key="key",
        model="model",
        timeout_ms=1000,
        max_retries=0,
        client_factory=lambda: FakeClient(),
    )

    with pytest.raises(DomainError) as exc:
        await provider.generate_structured_response(
            StructuredAiRequest(
                system_prompt="system",
                user_prompt="user",
                schema_name="ReviewTestCaseResponse",
                response_model=ReviewTestCaseResponse,
            )
        )
    assert exc.value.code == "ai_provider_timeout"
