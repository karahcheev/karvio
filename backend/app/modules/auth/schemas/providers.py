from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.models.enums import AuthProviderType, ProjectMemberRole, UserRole

DEFAULT_LOCAL_LABEL = "Username and password"

# Secret keys that may exist per provider type. Secrets are write-only: they are
# accepted on create/update but never returned by the API.
SECRET_FIELDS: dict[AuthProviderType, tuple[str, ...]] = {
    AuthProviderType.local: (),
    AuthProviderType.ldap: ("ldap_bind_password",),
    AuthProviderType.oidc: ("client_secret",),
    AuthProviderType.google: ("client_secret",),
    AuthProviderType.azure: ("client_secret",),
}


# ---------------------------------------------------------------------------
# Per-type non-secret configuration models (validated by the service layer)
# ---------------------------------------------------------------------------


class LocalConfig(BaseModel):
    model_config = {"extra": "forbid"}


class LdapConfig(BaseModel):
    server_url: str
    tls_mode: Literal["plain", "starttls", "ldaps"] = "ldaps"
    cert_validation: Literal["full", "none"] = "full"
    ca_certificate: str | None = None
    bind_mode: Literal["service_account", "direct_bind"] = "service_account"
    bind_dn: str | None = None
    base_dn: str
    user_search_filter: str = "(sAMAccountName={login})"
    user_dn_template: str | None = None
    uid_attribute: str = "objectGUID"
    username_attribute: str = "sAMAccountName"
    email_attribute: str = "mail"
    first_name_attribute: str = "givenName"
    last_name_attribute: str = "sn"
    team_attribute: str | None = None
    group_search_base: str | None = None
    group_filter: str | None = None
    timeout_seconds: float = 10.0

    model_config = {"extra": "forbid"}


class OidcConfig(BaseModel):
    issuer: str
    discovery_url: str | None = None
    client_id: str
    scopes: list[str] = Field(default_factory=lambda: ["openid", "profile", "email"])
    subject_claim: str = "sub"
    email_claim: str = "email"
    email_verified_claim: str = "email_verified"
    username_claim: str = "preferred_username"
    first_name_claim: str = "given_name"
    last_name_claim: str = "family_name"
    team_claim: str | None = None
    groups_claim: str | None = None
    allowed_domains: list[str] = Field(default_factory=list)
    require_pkce: bool = True
    # Optional public base URL the IdP redirects back to. When empty the
    # deployment-level setting or the request origin is used.
    redirect_base_url: str | None = None

    model_config = {"extra": "forbid"}


class GoogleConfig(BaseModel):
    client_id: str
    allowed_domains: list[str] = Field(default_factory=list)
    redirect_base_url: str | None = None

    model_config = {"extra": "forbid"}


class AzureConfig(BaseModel):
    client_id: str
    tenant_mode: Literal["single", "multi"] = "single"
    tenant_id: str | None = None
    allowed_tenant_ids: list[str] = Field(default_factory=list)
    groups_claim: str | None = None
    redirect_base_url: str | None = None

    model_config = {"extra": "forbid"}


CONFIG_MODELS: dict[AuthProviderType, type[BaseModel]] = {
    AuthProviderType.local: LocalConfig,
    AuthProviderType.ldap: LdapConfig,
    AuthProviderType.oidc: OidcConfig,
    AuthProviderType.google: GoogleConfig,
    AuthProviderType.azure: AzureConfig,
}


# ---------------------------------------------------------------------------
# Group mapping (model present; runtime enforcement deferred to a later phase)
# ---------------------------------------------------------------------------


class GroupMappingEntry(BaseModel):
    external_value: str = Field(min_length=1, max_length=512)
    global_role: UserRole | None = None
    project_id: str | None = None
    project_role: ProjectMemberRole | None = None

    model_config = {"extra": "forbid"}


class AutoAssignProjectEntry(BaseModel):
    project_id: str = Field(min_length=1, max_length=64)
    role: ProjectMemberRole

    model_config = {"extra": "forbid"}


# ---------------------------------------------------------------------------
# Admin API payloads / responses
# ---------------------------------------------------------------------------


class AuthProviderCreate(BaseModel):
    type: AuthProviderType
    name: str = Field(min_length=1, max_length=120)
    login_label: str | None = Field(default=None, max_length=120)
    enabled: bool = False
    sort_order: int = 100
    auto_provision: bool = True
    default_role: UserRole = UserRole.user
    new_user_enabled: bool = True
    allow_email_linking: bool = False
    local_admin_only: bool = False
    config: dict[str, Any] = Field(default_factory=dict)
    secrets: dict[str, str] = Field(default_factory=dict)
    group_mapping: list[GroupMappingEntry] = Field(default_factory=list)
    full_group_sync: bool = False
    auto_assign_projects: list[AutoAssignProjectEntry] = Field(default_factory=list)

    model_config = {"extra": "forbid"}


class AuthProviderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    login_label: str | None = Field(default=None, max_length=120)
    enabled: bool | None = None
    sort_order: int | None = None
    auto_provision: bool | None = None
    default_role: UserRole | None = None
    new_user_enabled: bool | None = None
    allow_email_linking: bool | None = None
    local_admin_only: bool | None = None
    config: dict[str, Any] | None = None
    # A key mapped to null clears that secret; otherwise it replaces it.
    secrets: dict[str, str | None] | None = None
    group_mapping: list[GroupMappingEntry] | None = None
    full_group_sync: bool | None = None
    auto_assign_projects: list[AutoAssignProjectEntry] | None = None

    model_config = {"extra": "forbid"}


class RotateSecretRequest(BaseModel):
    secret_name: str = Field(min_length=1, max_length=64)
    value: str | None = None

    model_config = {"extra": "forbid"}


class ProviderSecretsState(BaseModel):
    client_secret_configured: bool = False
    ldap_bind_password_configured: bool = False


class AuthProviderRead(BaseModel):
    id: str
    type: AuthProviderType
    name: str
    login_label: str
    enabled: bool
    sort_order: int
    auto_provision: bool
    default_role: UserRole
    new_user_enabled: bool
    allow_email_linking: bool
    local_admin_only: bool
    config: dict[str, Any]
    group_mapping: list[GroupMappingEntry]
    full_group_sync: bool
    auto_assign_projects: list[AutoAssignProjectEntry]
    secrets: ProviderSecretsState
    status: Literal["enabled", "disabled", "misconfigured"]
    last_tested_at: datetime | None = None
    last_test_status: str | None = None
    last_test_error: str | None = None
    created_at: datetime
    updated_at: datetime


class AuthProviderList(BaseModel):
    items: list[AuthProviderRead] = Field(default_factory=list)


class ProviderTestCheck(BaseModel):
    name: str
    passed: bool
    detail: str | None = None


class ProviderTestResult(BaseModel):
    status: Literal["success", "fail"]
    tested_at: datetime
    detail: str | None = None
    checks: list[ProviderTestCheck] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Public (unauthenticated) login page configuration
# ---------------------------------------------------------------------------


class PublicLocalLogin(BaseModel):
    enabled: bool
    label: str


class PublicProvider(BaseModel):
    id: str
    type: AuthProviderType
    label: str
    sort_order: int
    uses_password_form: bool = False


class PublicAuthConfig(BaseModel):
    local_login: PublicLocalLogin
    providers: list[PublicProvider] = Field(default_factory=list)
