from __future__ import annotations

import json

from app.modules.test_cases.export.payload import ExportTestCase


def _test_entry(case: ExportTestCase) -> dict:
    is_automated = case.test_case_type == "automated" or case.template_type == "automated"
    entry: dict = {
        "testtype": "Generic" if is_automated else "Manual",
        "fields": {
            "summary": case.title,
            "description": case.preconditions or "",
            "labels": list(case.tags),
        },
        "xray_test_repository_folder": case.suite_name or "",
        "external_key": case.key,
    }
    if is_automated:
        entry["unstructured"] = case.raw_test or ""
        return entry

    if case.steps:
        entry["steps"] = [
            {"action": step.action, "data": "", "result": step.expected}
            for step in case.steps
        ]
    elif case.steps_text or case.expected:
        entry["steps"] = [
            {"action": case.steps_text or "", "data": "", "result": case.expected or ""}
        ]
    else:
        entry["steps"] = []
    return entry


def serialize_xray_json(cases: list[ExportTestCase]) -> tuple[bytes, str, str]:
    """Xray / Zephyr style JSON for Jira-based test import."""
    payload = {"tests": [_test_entry(case) for case in cases]}
    content = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
    return content, "application/json", "json"
