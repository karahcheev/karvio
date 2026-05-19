from __future__ import annotations

import json
from datetime import datetime, timezone

from app.modules.test_cases.export.payload import ExportTestCase


def _case_dict(case: ExportTestCase) -> dict:
    return {
        "id": case.id,
        "key": case.key,
        "project_id": case.project_id,
        "title": case.title,
        "suite_name": case.suite_name,
        "owner_name": case.owner_name,
        "priority": case.priority,
        "status": case.status,
        "test_case_type": case.test_case_type,
        "template_type": case.template_type,
        "preconditions": case.preconditions,
        "estimate": case.estimate,
        "automation_id": case.automation_id,
        "tags": list(case.tags),
        "steps_text": case.steps_text,
        "expected": case.expected,
        "raw_test": case.raw_test,
        "raw_test_language": case.raw_test_language,
        "steps": [
            {"number": step.number, "action": step.action, "expected": step.expected}
            for step in case.steps
        ],
        "created_at": case.created_at.isoformat() if case.created_at else None,
        "updated_at": case.updated_at.isoformat() if case.updated_at else None,
    }


def serialize_native_json(cases: list[ExportTestCase]) -> tuple[bytes, str, str]:
    """Full-fidelity Karvio JSON suitable for backup and re-import."""
    payload = {
        "schema": "karvio.test_cases.v1",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "count": len(cases),
        "test_cases": [_case_dict(case) for case in cases],
    }
    content = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
    return content, "application/json", "json"
