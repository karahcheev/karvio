import logging
from collections.abc import Sequence
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette import status

logger = logging.getLogger("tms.errors")


def _problem(
    request: Request,
    *,
    http_status: int,
    title: str,
    detail: str,
    code: str,
    errors: dict[str, Sequence[str]] | None = None,
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    body: dict[str, Any] = {
        "type": f"https://tms.local/errors/{code}",
        "title": title,
        "status": http_status,
        "detail": detail,
        "instance": str(request.url.path),
        "code": code,
        "request_id": request_id,
    }
    if errors:
        body["errors"] = errors
    return JSONResponse(status_code=http_status, content=body)


class DomainError(Exception):
    def __init__(
        self,
        *,
        status_code: int,
        code: str,
        title: str,
        detail: str,
        errors: dict[str, list[str]] | None = None,
    ) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.code = code
        self.title = title
        self.detail = detail
        self.errors = errors


def not_found(entity_name: str) -> DomainError:
    return DomainError(
        status_code=404,
        code=f"{entity_name}_not_found",
        title="Not found",
        detail=f"{entity_name} not found",
    )


def forbid_field(field_name: str) -> DomainError:
    return DomainError(
        status_code=422,
        code="immutable_field",
        title="Validation failed",
        detail=f"Field {field_name} cannot be updated with this endpoint",
    )


async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    logger.warning(
        "Handled domain error",
        extra={
            "event": "http.domain_error",
            "request_id": getattr(request.state, "request_id", None),
            "path": str(request.url.path),
            "status_code": exc.status_code,
            "error_code": exc.code,
            "title": exc.title,
        },
    )
    return _problem(
        request,
        http_status=exc.status_code,
        title=exc.title,
        detail=exc.detail,
        code=exc.code,
        errors=exc.errors,
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors: dict[str, list[str]] = {}
    for issue in exc.errors():
        path = ".".join(str(part) for part in issue["loc"] if part != "body")
        errors.setdefault(path or "body", []).append(issue["msg"])
    logger.warning(
        "Handled validation error",
        extra={
            "event": "http.validation_error",
            "request_id": getattr(request.state, "request_id", None),
            "path": str(request.url.path),
            "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
            "issues_count": len(exc.errors()),
        },
    )
    return _problem(
        request,
        http_status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        title="Validation failed",
        detail="Request contains invalid fields",
        code="validation_error",
        errors=errors,
    )
