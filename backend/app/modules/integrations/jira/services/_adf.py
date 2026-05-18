"""Atlassian Document Format (ADF) serialization helpers.

Converts plain text (newline-separated paragraphs) to the ADF JSON structure
required by the Jira Cloud REST API v3 for rich-text fields.
"""
from __future__ import annotations

import re
from typing import Any


def _line_to_jira_adf_nodes(line: str) -> list[dict[str, Any]]:
    text = line.strip()
    if not text:
        return []
    if text.endswith(":") and len(text) <= 80:
        return [{"type": "text", "text": text, "marks": [{"type": "strong"}]}]
    return [{"type": "text", "text": text}]


def _to_jira_adf_text_document(value: str) -> dict[str, Any]:
    text = value.strip()
    paragraph_blocks = [block.strip() for block in re.split(r"\n\s*\n", text) if block.strip()]
    if not paragraph_blocks:
        paragraph_blocks = ["-"]
    content: list[dict[str, Any]] = []
    for block in paragraph_blocks:
        line_nodes: list[dict[str, Any]] = []
        lines = [line.rstrip() for line in block.split("\n")]
        for index, line in enumerate(lines):
            if index > 0:
                line_nodes.append({"type": "hardBreak"})
            line_nodes.extend(_line_to_jira_adf_nodes(line))
        if not line_nodes:
            line_nodes = [{"type": "text", "text": "-"}]
        content.append({"type": "paragraph", "content": line_nodes})
    return {
        "type": "doc",
        "version": 1,
        "content": content,
    }
