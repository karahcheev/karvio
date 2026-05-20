// Create/edit panel for an external authentication provider.
import { useMemo, useState } from "react";
import { API_BASE_URL } from "@/shared/api";
import type {
  AuthAutoAssignProjectDto,
  AuthProviderCreatePayload,
  AuthProviderDto,
  AuthProviderType,
  AuthProviderUpdatePayload,
  ProjectMemberRoleDto,
} from "@/shared/api";
import { useProjectsQuery } from "@/shared/api/query-hooks";
import { Button, CheckboxField, SelectField, SidePanel, Switch, TextField } from "@/shared/ui";
import { FieldLabel } from "./field-label";

const DEFAULT_AUTO_ASSIGN_ROLE: ProjectMemberRoleDto = "tester";

function normalizeAutoAssign(value: unknown): AuthAutoAssignProjectDto[] {
  if (!Array.isArray(value)) return [];
  const result: AuthAutoAssignProjectDto[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const projectId = (item as { project_id?: unknown }).project_id;
    const role = (item as { role?: unknown }).role;
    if (typeof projectId !== "string" || !projectId) continue;
    if (role !== "viewer" && role !== "tester" && role !== "lead" && role !== "manager") continue;
    result.push({ project_id: projectId, role });
  }
  return result;
}

type Props = Readonly<{
  provider: AuthProviderDto | null;
  createType: AuthProviderType | null;
  saving: boolean;
  testing: boolean;
  onClose: () => void;
  onCreate: (payload: AuthProviderCreatePayload) => Promise<void>;
  onUpdate: (providerId: string, payload: AuthProviderUpdatePayload) => Promise<void>;
  onTest: (providerId: string) => Promise<void>;
}>;

type FormState = {
  name: string;
  login_label: string;
  sort_order: string;
  enabled: boolean;
  auto_provision: boolean;
  default_role: "user" | "admin";
  new_user_enabled: boolean;
  allow_email_linking: boolean;
  local_admin_only: boolean;
  // LDAP
  server_url: string;
  tls_mode: "plain" | "starttls" | "ldaps";
  cert_validation: "full" | "none";
  ca_certificate: string;
  bind_mode: "service_account" | "direct_bind";
  bind_dn: string;
  base_dn: string;
  user_search_filter: string;
  user_dn_template: string;
  uid_attribute: string;
  username_attribute: string;
  email_attribute: string;
  first_name_attribute: string;
  last_name_attribute: string;
  team_attribute: string;
  timeout_seconds: string;
  // OIDC / Google / Azure
  issuer: string;
  discovery_url: string;
  client_id: string;
  scopes: string;
  subject_claim: string;
  email_claim: string;
  email_verified_claim: string;
  username_claim: string;
  first_name_claim: string;
  last_name_claim: string;
  groups_claim: string;
  allowed_domains: string;
  require_pkce: boolean;
  redirect_base_url: string;
  tenant_mode: "single" | "multi";
  tenant_id: string;
  allowed_tenant_ids: string;
  // secrets (write-only)
  client_secret: string;
  ldap_bind_password: string;
  // Auto-assign provisioned users to these projects (idempotent on every login).
  auto_assign_projects: AuthAutoAssignProjectDto[];
};

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function list(value: unknown): string {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string").join(", ") : "";
}

function splitList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function initialState(provider: AuthProviderDto | null): FormState {
  const c = (provider?.config ?? {}) as Record<string, unknown>;
  return {
    name: provider?.name ?? "",
    login_label: provider?.login_label ?? "",
    sort_order: String(provider?.sort_order ?? 100),
    enabled: provider?.enabled ?? false,
    auto_provision: provider?.auto_provision ?? true,
    default_role: provider?.default_role ?? "user",
    new_user_enabled: provider?.new_user_enabled ?? true,
    allow_email_linking: provider?.allow_email_linking ?? false,
    local_admin_only: provider?.local_admin_only ?? false,
    server_url: str(c.server_url),
    tls_mode: (str(c.tls_mode, "ldaps") as FormState["tls_mode"]) || "ldaps",
    cert_validation: (str(c.cert_validation, "full") as FormState["cert_validation"]) || "full",
    ca_certificate: str(c.ca_certificate),
    bind_mode: (str(c.bind_mode, "service_account") as FormState["bind_mode"]) || "service_account",
    bind_dn: str(c.bind_dn),
    base_dn: str(c.base_dn),
    user_search_filter: str(c.user_search_filter, "(sAMAccountName={login})"),
    user_dn_template: str(c.user_dn_template),
    uid_attribute: str(c.uid_attribute, "objectGUID"),
    username_attribute: str(c.username_attribute, "sAMAccountName"),
    email_attribute: str(c.email_attribute, "mail"),
    first_name_attribute: str(c.first_name_attribute, "givenName"),
    last_name_attribute: str(c.last_name_attribute, "sn"),
    team_attribute: str(c.team_attribute),
    timeout_seconds: String((c.timeout_seconds as number) ?? 10),
    issuer: str(c.issuer),
    discovery_url: str(c.discovery_url),
    client_id: str(c.client_id),
    scopes: list(c.scopes) || "openid, profile, email",
    subject_claim: str(c.subject_claim, "sub"),
    email_claim: str(c.email_claim, "email"),
    email_verified_claim: str(c.email_verified_claim, "email_verified"),
    username_claim: str(c.username_claim, "preferred_username"),
    first_name_claim: str(c.first_name_claim, "given_name"),
    last_name_claim: str(c.last_name_claim, "family_name"),
    groups_claim: str(c.groups_claim),
    allowed_domains: list(c.allowed_domains),
    require_pkce: c.require_pkce !== false,
    redirect_base_url: str(c.redirect_base_url),
    tenant_mode: (str(c.tenant_mode, "single") as FormState["tenant_mode"]) || "single",
    tenant_id: str(c.tenant_id),
    allowed_tenant_ids: list(c.allowed_tenant_ids),
    client_secret: "",
    ldap_bind_password: "",
    auto_assign_projects: normalizeAutoAssign(provider?.auto_assign_projects),
  };
}

const SECTION = "space-y-3 border-t border-[var(--border)] pt-4 first:border-t-0 first:pt-0";
const SECTION_TITLE = "text-sm font-semibold text-[var(--foreground)]";

export function AuthProviderFormPanel({
  provider,
  createType,
  saving,
  testing,
  onClose,
  onCreate,
  onUpdate,
  onTest,
}: Props) {
  const type: AuthProviderType = provider?.type ?? createType ?? "oidc";
  const isLocal = type === "local";
  const isLdap = type === "ldap";
  const isOidcLike = type === "oidc" || type === "google" || type === "azure";
  const isGenericOidc = type === "oidc";
  const isAzure = type === "azure";
  const isGoogle = type === "google";
  const [form, setForm] = useState<FormState>(() => initialState(provider));
  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data ?? [];
  const autoAssignByProject = useMemo(() => {
    const map = new Map<string, ProjectMemberRoleDto>();
    for (const entry of form.auto_assign_projects) map.set(entry.project_id, entry.role);
    return map;
  }, [form.auto_assign_projects]);

  function toggleAutoAssignProject(projectId: string, checked: boolean) {
    setForm((current) => {
      const filtered = current.auto_assign_projects.filter((e) => e.project_id !== projectId);
      if (checked) {
        const role = autoAssignByProject.get(projectId) ?? DEFAULT_AUTO_ASSIGN_ROLE;
        filtered.push({ project_id: projectId, role });
      }
      return { ...current, auto_assign_projects: filtered };
    });
  }

  function setAutoAssignRole(projectId: string, role: ProjectMemberRoleDto) {
    setForm((current) => ({
      ...current,
      auto_assign_projects: current.auto_assign_projects.map((entry) =>
        entry.project_id === projectId ? { ...entry, role } : entry,
      ),
    }));
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const redirectUri = useMemo(() => {
    if (!provider) return null;
    const customBase = form.redirect_base_url.trim().replace(/\/$/, "");
    if (customBase) {
      return `${customBase}/api/v1/auth/oidc/${provider.id}/callback`;
    }
    return `${API_BASE_URL}/auth/oidc/${provider.id}/callback`;
  }, [provider, form.redirect_base_url]);

  const typeLabel: Record<AuthProviderType, string> = {
    local: "Local",
    ldap: "LDAP / Active Directory",
    oidc: "OpenID Connect",
    google: "Google Workspace",
    azure: "Microsoft Entra ID",
  };

  function buildConfig(): Record<string, unknown> {
    if (isLocal) return {};
    if (isLdap) {
      return {
        server_url: form.server_url.trim(),
        tls_mode: form.tls_mode,
        cert_validation: form.cert_validation,
        ca_certificate: form.ca_certificate.trim() || null,
        bind_mode: form.bind_mode,
        bind_dn: form.bind_dn.trim() || null,
        base_dn: form.base_dn.trim(),
        user_search_filter: form.user_search_filter.trim(),
        user_dn_template: form.user_dn_template.trim() || null,
        uid_attribute: form.uid_attribute.trim(),
        username_attribute: form.username_attribute.trim(),
        email_attribute: form.email_attribute.trim(),
        first_name_attribute: form.first_name_attribute.trim(),
        last_name_attribute: form.last_name_attribute.trim(),
        team_attribute: form.team_attribute.trim() || null,
        timeout_seconds: Number(form.timeout_seconds) || 10,
      };
    }
    if (isGoogle) {
      return {
        client_id: form.client_id.trim(),
        allowed_domains: splitList(form.allowed_domains),
        redirect_base_url: form.redirect_base_url.trim() || null,
      };
    }
    if (isAzure) {
      return {
        client_id: form.client_id.trim(),
        tenant_mode: form.tenant_mode,
        tenant_id: form.tenant_id.trim() || null,
        allowed_tenant_ids: splitList(form.allowed_tenant_ids),
        groups_claim: form.groups_claim.trim() || null,
        redirect_base_url: form.redirect_base_url.trim() || null,
      };
    }
    // generic OIDC
    return {
      issuer: form.issuer.trim(),
      discovery_url: form.discovery_url.trim() || null,
      client_id: form.client_id.trim(),
      scopes: splitList(form.scopes),
      subject_claim: form.subject_claim.trim(),
      email_claim: form.email_claim.trim(),
      email_verified_claim: form.email_verified_claim.trim(),
      username_claim: form.username_claim.trim(),
      first_name_claim: form.first_name_claim.trim(),
      last_name_claim: form.last_name_claim.trim(),
      groups_claim: form.groups_claim.trim() || null,
      allowed_domains: splitList(form.allowed_domains),
      require_pkce: form.require_pkce,
      redirect_base_url: form.redirect_base_url.trim() || null,
    };
  }

  function secretsForCreate(): Record<string, string> {
    const secrets: Record<string, string> = {};
    if (isOidcLike && form.client_secret.trim()) secrets.client_secret = form.client_secret.trim();
    if (isLdap && form.ldap_bind_password.trim()) secrets.ldap_bind_password = form.ldap_bind_password.trim();
    return secrets;
  }

  function secretsForUpdate(): Record<string, string | null> | undefined {
    const secrets: Record<string, string | null> = {};
    if (isOidcLike && form.client_secret.trim()) secrets.client_secret = form.client_secret.trim();
    if (isLdap && form.ldap_bind_password.trim()) secrets.ldap_bind_password = form.ldap_bind_password.trim();
    return Object.keys(secrets).length ? secrets : undefined;
  }

  async function handleSave() {
    if (provider) {
      if (isLocal) {
        await onUpdate(provider.id, {
          login_label: form.login_label.trim(),
          enabled: form.enabled,
          local_admin_only: form.local_admin_only,
          sort_order: Number(form.sort_order) || 0,
        });
        return;
      }
      await onUpdate(provider.id, {
        name: form.name.trim(),
        login_label: form.login_label.trim(),
        sort_order: Number(form.sort_order) || 0,
        enabled: form.enabled,
        auto_provision: form.auto_provision,
        default_role: form.default_role,
        new_user_enabled: form.new_user_enabled,
        allow_email_linking: form.allow_email_linking,
        config: buildConfig(),
        secrets: secretsForUpdate(),
        auto_assign_projects: form.auto_assign_projects,
      });
      return;
    }
    await onCreate({
      type,
      name: form.name.trim(),
      login_label: form.login_label.trim() || form.name.trim(),
      sort_order: Number(form.sort_order) || 100,
      enabled: form.enabled,
      auto_provision: form.auto_provision,
      default_role: form.default_role,
      new_user_enabled: form.new_user_enabled,
      allow_email_linking: form.allow_email_linking,
      config: buildConfig(),
      secrets: secretsForCreate(),
      auto_assign_projects: form.auto_assign_projects,
    });
  }

  const secretConfigured = isLdap
    ? provider?.secrets.ldap_bind_password_configured
    : provider?.secrets.client_secret_configured;

  return (
    <SidePanel
      title={provider ? `Edit ${provider.name}` : `New ${typeLabel[type]} provider`}
      subtitle={typeLabel[type]}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          <div>
            {provider ? (
              <Button type="button" variant="outline" onClick={() => onTest(provider.id)} disabled={testing || saving}>
                {testing ? "Testing..." : "Test connection"}
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <section className={SECTION}>
          <h3 className={SECTION_TITLE}>Basic settings</h3>
          {!isLocal ? (
            <TextField
              label={
                <FieldLabel tip="Internal display name for this provider, shown only to administrators in this list. Not visible to end users.">
                  Name
                </FieldLabel>
              }
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Corporate SSO"
            />
          ) : null}
          <TextField
            label={
              <FieldLabel tip="Text shown to users on the login page (button caption for SSO, or the heading above the username/password form).">
                Login label
              </FieldLabel>
            }
            value={form.login_label}
            onChange={(e) => set("login_label", e.target.value)}
            placeholder={isOidcLike ? "Continue with SSO" : "Username and password"}
          />
          <TextField
            label={
              <FieldLabel tip="Controls ordering on the login page — providers with a lower number appear first.">
                Sort order
              </FieldLabel>
            }
            type="number"
            value={form.sort_order}
            onChange={(e) => set("sort_order", e.target.value)}
          />
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
            <Switch checked={form.enabled} onCheckedChange={(v) => set("enabled", v)} />
            <FieldLabel tip="When off, this provider is hidden from the login page and cannot be used to sign in. A misconfigured provider cannot be enabled.">
              Enabled
            </FieldLabel>
          </div>
          {isLocal ? (
            <CheckboxField
              label={
                <FieldLabel tip="Break-glass mode: the local username/password form is shown only to system administrators, hiding it from regular users while keeping an admin recovery path.">
                  Available to system admins only (break-glass)
                </FieldLabel>
              }
              checked={form.local_admin_only}
              onChange={(e) => set("local_admin_only", e.target.checked)}
            />
          ) : null}
        </section>

        {isLdap ? (
          <section className={SECTION}>
            <h3 className={SECTION_TITLE}>Connection</h3>
            <TextField
              label={
                <FieldLabel tip="LDAP/AD server URL including scheme and port. Use ldaps:// for TLS (port 636) or ldap:// for plain/StartTLS (port 389).">
                  Server URL
                </FieldLabel>
              }
              value={form.server_url}
              onChange={(e) => set("server_url", e.target.value)}
              placeholder="ldaps://ldap.example.com:636"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label={
                  <FieldLabel tip="LDAPS = implicit TLS on the LDAPS port. StartTLS = upgrade a plain connection to TLS. Plain = no encryption (not recommended).">
                    TLS mode
                  </FieldLabel>
                }
                value={form.tls_mode}
                onChange={(e) => set("tls_mode", e.target.value as FormState["tls_mode"])}
              >
                <option value="ldaps">LDAPS</option>
                <option value="starttls">StartTLS</option>
                <option value="plain">Plain LDAP</option>
              </SelectField>
              <SelectField
                label={
                  <FieldLabel tip="Full = verify the server certificate against trusted CAs (recommended). None = skip certificate verification (insecure, test only).">
                    Certificate validation
                  </FieldLabel>
                }
                value={form.cert_validation}
                onChange={(e) => set("cert_validation", e.target.value as FormState["cert_validation"])}
              >
                <option value="full">Full verification</option>
                <option value="none">No verification</option>
              </SelectField>
            </div>
            <TextField
              label={
                <FieldLabel tip="Optional PEM-encoded CA certificate used to validate the server when it is signed by a private/internal CA.">
                  CA certificate (optional, PEM)
                </FieldLabel>
              }
              value={form.ca_certificate}
              onChange={(e) => set("ca_certificate", e.target.value)}
            />
            <SelectField
              label={
                <FieldLabel tip="Service account: bind with a service DN, search for the user, then rebind as the user. Direct bind: build the user DN from a template and bind directly (no service account).">
                  Bind mode
                </FieldLabel>
              }
              value={form.bind_mode}
              onChange={(e) => set("bind_mode", e.target.value as FormState["bind_mode"])}
            >
              <option value="service_account">Service account + user search</option>
              <option value="direct_bind">Direct user bind (DN template)</option>
            </SelectField>
            {form.bind_mode === "service_account" ? (
              <>
                <TextField
                  label={
                    <FieldLabel tip="Distinguished Name of the read-only service account used to search the directory before the user binds.">
                      Service bind DN
                    </FieldLabel>
                  }
                  value={form.bind_dn}
                  onChange={(e) => set("bind_dn", e.target.value)}
                  placeholder="cn=svc,dc=example,dc=com"
                />
                <TextField
                  label={
                    <FieldLabel tip="Password for the service bind DN. Write-only — leave blank to keep the currently stored value.">
                      Service bind password
                    </FieldLabel>
                  }
                  type="password"
                  value={form.ldap_bind_password}
                  onChange={(e) => set("ldap_bind_password", e.target.value)}
                  placeholder={secretConfigured ? "Configured — leave blank to keep" : ""}
                />
              </>
            ) : (
              <TextField
                label={
                  <FieldLabel tip="Template used to build the user DN for a direct bind. {login} is replaced with the submitted username.">
                    User DN template
                  </FieldLabel>
                }
                value={form.user_dn_template}
                onChange={(e) => set("user_dn_template", e.target.value)}
                placeholder="uid={login},ou=people,dc=example,dc=com"
              />
            )}
            <TextField
              label={
                <FieldLabel tip="Base DN under which user (and group) entries are searched.">
                  Base DN
                </FieldLabel>
              }
              value={form.base_dn}
              onChange={(e) => set("base_dn", e.target.value)}
              placeholder="dc=example,dc=com"
            />
            <TextField
              label={
                <FieldLabel tip="LDAP filter to locate the user. {login} is replaced with the submitted username and escaped, e.g. (sAMAccountName={login}) or (mail={login}).">
                  User search filter
                </FieldLabel>
              }
              value={form.user_search_filter}
              onChange={(e) => set("user_search_filter", e.target.value)}
            />
            <TextField
              label={
                <FieldLabel tip="Maximum seconds to wait for the LDAP server to connect and respond before failing the login.">
                  Connection timeout (seconds)
                </FieldLabel>
              }
              type="number"
              value={form.timeout_seconds}
              onChange={(e) => set("timeout_seconds", e.target.value)}
            />
          </section>
        ) : null}

        {isLdap ? (
          <section className={SECTION}>
            <h3 className={SECTION_TITLE}>User mapping</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label={
                  <FieldLabel tip="Attribute holding a stable, immutable unique id used as the external identity key, e.g. objectGUID, entryUUID or uid.">
                    Unique id attribute
                  </FieldLabel>
                }
                value={form.uid_attribute}
                onChange={(e) => set("uid_attribute", e.target.value)}
              />
              <TextField
                label={
                  <FieldLabel tip="Attribute mapped to the Karvio username when provisioning a new user.">
                    Username attribute
                  </FieldLabel>
                }
                value={form.username_attribute}
                onChange={(e) => set("username_attribute", e.target.value)}
              />
              <TextField
                label={
                  <FieldLabel tip="Attribute containing the user's email address, used for profile sync and optional email linking.">
                    Email attribute
                  </FieldLabel>
                }
                value={form.email_attribute}
                onChange={(e) => set("email_attribute", e.target.value)}
              />
              <TextField
                label={
                  <FieldLabel tip="Optional attribute mapped to the user's team/department on the Karvio profile.">
                    Team attribute
                  </FieldLabel>
                }
                value={form.team_attribute}
                onChange={(e) => set("team_attribute", e.target.value)}
              />
              <TextField
                label={
                  <FieldLabel tip="Attribute mapped to the user's first (given) name.">
                    First name attribute
                  </FieldLabel>
                }
                value={form.first_name_attribute}
                onChange={(e) => set("first_name_attribute", e.target.value)}
              />
              <TextField
                label={
                  <FieldLabel tip="Attribute mapped to the user's last (family) name / surname.">
                    Last name attribute
                  </FieldLabel>
                }
                value={form.last_name_attribute}
                onChange={(e) => set("last_name_attribute", e.target.value)}
              />
            </div>
          </section>
        ) : null}

        {isOidcLike ? (
          <section className={SECTION}>
            <h3 className={SECTION_TITLE}>Connection</h3>
            {isGenericOidc ? (
              <>
                <TextField
                  label={
                    <FieldLabel tip="OIDC issuer URL. Its /.well-known/openid-configuration document is fetched to discover the authorization, token and JWKS endpoints. Must exactly match the iss claim in tokens.">
                      Issuer URL
                    </FieldLabel>
                  }
                  value={form.issuer}
                  onChange={(e) => set("issuer", e.target.value)}
                  placeholder="https://idp.example.com"
                />
                <TextField
                  label={
                    <FieldLabel tip="Override the discovery document URL when the provider does not host it at the default issuer-relative path.">
                      Discovery URL override (optional)
                    </FieldLabel>
                  }
                  value={form.discovery_url}
                  onChange={(e) => set("discovery_url", e.target.value)}
                />
              </>
            ) : null}
            {isAzure ? (
              <>
                <SelectField
                  label={
                    <FieldLabel tip="Single tenant: only one Entra ID directory may sign in. Multi-tenant: accept multiple directories (optionally restricted by allowed tenant IDs).">
                      Tenant mode
                    </FieldLabel>
                  }
                  value={form.tenant_mode}
                  onChange={(e) => set("tenant_mode", e.target.value as FormState["tenant_mode"])}
                >
                  <option value="single">Single tenant</option>
                  <option value="multi">Multi-tenant</option>
                </SelectField>
                {form.tenant_mode === "single" ? (
                  <TextField
                    label={
                      <FieldLabel tip="Entra ID / Azure AD Directory (tenant) ID. Defines the issuer and is validated against the token's tid claim.">
                        Tenant ID
                      </FieldLabel>
                    }
                    value={form.tenant_id}
                    onChange={(e) => set("tenant_id", e.target.value)}
                  />
                ) : (
                  <TextField
                    label={
                      <FieldLabel tip="Comma-separated tenant IDs allowed to sign in when multi-tenant. Leave empty to accept any tenant (use with caution).">
                        Allowed tenant IDs (comma separated)
                      </FieldLabel>
                    }
                    value={form.allowed_tenant_ids}
                    onChange={(e) => set("allowed_tenant_ids", e.target.value)}
                  />
                )}
              </>
            ) : null}
            <TextField
              label={
                <FieldLabel tip="OAuth2 client ID issued by the identity provider for this application.">
                  Client ID
                </FieldLabel>
              }
              value={form.client_id}
              onChange={(e) => set("client_id", e.target.value)}
            />
            <TextField
              label={
                <FieldLabel tip="OAuth2 client secret. Write-only — stored encrypted and never returned; leave blank to keep the existing value.">
                  Client secret
                </FieldLabel>
              }
              type="password"
              value={form.client_secret}
              onChange={(e) => set("client_secret", e.target.value)}
              placeholder={secretConfigured ? "Configured — leave blank to keep" : ""}
            />
            <TextField
              label={
                <FieldLabel tip="Public origin of this Karvio backend, e.g. https://karvio.example.com. Determines the redirect URI registered at the provider. Leave blank to use the deployment default or the request origin.">
                  Redirect base URL (optional)
                </FieldLabel>
              }
              value={form.redirect_base_url}
              onChange={(e) => set("redirect_base_url", e.target.value)}
              placeholder="https://karvio.example.com"
            />
            {redirectUri ? (
              <TextField
                label={
                  <FieldLabel tip="Read-only. Register this exact value in the identity provider's list of allowed redirect URIs.">
                    Redirect URI (copy into the identity provider)
                  </FieldLabel>
                }
                value={redirectUri}
                readOnly
              />
            ) : (
              <p className="text-xs text-[var(--muted-foreground)]">
                The full redirect URI is shown after the provider is created. Set the redirect base
                URL above, save, then copy the generated URI into your identity provider.
              </p>
            )}
            {isGenericOidc ? (
              <>
                <TextField
                  label={
                    <FieldLabel tip="Space-separated OAuth scopes requested at sign-in. Must include 'openid'; 'profile email' are needed for name/email claims.">
                      Scopes
                    </FieldLabel>
                  }
                  value={form.scopes}
                  onChange={(e) => set("scopes", e.target.value)}
                />
                <CheckboxField
                  label={
                    <FieldLabel tip="Use PKCE (S256) for the authorization code flow. Recommended; disable only if the provider does not support it.">
                      Require PKCE
                    </FieldLabel>
                  }
                  checked={form.require_pkce}
                  onChange={(e) => set("require_pkce", e.target.checked)}
                />
              </>
            ) : null}
            {isGoogle || isGenericOidc ? (
              <TextField
                label={
                  <FieldLabel tip="Comma-separated email domains allowed to sign in. Users outside these domains are rejected before provisioning. Leave empty to allow any domain.">
                    Allowed email domains (comma separated, optional)
                  </FieldLabel>
                }
                value={form.allowed_domains}
                onChange={(e) => set("allowed_domains", e.target.value)}
                placeholder="example.com"
              />
            ) : null}
          </section>
        ) : null}

        {isGenericOidc ? (
          <section className={SECTION}>
            <h3 className={SECTION_TITLE}>Claim mapping</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label={
                  <FieldLabel tip="ID-token claim holding the stable, unique subject identifier used as the external identity key (default: sub).">
                    Subject claim
                  </FieldLabel>
                }
                value={form.subject_claim}
                onChange={(e) => set("subject_claim", e.target.value)}
              />
              <TextField
                label={
                  <FieldLabel tip="Claim containing the user's email address (default: email).">
                    Email claim
                  </FieldLabel>
                }
                value={form.email_claim}
                onChange={(e) => set("email_claim", e.target.value)}
              />
              <TextField
                label={
                  <FieldLabel tip="Boolean claim indicating the email is verified by the provider (default: email_verified). Required for email-based linking.">
                    Email verified claim
                  </FieldLabel>
                }
                value={form.email_verified_claim}
                onChange={(e) => set("email_verified_claim", e.target.value)}
              />
              <TextField
                label={
                  <FieldLabel tip="Claim used as the Karvio username when provisioning. Falls back to email then subject if absent.">
                    Username claim
                  </FieldLabel>
                }
                value={form.username_claim}
                onChange={(e) => set("username_claim", e.target.value)}
              />
              <TextField
                label={
                  <FieldLabel tip="Claim mapped to the user's first (given) name (default: given_name).">
                    First name claim
                  </FieldLabel>
                }
                value={form.first_name_claim}
                onChange={(e) => set("first_name_claim", e.target.value)}
              />
              <TextField
                label={
                  <FieldLabel tip="Claim mapped to the user's last (family) name (default: family_name).">
                    Last name claim
                  </FieldLabel>
                }
                value={form.last_name_claim}
                onChange={(e) => set("last_name_claim", e.target.value)}
              />
              <TextField
                label={
                  <FieldLabel tip="Optional claim carrying the user's groups. Stored for future group-to-role mapping; not enforced yet.">
                    Groups claim (optional)
                  </FieldLabel>
                }
                value={form.groups_claim}
                onChange={(e) => set("groups_claim", e.target.value)}
              />
            </div>
          </section>
        ) : null}

        {!isLocal ? (
          <section className={SECTION}>
            <h3 className={SECTION_TITLE}>Provisioning</h3>
            <CheckboxField
              label={
                <FieldLabel tip="When on, a Karvio user is created automatically on first successful external login. When off, only users that already exist (or can be email-linked) may sign in.">
                  Auto-create users on first login
                </FieldLabel>
              }
              checked={form.auto_provision}
              onChange={(e) => set("auto_provision", e.target.checked)}
            />
            <SelectField
              label={
                <FieldLabel tip="Global role assigned to users created by auto-provisioning.">
                  Default global role for new users
                </FieldLabel>
              }
              value={form.default_role}
              onChange={(e) => set("default_role", e.target.value as FormState["default_role"])}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </SelectField>
            <CheckboxField
              label={
                <FieldLabel tip="If off, auto-provisioned users are created disabled and cannot sign in until an administrator enables them.">
                  New users are enabled
                </FieldLabel>
              }
              checked={form.new_user_enabled}
              onChange={(e) => set("new_user_enabled", e.target.checked)}
            />
            <CheckboxField
              label={
                <FieldLabel tip="Allow linking an external identity to an existing Karvio user when there is exactly one enabled account with the same verified email. Disable to require manual linking.">
                  Allow linking to existing users by verified email
                </FieldLabel>
              }
              checked={form.allow_email_linking}
              onChange={(e) => set("allow_email_linking", e.target.checked)}
            />
          </section>
        ) : null}

        {!isLocal ? (
          <section className={SECTION}>
            <h3 className={SECTION_TITLE}>Auto-assign to projects</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Users who sign in through this provider are added to the selected projects with the
              chosen role on every successful login. Existing memberships are never downgraded.
            </p>
            {projectsQuery.isLoading ? (
              <p className="text-xs text-[var(--muted-foreground)]">Loading projects…</p>
            ) : projects.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">No projects yet.</p>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => {
                  const checked = autoAssignByProject.has(project.id);
                  const role = autoAssignByProject.get(project.id) ?? DEFAULT_AUTO_ASSIGN_ROLE;
                  return (
                    <div key={project.id} className="flex items-center justify-between gap-3">
                      <CheckboxField
                        label={project.name}
                        checked={checked}
                        onChange={(e) => toggleAutoAssignProject(project.id, e.target.checked)}
                      />
                      {checked ? (
                        <select
                          className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
                          value={role}
                          onChange={(e) =>
                            setAutoAssignRole(project.id, e.target.value as ProjectMemberRoleDto)
                          }
                        >
                          <option value="viewer">Viewer</option>
                          <option value="tester">Tester</option>
                          <option value="lead">Lead</option>
                          <option value="manager">Manager</option>
                        </select>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </SidePanel>
  );
}
