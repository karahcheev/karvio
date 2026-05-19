from __future__ import annotations

from app.modules.test_cases.export.payload import ExportTestCase


def flatten_steps(case: ExportTestCase) -> tuple[str, str]:
    """Collapse a case's body into (steps_text, expected_text) regardless of template.

    Used by formats that only have flat step/expected columns (CSV, JUnit).
    """
    if case.template_type == "automated":
        return (case.raw_test or "", "")
    if case.steps:
        steps = "\n".join(f"{step.number}. {step.action}" for step in case.steps)
        expected = "\n".join(
            f"{step.number}. {step.expected}" for step in case.steps if step.expected
        )
        return steps, expected
    return (case.steps_text or "", case.expected or "")
