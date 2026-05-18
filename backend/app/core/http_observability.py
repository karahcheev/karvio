from __future__ import annotations

import logging
import time
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.metrics import observe_http_request

logger = logging.getLogger("tms.http")


def _resolve_route_path(request: Request) -> str:
    route = request.scope.get("route")
    route_path = getattr(route, "path", None)
    if isinstance(route_path, str) and route_path:
        return route_path
    return request.url.path


def _resolve_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", maxsplit=1)[0].strip() or None
    if request.client:
        return request.client.host
    return None


class HttpObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        started = time.perf_counter()
        method = request.method
        request_id = getattr(request.state, "request_id", None)
        log_fields = {
            "event": "http.request",
            "method": method,
            "request_id": request_id,
            "client_ip": _resolve_client_ip(request),
            "auth_user_id": getattr(request.state, "auth_user_id", None),
        }

        try:
            response = await call_next(request)
            path = _resolve_route_path(request)
            status_code = response.status_code
            duration_seconds = time.perf_counter() - started
            observe_http_request(
                method=method,
                path=path,
                status_code=status_code,
                duration_seconds=duration_seconds,
            )
            log_fields["path"] = path
            log_fields.update(
                {
                    "status_code": status_code,
                    "status_class": f"{status_code // 100}xx",
                    "duration_ms": round(duration_seconds * 1000, 2),
                }
            )
            level = logging.INFO
            if status_code >= 500:
                level = logging.ERROR
            elif status_code >= 400:
                level = logging.WARNING
            logger.log(level, "HTTP request completed", extra=log_fields)
            return response
        except Exception as exc:  # pragma: no cover - defensive path
            path = _resolve_route_path(request)
            duration_seconds = time.perf_counter() - started
            observe_http_request(
                method=method,
                path=path,
                status_code=500,
                duration_seconds=duration_seconds,
            )
            log_fields["path"] = path
            log_fields.update(
                {
                    "status_code": 500,
                    "status_class": "5xx",
                    "duration_ms": round(duration_seconds * 1000, 2),
                    "error_type": exc.__class__.__name__,
                }
            )
            logger.exception("HTTP request failed", extra=log_fields)
            raise
