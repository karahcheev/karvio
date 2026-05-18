"""XML export for project overview."""

from __future__ import annotations

import xml.etree.ElementTree as ET

from app.modules.reports.adapters.export_xml import _append_xml_value


def serialize_overview_xml(payload: dict) -> tuple[bytes, str, str]:
    """Serializes overview payload to XML. Returns (content, media_type, extension)."""
    root = ET.Element("project_overview_report")
    for key, value in payload.items():
        _append_xml_value(root, key=key, value=value)
    ET.indent(root, space="  ")
    content = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return content, "application/xml", "xml"
