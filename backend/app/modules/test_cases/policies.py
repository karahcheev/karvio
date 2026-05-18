from __future__ import annotations

from types import SimpleNamespace
from typing import cast

from app.core.errors import DomainError
from app.models.enums import ProjectMemberRole, TestCaseStatus
from app.modules.test_cases.models import TestCase

TEST_CASE_LIFECYCLE_TRANSITIONS: dict[TestCaseStatus, set[TestCaseStatus]] = {
    TestCaseStatus.draft: {TestCaseStatus.active},
    TestCaseStatus.active: {TestCaseStatus.archived},
    TestCaseStatus.archived: set(),
}

TEST_CASE_ROLE_TRANSITIONS: dict[ProjectMemberRole, dict[TestCaseStatus, set[TestCaseStatus]]] = {
    ProjectMemberRole.lead: {
        TestCaseStatus.draft: {TestCaseStatus.active},
        TestCaseStatus.active: {TestCaseStatus.archived},
        TestCaseStatus.archived: set(),
    },
    ProjectMemberRole.manager: TEST_CASE_LIFECYCLE_TRANSITIONS,
}


def ensure_create_test_case_status_allowed(
    initial_status: TestCaseStatus,
    membership_role: ProjectMemberRole | None,
) -> None:
    """Validate initial status as a transition from draft (row does not exist yet)."""
    draft_stub = SimpleNamespace(status=TestCaseStatus.draft)
    ensure_test_case_status_change_allowed(cast(TestCase, draft_stub), initial_status, membership_role)


def ensure_test_case_status_change_allowed(
    test_case: TestCase,
    next_status: TestCaseStatus,
    membership_role: ProjectMemberRole | None,
) -> None:
    current_status = test_case.status
    if next_status == current_status:
        return

    effective_role = ProjectMemberRole.manager if membership_role is None else membership_role
    if effective_role == ProjectMemberRole.manager:
        return

    allowed_targets = TEST_CASE_LIFECYCLE_TRANSITIONS[current_status]
    if next_status not in allowed_targets:
        raise DomainError(
            status_code=409,
            code="invalid_status_transition",
            title="Invalid transition",
            detail=f"Cannot change test case status from {current_status.value} to {next_status.value}",
        )

    role_targets = TEST_CASE_ROLE_TRANSITIONS.get(effective_role, {})
    if next_status not in role_targets.get(current_status, set()):
        raise DomainError(
            status_code=403,
            code="insufficient_status_transition_role",
            title="Forbidden",
            detail=(
                f"Role {effective_role.value} cannot change test case status "
                f"from {current_status.value} to {next_status.value}"
            ),
        )
