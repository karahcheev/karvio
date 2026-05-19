from __future__ import annotations

import xml.etree.ElementTree as ET
from collections import OrderedDict

from app.modules.test_cases.export.payload import ExportTestCase

_IMPORTANCE = {"low": "1", "medium": "2", "high": "3"}


def _execution_type(case: ExportTestCase) -> str:
    return "2" if case.test_case_type == "automated" else "1"


def _append_testcase(parent: ET.Element, case: ExportTestCase) -> None:
    tc_el = ET.SubElement(parent, "testcase", {"name": case.title})
    ET.SubElement(tc_el, "externalid").text = case.key
    ET.SubElement(tc_el, "summary").text = case.title
    ET.SubElement(tc_el, "preconditions").text = case.preconditions or ""
    ET.SubElement(tc_el, "importance").text = _IMPORTANCE.get(case.priority or "medium", "2")
    ET.SubElement(tc_el, "execution_type").text = _execution_type(case)
    ET.SubElement(tc_el, "estimated_exec_duration").text = case.estimate or ""

    steps_el = ET.SubElement(tc_el, "steps")
    if case.steps:
        for step in case.steps:
            step_el = ET.SubElement(steps_el, "step")
            ET.SubElement(step_el, "step_number").text = str(step.number)
            ET.SubElement(step_el, "actions").text = step.action
            ET.SubElement(step_el, "expectedresults").text = step.expected
            ET.SubElement(step_el, "execution_type").text = _execution_type(case)
    elif case.template_type == "automated":
        step_el = ET.SubElement(steps_el, "step")
        ET.SubElement(step_el, "step_number").text = "1"
        ET.SubElement(step_el, "actions").text = case.raw_test or ""
        ET.SubElement(step_el, "expectedresults").text = ""
        ET.SubElement(step_el, "execution_type").text = "2"
    elif case.steps_text or case.expected:
        step_el = ET.SubElement(steps_el, "step")
        ET.SubElement(step_el, "step_number").text = "1"
        ET.SubElement(step_el, "actions").text = case.steps_text or ""
        ET.SubElement(step_el, "expectedresults").text = case.expected or ""
        ET.SubElement(step_el, "execution_type").text = "1"

    keywords_el = ET.SubElement(tc_el, "keywords")
    for tag in case.tags:
        ET.SubElement(keywords_el, "keyword", {"name": tag})


def serialize_testlink_xml(cases: list[ExportTestCase]) -> tuple[bytes, str, str]:
    """TestLink test case interchange XML, nested by suite."""
    root = ET.Element("testsuite", {"name": "Exported test cases"})

    by_suite: "OrderedDict[str, list[ExportTestCase]]" = OrderedDict()
    for case in cases:
        by_suite.setdefault(case.suite_name or "Ungrouped", []).append(case)

    for suite_name, suite_cases in by_suite.items():
        suite_el = ET.SubElement(root, "testsuite", {"name": suite_name})
        for case in suite_cases:
            _append_testcase(suite_el, case)

    ET.indent(root, space="  ")
    content = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return content, "application/xml", "xml"
