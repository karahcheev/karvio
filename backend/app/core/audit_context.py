from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass, replace


@dataclass(slots=True)
class AuditRequestContext:
    request_id: str | None = None
    ip: str | None = None
    user_agent: str | None = None
    actor_id: str | None = None
    actor_type: str | None = None


_audit_request_context: ContextVar[AuditRequestContext] = ContextVar(
    "audit_request_context",
    default=AuditRequestContext(),
)


def get_audit_request_context() -> AuditRequestContext:
    return _audit_request_context.get()


def set_audit_request_context(
    *,
    request_id: str | None,
    ip: str | None,
    user_agent: str | None,
    actor_id: str | None = None,
    actor_type: str | None = None,
) -> Token[AuditRequestContext]:
    return _audit_request_context.set(
        AuditRequestContext(
            request_id=request_id,
            ip=ip,
            user_agent=user_agent,
            actor_id=actor_id,
            actor_type=actor_type,
        )
    )


def reset_audit_request_context(token: Token[AuditRequestContext]) -> None:
    _audit_request_context.reset(token)


def set_audit_actor(*, actor_id: str | None, actor_type: str | None) -> None:
    current = get_audit_request_context()
    _audit_request_context.set(replace(current, actor_id=actor_id, actor_type=actor_type))
