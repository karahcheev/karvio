"""XML export for reports."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET

XML_TAG_SANITIZER = re.compile(r"[^a-zA-Z0-9_-]+")


def _safe_xml_tag(value: str) -> str:
    sanitized = XML_TAG_SANITIZER.sub("_", value).strip("_")
    if not sanitized:
        sanitized = "field"
    if sanitized[0].isdigit():
        sanitized = f"field_{sanitized}"
    return sanitized


def _append_xml_value(parent: ET.Element, *, key: str, value: object) -> None:
    safe_key = _safe_xml_tag(key)
    if isinstance(value, dict):
        element = ET.SubElement(parent, safe_key)
        for child_key, child_value in value.items():
            _append_xml_value(element, key=child_key, value=child_value)
        return

    if isinstance(value, list):
        container = ET.SubElement(parent, safe_key)
        for item in value:
            _append_xml_value(container, key="item", value=item)
        return

    element = ET.SubElement(parent, safe_key)
    element.text = "" if value is None else str(value)


def serialize_report_xml(payload: dict) -> tuple[bytes, str, str]:
    """Serializes payload to XML. Returns (content, media_type, extension)."""
    root = ET.Element("test_run_report")
    for key, value in payload.items():
        _append_xml_value(root, key=key, value=value)
    ET.indent(root, space="  ")
    content = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return content, "application/xml", "xml"
