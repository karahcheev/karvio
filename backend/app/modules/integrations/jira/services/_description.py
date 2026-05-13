"""Issue content builders: summary, description, and Jira payload normalization.

Encapsulates all logic that converts TMS run-case / test-case data into the
human-readable text that gets sent to Jira (summary line, multi-section
description, bulk summaries).  Also houses the Jira API response normalizer
and issue-type selection helpers.
"""
from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.modules.test_cases.models import TestCase as TestCaseModel
from app.modules.test_cases.models import TestCaseStep

from ._utils import _normalize_text


# ---------------------------------------------------------------------------
# Jira API response → normalized dict
# ---------------------------------------------------------------------------


def _normalize_jira_issue_payload(*, issue: dict[str, Any], site_url: str) -> dict[str, str | None]:
    fields = issue.get("fields", {}) if isinstance(issue.get("fields"), dict) else {}
    key = str(issue.get("key") or "")
    status = fields.get("status") if isinstance(fields.get("status"), dict) else {}
    priority = fields.get("priority") if isinstance(fields.get("priority"), dict) else {}
    assignee = fields.get("assignee") if isinstance(fields.get("assignee"), dict) else {}
    return {
        "key": key,
        "url": f"{site_url.rstrip('/')}/browse/{key}",
        "summary": fields.get("summary"),
        "status": status.get("name"),
        "priority": priority.get("name"),
        "assignee": assignee.get("displayName"),
        "assignee_account_id": assignee.get("accountId"),
    }


# ---------------------------------------------------------------------------
# Issue type helpers
# ---------------------------------------------------------------------------


def _issue_type_options_from_payload(issue_types: object) -> list[tuple[str, str, bool]]:
    if not isinstance(issue_types, list):
        return []
    options: list[tuple[str, str, bool]] = []
    for item in issue_types:
        if not isinstance(item, dict):
            continue
        issue_type_id = _normalize_text(str(item.get("id") or ""))
        if not issue_type_id:
            continue
        name = _normalize_text(str(item.get("name") or "")).lower()
        options.append((issue_type_id, name, bool(item.get("subtask"))))
    return options


def _pick_issue_type_id_from_project_payload(project: dict[str, Any]) -> str | None:
    options = _issue_type_options_from_payload(project.get("issueTypes"))
    for issue_type_id, name, is_subtask in options:
        if not is_subtask and name == "bug":
            return issue_type_id
    for issue_type_id, _, is_subtask in options:
        if not is_subtask:
            return issue_type_id
    return options[0][0] if options else None


# ---------------------------------------------------------------------------
# Single run-case description helpers
# ---------------------------------------------------------------------------


def _read_template_text(payload: dict[str, Any], key: str) -> str | None:
    value = payload.get(key)
    if not isinstance(value, str):
        return None
    text = value.strip()
    return text or None


def _format_steps_for_description(steps: list[TestCaseStep], *, fallback_text: str | None = None) -> str | None:
    lines: list[str] = []
    for index, step in enumerate(steps, start=1):
        action = _normalize_text(step.action)
        expected = _normalize_text(step.expected_result)
        if action and expected:
            lines.append(f"{index}. {action}\n   Expected: {expected}")
        elif action:
            lines.append(f"{index}. {action}")
        elif expected:
            lines.append(f"{index}. Expected: {expected}")
    if lines:
        return "\n".join(lines)
    return _normalize_text(fallback_text) or None


def _expected_result_for_description(
    *,
    test_case: TestCaseModel | None,
    steps: list[TestCaseStep],
) -> str | None:
    payload = test_case.template_payload if test_case and isinstance(test_case.template_payload, dict) else {}
    direct_expected = _read_template_text(payload, "expected")
    if direct_expected:
        return direct_expected
    step_expected_lines = []
    for index, step in enumerate(steps, start=1):
        expected = _normalize_text(step.expected_result)
        if expected:
            step_expected_lines.append(f"{index}. {expected}")
    if step_expected_lines:
        return "\n".join(step_expected_lines)
    return None


def _run_case_url(*, run: Any, run_case: Any) -> str:
    base = _normalize_text(get_settings().app_base_url).rstrip("/")
    if not base:
        return ""
    return f"{base}/projects/{run.project_id}/test-runs/{run.id}?run_case_id={run_case.id}"


def _build_default_issue_summary(*, run_case: Any, run_name: str) -> str:
    case_key = run_case.test_case_key_snapshot or run_case.test_case_id
    case_title = run_case.test_case_title_snapshot or "Failed test case"
    return f"[{case_key}] {case_title} failed in run '{run_name}'"


def _build_default_issue_description(
    *,
    run_case: Any,
    run: Any,
    test_case: TestCaseModel | None,
    steps: list[TestCaseStep],
    comment_override: str | None = None,
    actual_result_override: str | None = None,
) -> str:
    payload = test_case.template_payload if test_case and isinstance(test_case.template_payload, dict) else {}
    case_key = run_case.test_case_key_snapshot or (test_case.key if test_case else run_case.test_case_id)
    case_title = run_case.test_case_title_snapshot or (test_case.title if test_case else "Failed test case")
    comment = _normalize_text(comment_override) or _normalize_text(getattr(run_case, "comment", None))
    actual_result = (
        _normalize_text(actual_result_override)
        or _normalize_text(getattr(run_case, "actual_result", None))
        or comment
    )
    steps_text = _format_steps_for_description(steps, fallback_text=_read_template_text(payload, "steps_text"))
    expected_result = _expected_result_for_description(test_case=test_case, steps=steps)
    run_case_url = _run_case_url(run=run, run_case=run_case)

    chunks: list[str] = [
        "\n".join(
            [
                f"Run: {run.name}",
                f"Run case id: {run_case.id}",
                f"Status: {run_case.status.value}",
                f"Test case: {case_key} - {case_title}",
            ]
        ),
        f"Description:\n{comment or '-'}",
        f"Steps:\n{steps_text or '-'}",
        f"Actual result:\n{actual_result or '-'}",
        f"Expected result:\n{expected_result or '-'}",
    ]
    if run_case_url:
        chunks.append(f"Run case link:\n{run_case_url}")
    return "\n\n".join(chunks)


# ---------------------------------------------------------------------------
# Bulk run-cases description helpers
# ---------------------------------------------------------------------------


def _default_summary_for_bulk_issue(run_cases: list, runs_by_id: dict) -> str:
    first_run_case = run_cases[0]
    first_run = runs_by_id[first_run_case.test_run_id]
    single_run = len({item.test_run_id for item in run_cases}) == 1
    if len(run_cases) == 1:
        return _build_default_issue_summary(run_case=first_run_case, run_name=first_run.name)
    return f"[TMS] {len(run_cases)} failed run cases ({first_run.name if single_run else 'multiple runs'})"


def _bulk_issue_description_from_payload(
    payload: Any,
    run_cases: list,
    runs_by_id: dict,
) -> str:
    if payload.description and payload.description.strip():
        return payload.description.strip()
    description_chunks = [f"Bulk Jira issue for {len(run_cases)} run case(s)."]
    for run_case in run_cases[:50]:
        run = runs_by_id[run_case.test_run_id]
        case_key = run_case.test_case_key_snapshot or run_case.test_case_id
        description_chunks.append(
            f"- {case_key} (run: {run.name}, run_case_id: {run_case.id}, status: {run_case.status.value})",
        )
    if len(run_cases) > 50:
        description_chunks.append(f"- ...and {len(run_cases) - 50} more")
    return "\n".join(description_chunks)
