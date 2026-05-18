from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.audit_context import reset_audit_request_context, set_audit_request_context
from app.core.request_context import REQUEST_ID_HEADER


def _get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", maxsplit=1)[0].strip() or None
    if request.client:
        return request.client.host
    return None


class AuditContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = getattr(request.state, "request_id", None)
        if not request_id:
            request_id = request.headers.get(REQUEST_ID_HEADER, f"req_{uuid.uuid4().hex[:12]}")
        token = set_audit_request_context(
            request_id=request_id,
            ip=_get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
        try:
            return await call_next(request)
        finally:
            reset_audit_request_context(token)
