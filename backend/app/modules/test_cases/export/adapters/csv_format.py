from __future__ import annotations

import csv
import io

from app.modules.test_cases.export.adapters._common import flatten_steps
from app.modules.test_cases.export.payload import ExportTestCase

_COLUMNS = [
    "Key",
    "Title",
    "Section",
    "Priority",
    "Type",
    "Status",
    "Estimate",
    "Preconditions",
    "Steps",
    "Expected Result",
    "Automation ID",
    "Tags",
]


def serialize_csv(cases: list[ExportTestCase]) -> tuple[bytes, str, str]:
    """Generic columnar CSV importable by TestRail, Zephyr Scale, qTest, and Xray."""
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, quoting=csv.QUOTE_ALL, lineterminator="\r\n")
    writer.writerow(_COLUMNS)
    for case in cases:
        steps, expected = flatten_steps(case)
        writer.writerow(
            [
                case.key,
                case.title,
                case.suite_name or "",
                case.priority or "",
                case.test_case_type,
                case.status,
                case.estimate or "",
                case.preconditions or "",
                steps,
                expected,
                case.automation_id or "",
                ", ".join(case.tags),
            ]
        )
    content = buffer.getvalue().encode("utf-8-sig")
    return content, "text/csv", "csv"
