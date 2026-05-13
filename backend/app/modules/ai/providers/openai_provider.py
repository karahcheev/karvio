from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError

from app.core.errors import DomainError
from app.modules.ai.services.provider import StructuredAiRequest, StructuredAiResult


class OpenAiProvider:
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        timeout_ms: int,
        max_retries: int,
        client_factory: Callable[[], httpx.AsyncClient] | None = None,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = max(1, timeout_ms / 1000)
        self.max_retries = max(0, max_retries)
        self.client_factory = client_factory

    async def generate_structured_response(self, request: StructuredAiRequest) -> StructuredAiResult:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.user_prompt},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }
        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                response = await self._post(payload)
                return self._parse_response(response, request.response_model)
            except httpx.TimeoutException as exc:
                last_error = exc
                if attempt >= self.max_retries:
                    raise _provider_error("ai_provider_timeout", "AI provider timed out") from exc
            except httpx.HTTPError as exc:
                last_error = exc
                if attempt >= self.max_retries:
                    raise _provider_error("ai_provider_failure", "AI provider request failed") from exc
        raise _provider_error("ai_provider_failure", "AI provider request failed") from last_error

    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.client_factory:
            client = self.client_factory()
            close_client = False
        else:
            client = httpx.AsyncClient(timeout=self.timeout_seconds)
            close_client = True
        try:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
            )
            if response.status_code >= 400:
                raise httpx.HTTPStatusError(
                    "AI provider returned an error",
                    request=response.request,
                    response=response,
                )
            return response.json()
        finally:
            if close_client:
                await client.aclose()

    def _parse_response(
        self,
        response: dict[str, Any],
        response_model: type[BaseModel],
    ) -> StructuredAiResult:
        content = _extract_content(response)
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise _provider_error("ai_response_malformed", "AI provider returned malformed JSON") from exc
        try:
            data = response_model.model_validate(parsed)
        except ValidationError as exc:
            raise _provider_error("ai_response_validation_failed", "AI response did not match the expected schema") from exc
        return StructuredAiResult(
            data=data,
            model=response.get("model") if isinstance(response.get("model"), str) else self.model,
            raw_response_id=response.get("id") if isinstance(response.get("id"), str) else None,
            usage=response.get("usage") if isinstance(response.get("usage"), dict) else None,
        )


def _extract_content(response: dict[str, Any]) -> str:
    choices = response.get("choices")
    if not isinstance(choices, list) or not choices:
        raise _provider_error("ai_response_malformed", "AI provider returned no choices")
    first = choices[0]
    if not isinstance(first, dict):
        raise _provider_error("ai_response_malformed", "AI provider returned malformed choices")
    message = first.get("message")
    if not isinstance(message, dict) or not isinstance(message.get("content"), str):
        raise _provider_error("ai_response_malformed", "AI provider returned no JSON content")
    return message["content"]


def _provider_error(code: str, detail: str) -> DomainError:
    return DomainError(status_code=502, code=code, title="AI provider error", detail=detail)
