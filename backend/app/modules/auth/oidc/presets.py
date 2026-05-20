from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.models.enums import AuthProviderType
from app.modules.auth.models import AuthProvider

GOOGLE_ISSUER = "https://accounts.google.com"
GOOGLE_DISCOVERY = "https://accounts.google.com/.well-known/openid-configuration"
AZURE_AUTHORITY = "https://login.microsoftonline.com"


@dataclass(slots=True)
class EffectiveOidc:
    provider_id: str
    provider_type: AuthProviderType
    issuer: str
    discovery_url: str
    client_id: str
    scopes: list[str]
    subject_claim: str
    email_claim: str
    email_verified_claim: str
    username_claims: list[str]
    first_name_claim: str
    last_name_claim: str
    groups_claim: str | None
    team_claim: str | None
    allowed_domains: list[str]
    require_verified_email: bool
    require_pkce: bool
    # Azure tenant handling
    tenant_mode: str
    tenant_id: str | None
    allowed_tenant_ids: list[str] = field(default_factory=list)
    issuer_is_templated: bool = False

    def issuer_matches(self, token_iss: str) -> bool:
        if not self.issuer_is_templated:
            return token_iss == self.issuer
        # Azure multi-tenant: issuer is https://login.microsoftonline.com/{tid}/v2.0
        return token_iss.startswith(f"{AZURE_AUTHORITY}/") and token_iss.endswith("/v2.0")


def _str(config: dict[str, Any], key: str, default: str) -> str:
    value = config.get(key)
    return value if isinstance(value, str) and value else default


def _list(config: dict[str, Any], key: str, default: list[str]) -> list[str]:
    value = config.get(key)
    if isinstance(value, list):
        items = [v for v in value if isinstance(v, str) and v]
        if items:
            return items
    return list(default)


def effective_oidc_settings(provider: AuthProvider) -> EffectiveOidc:
    cfg = provider.config or {}
    ptype = provider.type
    common = dict(
        provider_id=provider.id,
        provider_type=ptype,
        client_id=_str(cfg, "client_id", ""),
        scopes=_list(cfg, "scopes", ["openid", "profile", "email"]),
        subject_claim=_str(cfg, "subject_claim", "sub"),
        email_claim=_str(cfg, "email_claim", "email"),
        email_verified_claim=_str(cfg, "email_verified_claim", "email_verified"),
        first_name_claim=_str(cfg, "first_name_claim", "given_name"),
        last_name_claim=_str(cfg, "last_name_claim", "family_name"),
        groups_claim=cfg.get("groups_claim") or None,
        team_claim=cfg.get("team_claim") or None,
        require_pkce=cfg.get("require_pkce", True) is not False,
        tenant_mode="single",
        tenant_id=None,
    )

    if ptype is AuthProviderType.google:
        return EffectiveOidc(
            issuer=GOOGLE_ISSUER,
            discovery_url=GOOGLE_DISCOVERY,
            username_claims=["email", "sub"],
            allowed_domains=_list(cfg, "allowed_domains", []),
            require_verified_email=True,
            **common,
        )

    if ptype is AuthProviderType.azure:
        tenant_mode = _str(cfg, "tenant_mode", "single")
        tenant_id = cfg.get("tenant_id") or None
        if tenant_mode == "single" and tenant_id:
            issuer = f"{AZURE_AUTHORITY}/{tenant_id}/v2.0"
            discovery = f"{AZURE_AUTHORITY}/{tenant_id}/v2.0/.well-known/openid-configuration"
            templated = False
        else:
            authority_segment = "organizations"
            issuer = f"{AZURE_AUTHORITY}/{authority_segment}/v2.0"
            discovery = f"{AZURE_AUTHORITY}/{authority_segment}/v2.0/.well-known/openid-configuration"
            templated = True
        merged = {**common, "tenant_mode": tenant_mode, "tenant_id": tenant_id}
        return EffectiveOidc(
            issuer=issuer,
            discovery_url=discovery,
            username_claims=["preferred_username", "email", "upn", "sub"],
            allowed_domains=[],
            require_verified_email=False,
            allowed_tenant_ids=_list(cfg, "allowed_tenant_ids", []),
            issuer_is_templated=templated,
            **merged,
        )

    # Generic OIDC
    issuer = _str(cfg, "issuer", "")
    discovery = _str(cfg, "discovery_url", "") or (
        f"{issuer.rstrip('/')}/.well-known/openid-configuration" if issuer else ""
    )
    username_claim = _str(cfg, "username_claim", "preferred_username")
    return EffectiveOidc(
        issuer=issuer,
        discovery_url=discovery,
        username_claims=[username_claim, "email", "sub"],
        allowed_domains=_list(cfg, "allowed_domains", []),
        require_verified_email=bool(provider.allow_email_linking),
        **common,
    )
