from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from pydantic import BaseModel


@dataclass(frozen=True)
class StructuredAiRequest:
    system_prompt: str
    user_prompt: str
    schema_name: str
    response_model: type[BaseModel]


@dataclass(frozen=True)
class StructuredAiResult:
    data: BaseModel
    model: str | None = None
    raw_response_id: str | None = None
    usage: dict[str, Any] | None = None


class AiProvider(Protocol):
    async def generate_structured_response(self, request: StructuredAiRequest) -> StructuredAiResult:
        """Return a response already validated by request.response_model."""

