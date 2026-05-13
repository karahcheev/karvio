from __future__ import annotations

import json
from typing import Any

SYSTEM_PROMPT = """You are Karvio's AI test case assistant.
Return strict JSON only. Do not include Markdown. Do not reveal chain-of-thought.
Use concise reasons only. Do not invent unavailable system behavior.
Use Karvio fields and enum values exactly. Keep generated cases as drafts and suggestions.
If source input is incomplete, still provide reasonable suggestions and include warnings.
Include negative and boundary cases when relevant. Avoid duplicates when similar existing cases are provided."""


def build_generate_test_cases_prompt(context: dict[str, Any]) -> str:
    return _json_prompt(
        "Generate draft test cases for Karvio from the provided context.",
        context,
        {
            "draft_test_cases": [
                {
                    "title": "string",
                    "preconditions": "string|null",
                    "steps": [{"action": "string", "expected_result": "string"}],
                    "priority": "low|medium|high|critical",
                    "test_case_type": "manual|automated",
                    "tags": ["string"],
                    "primary_product_id": "string|null",
                    "component_coverages": [
                        {
                            "component_id": "string",
                            "coverage_type": "direct|indirect|integration|e2e",
                            "coverage_strength": "smoke|regression|deep",
                            "is_mandatory_for_release": False,
                            "notes": "string|null",
                        }
                    ],
                    "risk_reason": "string|null",
                    "suggestion_reason": "string",
                    "ai_confidence": 0.0,
                    "possible_duplicates": [],
                }
            ],
            "source_references": [],
            "warnings": [],
        },
    )


def build_review_test_case_prompt(context: dict[str, Any]) -> str:
    return _json_prompt(
        "Review the test case and return structured, field-level suggestions without changing the canonical case.",
        context,
        {
            "quality_score": 0,
            "summary": "string",
            "issues": [
                {
                    "severity": "low|medium|high",
                    "field": "title|preconditions|steps|expected_result|priority|tags|coverage|automation|other",
                    "problem": "string",
                    "recommendation": "string",
                }
            ],
            "suggested_revision": {
                "title": "string|null",
                "preconditions": "string|null",
                "steps": [{"action": "string", "expected_result": "string"}],
                "priority": "low|medium|high|critical|null",
                "tags": ["string"],
                "component_coverages": [],
            },
            "missing_edge_cases": ["string"],
            "automation_readiness": {
                "score": 0,
                "blocking_issues": ["string"],
                "recommendations": ["string"],
            },
        },
    )


def build_duplicate_similarity_prompt(context: dict[str, Any]) -> str:
    return _json_prompt(
        "Explain why the candidate test case is similar to the draft test case.",
        context,
        {
            "reason": "concise reason",
            "matching_fields": ["title", "steps", "tags", "components"],
            "recommendation": "merge|keep_both|review",
        },
    )


def _json_prompt(task: str, context: dict[str, Any], expected_shape: dict[str, Any]) -> str:
    return "\n".join(
        [
            task,
            "Return exactly one JSON object matching this shape:",
            json.dumps(expected_shape, ensure_ascii=True),
            "Context:",
            json.dumps(context, ensure_ascii=True, default=str),
        ]
    )

