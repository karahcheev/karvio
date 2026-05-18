from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ProjectMemberRole, TestCaseStatus
from app.modules.ai.schemas import DuplicateCandidate, DuplicateCheckRequest, DuplicateCheckResponse
from app.modules.products.models import Component, TestCaseComponentCoverage
from app.modules.projects.models import User
from app.modules.test_cases.models import TestCase, TestCaseStep
from app.services.access import ensure_project_role

TOKEN_RE = re.compile(r"[a-z0-9]+")


async def check_duplicates(
    db: AsyncSession,
    *,
    payload: DuplicateCheckRequest,
    current_user: User,
    duplicate_high_threshold: float,
    duplicate_medium_threshold: float,
) -> DuplicateCheckResponse:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.viewer)
    components_by_id = await _components_by_id(db, payload.test_case.component_ids)
    draft = _MatchableDraft(
        title=payload.test_case.title,
        preconditions=payload.test_case.preconditions,
        steps=[(step.action, step.expected_result) for step in payload.test_case.steps],
        tags=payload.test_case.tags,
        component_names=[components_by_id[component_id].name for component_id in components_by_id],
    )
    candidates = await _load_active_cases(db, project_id=payload.project_id, exclude_test_case_id=payload.exclude_test_case_id)
    duplicates = [
        candidate
        for candidate in (_score_candidate(draft, item, duplicate_high_threshold=duplicate_high_threshold) for item in candidates)
        if candidate.similarity_score >= duplicate_medium_threshold
    ]
    duplicates.sort(key=lambda item: item.similarity_score, reverse=True)
    return DuplicateCheckResponse(duplicates=duplicates[:10], warnings=[])


async def find_similar_cases(
    db: AsyncSession,
    *,
    project_id: str,
    title: str,
    preconditions: str | None,
    steps: list[tuple[str, str]],
    tags: list[str],
    component_ids: list[str],
    exclude_test_case_id: str | None,
    duplicate_high_threshold: float,
    duplicate_medium_threshold: float,
    limit: int = 5,
) -> list[DuplicateCandidate]:
    components_by_id = await _components_by_id(db, component_ids)
    draft = _MatchableDraft(
        title=title,
        preconditions=preconditions,
        steps=steps,
        tags=tags,
        component_names=[components_by_id[component_id].name for component_id in components_by_id],
    )
    candidates = await _load_active_cases(db, project_id=project_id, exclude_test_case_id=exclude_test_case_id)
    scored = [
        candidate
        for candidate in (_score_candidate(draft, item, duplicate_high_threshold=duplicate_high_threshold) for item in candidates)
        if candidate.similarity_score >= duplicate_medium_threshold
    ]
    scored.sort(key=lambda item: item.similarity_score, reverse=True)
    return scored[:limit]


class _MatchableDraft:
    def __init__(
        self,
        *,
        title: str,
        preconditions: str | None,
        steps: list[tuple[str, str]],
        tags: list[str],
        component_names: list[str],
    ) -> None:
        self.title = title
        self.preconditions = preconditions
        self.steps = steps
        self.tags = tags
        self.component_names = component_names
        self.normalized_text = _normalize_text(
            " ".join([title, preconditions or "", _step_text(steps), " ".join(tags), " ".join(component_names)])
        )
        self.tokens = set(TOKEN_RE.findall(self.normalized_text))


class _MatchableCase(_MatchableDraft):
    def __init__(self, test_case: TestCase, *, steps: list[TestCaseStep], component_names: list[str]) -> None:
        super().__init__(
            title=test_case.title,
            preconditions=test_case.preconditions,
            steps=[(step.action, step.expected_result) for step in steps],
            tags=test_case.tags or [],
            component_names=component_names,
        )
        self.id = test_case.id
        self.key = test_case.key


async def _load_active_cases(
    db: AsyncSession,
    *,
    project_id: str,
    exclude_test_case_id: str | None,
) -> list[_MatchableCase]:
    conditions = [TestCase.project_id == project_id, TestCase.status == TestCaseStatus.active]
    if exclude_test_case_id:
        conditions.append(TestCase.id != exclude_test_case_id)
    result = await db.scalars(select(TestCase).where(*conditions).limit(200))
    test_cases = list(result.all())
    case_ids = [test_case.id for test_case in test_cases]
    steps_by_case_id = await _steps_by_case_id(db, case_ids)
    component_names_by_case_id = await _component_names_by_case_id(db, case_ids)
    return [
        _MatchableCase(
            test_case,
            steps=steps_by_case_id.get(test_case.id, []),
            component_names=component_names_by_case_id.get(test_case.id, []),
        )
        for test_case in test_cases
    ]


async def _steps_by_case_id(db: AsyncSession, case_ids: list[str]) -> dict[str, list[TestCaseStep]]:
    if not case_ids:
        return {}
    rows = await db.scalars(
        select(TestCaseStep).where(TestCaseStep.test_case_id.in_(case_ids)).order_by(TestCaseStep.position.asc())
    )
    result: dict[str, list[TestCaseStep]] = {}
    for step in rows.all():
        result.setdefault(step.test_case_id, []).append(step)
    return result


async def _component_names_by_case_id(db: AsyncSession, case_ids: list[str]) -> dict[str, list[str]]:
    if not case_ids:
        return {}
    rows = (
        await db.execute(
            select(TestCaseComponentCoverage.test_case_id, Component.name)
            .join(Component, Component.id == TestCaseComponentCoverage.component_id)
            .where(TestCaseComponentCoverage.test_case_id.in_(case_ids))
        )
    ).all()
    result: dict[str, list[str]] = {}
    for test_case_id, component_name in rows:
        result.setdefault(test_case_id, []).append(component_name)
    return result


async def _components_by_id(db: AsyncSession, component_ids: Iterable[str]) -> dict[str, Component]:
    unique_ids = list(dict.fromkeys(component_id for component_id in component_ids if component_id))
    if not unique_ids:
        return {}
    rows = await db.scalars(select(Component).where(Component.id.in_(unique_ids)))
    return {component.id: component for component in rows.all()}


def _score_candidate(
    draft: _MatchableDraft,
    candidate: _MatchableCase,
    *,
    duplicate_high_threshold: float,
) -> DuplicateCandidate:
    title_score = _ratio(_normalize_text(draft.title), _normalize_text(candidate.title))
    full_score = _ratio(draft.normalized_text, candidate.normalized_text)
    token_score = _jaccard(draft.tokens, candidate.tokens)
    tag_score = _jaccard({tag.lower() for tag in draft.tags}, {tag.lower() for tag in candidate.tags})
    component_score = _jaccard(
        {name.lower() for name in draft.component_names},
        {name.lower() for name in candidate.component_names},
    )
    score = max(title_score * 0.45 + full_score * 0.35 + token_score * 0.20, title_score * 0.65 + tag_score * 0.20 + component_score * 0.15)
    matching_fields = _matching_fields(
        title_score=title_score,
        full_score=full_score,
        tag_score=tag_score,
        component_score=component_score,
    )
    recommendation = "merge" if score >= duplicate_high_threshold else "review"
    return DuplicateCandidate(
        candidate_test_case_id=candidate.id,
        key=candidate.key,
        title=candidate.title,
        similarity_score=round(min(score, 1.0), 3),
        reason=_reason(matching_fields, score),
        matching_fields=matching_fields,
        recommendation=recommendation,
    )


def _normalize_text(value: str) -> str:
    return " ".join(TOKEN_RE.findall(value.lower()))


def _step_text(steps: list[tuple[str, str]]) -> str:
    return " ".join(f"{action} {expected}" for action, expected in steps)


def _ratio(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def _jaccard(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def _matching_fields(*, title_score: float, full_score: float, tag_score: float, component_score: float) -> list[str]:
    fields: list[str] = []
    if title_score >= 0.62:
        fields.append("title")
    if full_score >= 0.55:
        fields.append("steps")
    if tag_score >= 0.35:
        fields.append("tags")
    if component_score >= 0.35:
        fields.append("components")
    return fields or ["content"]


def _reason(fields: list[str], score: float) -> str:
    joined = ", ".join(fields)
    if score >= 0.88:
        return f"Strong overlap across {joined}."
    return f"Potential overlap across {joined}."
