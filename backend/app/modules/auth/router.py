from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user, get_request_client_ip
from app.core.config import get_settings
from app.core.errors import DomainError
from app.core.security import create_access_token
from app.db.session import get_db
from app.modules.audit.services import audit as audit_service
from app.modules.auth.oidc import flow as oidc_flow
from app.modules.auth.oidc.transaction import (
    OIDC_TX_COOKIE,
    TX_TTL_SECONDS,
    deserialize as deserialize_tx,
    serialize as serialize_tx,
)
from app.modules.auth.repositories import providers as provider_repo
from app.models.enums import AuthProviderType
from app.modules.projects.models import User
from app.modules.auth.schemas.auth import LdapLoginRequest, LoginRequest, LoginResponse
from app.modules.auth.services import ldap_login as ldap_login_service
from app.modules.auth.schemas.providers import (
    AuthProviderCreate,
    AuthProviderList,
    AuthProviderRead,
    AuthProviderUpdate,
    ProviderTestResult,
    PublicAuthConfig,
    RotateSecretRequest,
)
from app.modules.projects.schemas.user import UserRead
from app.modules.auth.services import auth as auth_service
from app.modules.auth.services import providers as provider_service
from app.modules.auth import presenters as auth_presenters

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.access_token_ttl_seconds,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_same_site,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_same_site,
    )


@router.post("/login")
async def login(
    payload: LoginRequest, response: Response, db: Annotated[AsyncSession, Depends(get_db)]
) -> LoginResponse:
    result = await auth_service.login(db, payload)
    _set_session_cookie(response, result.access_token)
    return LoginResponse(user=result.user)


@router.post("/login/ldap")
async def login_ldap(
    payload: LdapLoginRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LoginResponse:
    result = await ldap_login_service.login_ldap(
        db, payload=payload, client_ip=get_request_client_ip(request)
    )
    _set_session_cookie(response, result.access_token)
    return LoginResponse(user=result.user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    _clear_session_cookie(response)


@router.get("/me")
async def me(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserRead:
    return await auth_presenters.user_to_read_with_memberships(db, current_user)


@router.get("/config")
async def public_auth_config(db: Annotated[AsyncSession, Depends(get_db)]) -> PublicAuthConfig:
    return await provider_service.build_public_config(db)


@router.get("/providers")
async def list_auth_providers(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AuthProviderList:
    return await provider_service.list_providers(db, current_user=current_user)


@router.post("/providers", status_code=status.HTTP_201_CREATED)
async def create_auth_provider(
    payload: AuthProviderCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AuthProviderRead:
    return await provider_service.create_provider(db, current_user=current_user, payload=payload)


@router.get("/providers/{provider_id}")
async def get_auth_provider(
    provider_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AuthProviderRead:
    return await provider_service.get_provider(db, current_user=current_user, provider_id=provider_id)


@router.patch("/providers/{provider_id}")
async def update_auth_provider(
    provider_id: str,
    payload: AuthProviderUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AuthProviderRead:
    return await provider_service.update_provider(
        db, current_user=current_user, provider_id=provider_id, payload=payload
    )


@router.delete("/providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_auth_provider(
    provider_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await provider_service.delete_provider(db, current_user=current_user, provider_id=provider_id)


@router.post("/providers/{provider_id}/test")
async def test_auth_provider(
    provider_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProviderTestResult:
    return await provider_service.test_provider(db, current_user=current_user, provider_id=provider_id)


@router.post("/providers/{provider_id}/rotate-secret")
async def rotate_auth_provider_secret(
    provider_id: str,
    payload: RotateSecretRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AuthProviderRead:
    return await provider_service.rotate_secret(
        db, current_user=current_user, provider_id=provider_id, payload=payload
    )


# ---------------------------------------------------------------------------
# OIDC / Google / Azure browser flow (unauthenticated)
# ---------------------------------------------------------------------------

_OIDC_TYPES = {AuthProviderType.oidc, AuthProviderType.google, AuthProviderType.azure}


def _safe_return(raw: str | None) -> str:
    if not raw or not raw.startswith("/") or raw.startswith("//"):
        return "/"
    return raw


def _app_url(return_to: str) -> str:
    return f"{settings.app_base_url.rstrip('/')}{_safe_return(return_to)}"


def _reason_from_code(code: str | None) -> str | None:
    if not code:
        return None
    return code[len("oidc_"):] if code.startswith("oidc_") else code


def _login_error_url(reason: str | None = None) -> str:
    base = f"{settings.app_base_url.rstrip('/')}/login?error=auth"
    return f"{base}&reason={reason}" if reason else base


def _callback_redirect_uri(request: Request, provider) -> str:
    # Precedence: per-provider (admin UI) -> deployment config -> request origin.
    configured = ""
    if provider is not None and isinstance(provider.config, dict):
        configured = str(provider.config.get("redirect_base_url") or "").strip()
    base = (
        configured.rstrip("/")
        or settings.auth_oidc_redirect_base_url.rstrip("/")
        or str(request.base_url).rstrip("/")
    )
    return f"{base}{settings.api_prefix}/auth/oidc/{provider.id}/callback"


async def _audit_oidc_fail(provider_id: str, reason: str) -> None:
    await audit_service.try_emit_event_immediately(
        action="auth.external_login",
        resource_type="auth_provider",
        resource_id=provider_id,
        result="fail",
        metadata={"provider_id": provider_id, "reason": reason},
        actor_type="system",
    )


@router.get("/oidc/{provider_id}/start")
async def oidc_start(
    provider_id: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    return_to: str | None = None,
) -> RedirectResponse:
    provider = await provider_repo.get(db, provider_id)
    if provider is None or not provider.enabled or provider.type not in _OIDC_TYPES:
        await _audit_oidc_fail(provider_id, "provider_unavailable")
        return RedirectResponse(_login_error_url("provider_unavailable"), status_code=status.HTTP_303_SEE_OTHER)
    try:
        result = await oidc_flow.start_login(
            provider,
            return_to=_safe_return(return_to),
            redirect_uri=_callback_redirect_uri(request, provider),
        )
    except DomainError as exc:
        await _audit_oidc_fail(provider_id, "start_failed")
        return RedirectResponse(_login_error_url(_reason_from_code(exc.code)), status_code=status.HTTP_303_SEE_OTHER)
    response = RedirectResponse(result.authorize_url, status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(
        key=OIDC_TX_COOKIE,
        value=serialize_tx(result.transaction),
        max_age=TX_TTL_SECONDS,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )
    return response


@router.get("/oidc/{provider_id}/callback")
async def oidc_callback(
    provider_id: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    oidc_tx: Annotated[str | None, Cookie(alias=OIDC_TX_COOKIE)] = None,
) -> RedirectResponse:
    tx = deserialize_tx(oidc_tx)
    if tx is None or tx.provider_id != provider_id:
        await _audit_oidc_fail(provider_id, "invalid_transaction")
        response = RedirectResponse(_login_error_url("invalid_transaction"), status_code=status.HTTP_303_SEE_OTHER)
        response.delete_cookie(OIDC_TX_COOKIE, path="/")
        return response

    provider = await provider_repo.get(db, provider_id)
    if provider is None or not provider.enabled or provider.type not in _OIDC_TYPES:
        await _audit_oidc_fail(provider_id, "provider_unavailable")
        response = RedirectResponse(_login_error_url("provider_unavailable"), status_code=status.HTTP_303_SEE_OTHER)
        response.delete_cookie(OIDC_TX_COOKIE, path="/")
        return response

    try:
        result = await oidc_flow.complete_login(
            db,
            provider,
            tx=tx,
            query_params=dict(request.query_params),
            redirect_uri=_callback_redirect_uri(request, provider),
        )
    except DomainError as exc:
        response = RedirectResponse(_login_error_url(_reason_from_code(exc.code)), status_code=status.HTTP_303_SEE_OTHER)
        response.delete_cookie(OIDC_TX_COOKIE, path="/")
        return response

    token = create_access_token(result.user.id, result.user.token_version)
    response = RedirectResponse(_app_url(result.return_to), status_code=status.HTTP_303_SEE_OTHER)
    _set_session_cookie(response, token)
    response.delete_cookie(OIDC_TX_COOKIE, path="/")
    return response
