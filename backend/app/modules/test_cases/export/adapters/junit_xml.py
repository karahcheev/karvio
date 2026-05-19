from __future__ import annotations

import xml.etree.ElementTree as ET
from collections import OrderedDict

from app.modules.test_cases.export.adapters._common import flatten_steps
from app.modules.test_cases.export.payload import ExportTestCase


def _system_out(case: ExportTestCase) -> str:
    steps, expected = flatten_steps(case)
    sections: list[str] = []
    if case.preconditions:
        sections.append(f"Preconditions:\n{case.preconditions}")
    if steps:
        sections.append(f"Steps:\n{steps}")
    if expected:
        sections.append(f"Expected Result:\n{expected}")
    return "\n\n".join(sections)


def serialize_junit_xml(cases: list[ExportTestCase]) -> tuple[bytes, str, str]:
    """JUnit-style XML so cases round-trip through the existing JUnit import path."""
    root = ET.Element("testsuites", {"name": "Exported test cases", "tests": str(len(cases))})

    by_suite: "OrderedDict[str, list[ExportTestCase]]" = OrderedDict()
    for case in cases:
        by_suite.setdefault(case.suite_name or "Ungrouped", []).append(case)

    for suite_name, suite_cases in by_suite.items():
        suite_el = ET.SubElement(
            root, "testsuite", {"name": suite_name, "tests": str(len(suite_cases))}
        )
        for case in suite_cases:
            tc_el = ET.SubElement(
                suite_el,
                "testcase",
                {"name": case.title, "classname": case.key},
            )
            body = _system_out(case)
            if body:
                ET.SubElement(tc_el, "system-out").text = body

    ET.indent(root, space="  ")
    content = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return content, "application/xml", "xml"
