# Requirements: LDAP and OpenID Connect Authentication Providers

## Goal

Add administrator-configurable external authentication to Karvio so organizations can let users sign in through:

- LDAP / Active Directory username and password authentication.
- Generic OpenID Connect providers.
- Google Workspace through OpenID Connect.
- Microsoft Entra ID / Azure AD through OpenID Connect.

The existing local username/password login must continue to work unless an administrator explicitly disables it. External authentication must produce the same Karvio session model as the current `/auth/login` flow: the backend sets the HTTP-only session cookie and `/auth/me` returns the authenticated user with system role and project memberships.

## Current State

Karvio currently supports local users stored in the `users` table. Login is handled by `POST /auth/login`, which validates `username` and `password_hash`, rejects disabled users, updates `last_login_at`, records audit events, and sets a JWT session cookie. The login page only shows username/password fields.

This feature should extend that model instead of replacing it:

- Users remain Karvio users with `id`, `username`, optional profile fields, `is_enabled`, global `role`, and project memberships.
- Project access remains controlled by Karvio project memberships.
- External providers are used only to verify identity and optionally sync profile/group data.

## Provider Types

### Local

Local login is the current username/password flow. It should be represented in the authentication settings UI as a built-in provider with limited configuration:

- Enabled/disabled toggle.
- Optional label shown on the login page, default `Username and password`.
- Optional restriction that local login is available only to system admins, useful as a break-glass path.

At least one active administrator sign-in path must remain available. The system must prevent disabling the last usable admin path.

### LDAP / Active Directory

LDAP authentication should support organizations that use Active Directory or LDAP-compatible directories.

Required configuration:

- Provider name and enabled state.
- Server URL, for example `ldap://ldap.example.com:389` or `ldaps://ldap.example.com:636`.
- TLS mode: plain LDAP, StartTLS, or LDAPS.
- Certificate validation mode and optional CA certificate upload/paste field.
- Bind mode:
  - Service account bind plus user search.
  - Direct user bind using a configurable DN template.
- Service bind DN and service bind password, required only for service account mode.
- Base DN.
- User search filter, for example `(sAMAccountName={login})` or `(mail={login})`.
- User unique id attribute, for example `objectGUID`, `entryUUID`, or `uid`.
- Username attribute.
- Email attribute.
- First name attribute.
- Last name attribute.
- Team/department attribute.
- Optional group search base and group filter.
- Optional timeout and connection test settings.

Runtime behavior:

- User submits username and password on the login page.
- Backend validates credentials against the configured LDAP provider.
- Backend maps the LDAP identity to a Karvio user by provider subject id first, then by verified email if configured to allow linking.
- If no Karvio user exists and auto-provisioning is enabled, create the user with `role=user`, `is_enabled=true`, and no project memberships unless group mapping assigns them.
- If auto-provisioning is disabled, reject login with a generic access-denied message.
- On successful login, update profile fields according to the provider sync policy.
- Disabled Karvio users must not be able to log in even if LDAP authentication succeeds.

### Generic OpenID Connect

Generic OIDC should support any standards-compliant provider.

Required configuration:

- Provider name, enabled state, and login button label.
- Issuer URL.
- Discovery URL override, optional.
- Client ID.
- Client secret.
- Redirect URI, displayed as read-only for copying into the identity provider.
- Scopes, default `openid profile email`.
- Claim mapping:
  - Subject claim, default `sub`.
  - Email claim, default `email`.
  - Email verified claim, default `email_verified`.
  - Username claim, default preferred order `preferred_username`, `email`, `sub`.
  - First name claim, default `given_name`.
  - Last name claim, default `family_name`.
  - Team claim, optional.
  - Groups claim, optional.
- Optional allowed domains list for email domain restrictions.
- Optional PKCE requirement toggle, default enabled.

Runtime behavior:

- Login page shows an external provider button.
- User is redirected to the provider authorization endpoint.
- Backend handles the callback, validates state, nonce, issuer, audience, signature, expiration, and token use.
- Backend maps or provisions a Karvio user.
- Backend sets the existing session cookie and redirects the user to the originally requested Karvio URL or `/`.

### Google Workspace

Google should be a preset over OIDC, not a separate protocol implementation.

Preset defaults:

- Issuer: `https://accounts.google.com`.
- Scopes: `openid profile email`.
- Subject claim: `sub`.
- Email claim: `email`.
- Email verified claim: `email_verified`.
- First name claim: `given_name`.
- Last name claim: `family_name`.

Additional requirements:

- Admin can restrict login to one or more allowed Google Workspace domains.
- If domain restriction is configured, users outside the allowed domains are rejected before provisioning.
- Email must be verified before account linking or provisioning.

### Microsoft Entra ID / Azure AD

Azure should be a preset over OIDC.

Required configuration:

- Tenant mode:
  - Single tenant with Tenant ID.
  - Multi-tenant, if explicitly enabled by admin.
- Client ID.
- Client secret.
- Redirect URI, read-only.
- Optional allowed tenant IDs for multi-tenant mode.
- Optional group claim mapping.

Preset defaults:

- Issuer/discovery based on tenant.
- Scopes: `openid profile email`.
- Subject mapping should use a stable provider subject. Do not rely only on email.
- Username fallback order: `preferred_username`, `email`, `upn`, `sub`.

Additional requirements:

- Validate tenant claim for single-tenant and allowed-tenant configurations.
- Treat email/UPN as mutable display or login data, not as the primary external identity key.

## Admin UI Requirements

Add an admin-only authentication settings area under `Settings`. Preferred placement: a new `Authentication` tab separate from generic `Integrations`, because these settings affect system access.

The page should use existing shared controls and settings layout patterns.

### Authentication Settings List

Show a list/table of configured providers:

| Column | Description |
| --- | --- |
| Status | Enabled, disabled, or misconfigured. |
| Type | Local, LDAP, OpenID Connect, Google, Azure. |
| Name | Admin-defined display name. |
| Login label | Text shown on the login page. |
| Auto-provisioning | Enabled/disabled. |
| Last tested | Timestamp and result of latest test. |
| Actions | Edit, test connection, enable/disable, delete where allowed. |

Local provider cannot be deleted.

### Provider Form

The create/edit flow should be a modal or side panel using sections:

1. Basic settings: type, name, login label, enabled toggle.
2. Connection settings: protocol-specific fields.
3. User mapping: subject, username, email, first name, last name, team.
4. Provisioning: auto-create users, default global role, enabled state for new users.
5. Group mapping: optional mapping from LDAP/OIDC groups to Karvio system roles and project memberships.
6. Login page behavior: sort order, button visibility, fallback local login behavior.
7. Test and save: validate configuration before enabling.

Secrets must use password inputs and write-only behavior:

- Existing secrets are never returned in API responses.
- UI shows `Configured` instead of the secret value.
- Admin can replace or clear a secret.

### Test Connection

Admins must be able to test provider configuration before enabling it.

LDAP test should verify:

- Server reachability.
- TLS/certificate validity.
- Service bind or direct bind template validity.
- User search can run.
- Attribute mappings can be read for a sample username, if provided.

OIDC/Google/Azure test should verify:

- Discovery document is reachable.
- Authorization, token, and JWKS endpoints are available.
- Client ID is present.
- Client secret is present when required.
- Redirect URI is displayed and matches expected callback path.

The test result should be persisted with timestamp, status, and sanitized error details.

## Login Page Requirements

The login page must be driven by public authentication configuration returned by the backend. Do not hard-code provider visibility in the UI.

### Public Auth Config Endpoint

Add an unauthenticated endpoint that returns only safe display data:

```json
{
  "local_login": {
    "enabled": true,
    "label": "Username and password"
  },
  "providers": [
    {
      "id": "auth_provider_google",
      "type": "google",
      "label": "Continue with Google",
      "sort_order": 10
    },
    {
      "id": "auth_provider_azure",
      "type": "azure",
      "label": "Continue with Microsoft",
      "sort_order": 20
    },
    {
      "id": "auth_provider_ldap",
      "type": "ldap",
      "label": "Corporate LDAP",
      "sort_order": 30,
      "uses_password_form": true
    }
  ]
}
```

This endpoint must not expose issuer URLs, LDAP hosts, client IDs, secrets, bind DNs, filters, claim mappings, group mappings, or internal error details.

### Login Layout

The page should support these states:

- Local login only: show the current username/password form.
- OIDC providers only: show provider buttons and no password form.
- Local plus OIDC: show provider buttons first, then a visual divider, then username/password.
- LDAP plus local: show a sign-in method selector if multiple password-based providers are enabled, or a single username/password form if only one password-based method is active.
- No enabled provider: show a system unavailable message with no credential fields.

Recommended UI behavior:

- Use one full-width button per OIDC provider.
- Use recognizable icons for Google and Microsoft if the existing icon library supports them; otherwise use neutral provider buttons without custom SVG logos.
- Keep error messages generic: `Unable to sign in with the selected method.`
- Preserve return URL after redirect login.
- Disable buttons while redirects or login requests are in progress.
- On callback failure, return to `/login` with a generic error and an audit event on the backend.

## User Linking and Provisioning

Add a durable external identity mapping instead of storing provider ids directly on `users`.

Suggested model:

| Field | Description |
| --- | --- |
| `id` | Internal id. |
| `user_id` | Karvio user id. |
| `provider_id` | Auth provider id. |
| `provider_type` | LDAP, OIDC, Google, Azure. |
| `subject` | Stable provider subject. |
| `email_at_link_time` | Email observed when linked. |
| `created_at` | Link creation timestamp. |
| `last_login_at` | Latest login through this identity. |

Uniqueness:

- `(provider_id, subject)` must be unique.
- A user can have multiple external identities.
- Automatic linking by email is allowed only when:
  - Provider marks email as verified, or LDAP source is explicitly trusted by admin.
  - Exactly one enabled Karvio user has that email.
  - Admin has enabled email-based linking for that provider.

Provisioning rules:

- New external users get global `role=user` by default unless group mapping says otherwise.
- New users should not be assigned to projects unless configured group mapping does that explicitly.
- If a mapped group is removed at the identity provider, the sync policy must define whether Karvio memberships are removed, left unchanged, or only added.
- Admin-created local users can later be linked to external identities.

## Group and Role Mapping

Group mapping should be optional for the first release but the data model should not block it.

Supported targets:

- Global role: `admin` or `user`.
- Project membership role: `viewer`, `tester`, `manager`, `lead`.

Mapping behavior:

- Admin can map one external group DN/name/claim value to one or more Karvio targets.
- If multiple mappings match, the highest global role and highest project role should apply.
- Manual project memberships must be protected by policy:
  - Default: external mapping only adds or updates memberships it owns.
  - It must not remove manually assigned memberships unless admin explicitly enables full sync for that provider.

## Backend/API Requirements

Add authenticated admin endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/auth/providers` | List provider configurations, sanitized. |
| `POST` | `/auth/providers` | Create provider. |
| `GET` | `/auth/providers/{id}` | Get provider details, sanitized. |
| `PATCH` | `/auth/providers/{id}` | Update provider. |
| `DELETE` | `/auth/providers/{id}` | Delete non-local provider. |
| `POST` | `/auth/providers/{id}/test` | Test provider configuration. |
| `POST` | `/auth/providers/{id}/rotate-secret` | Replace provider secret, if separated from patch. |

Add unauthenticated auth flow endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/auth/config` | Public login page configuration. |
| `POST` | `/auth/login/ldap` | Password login against selected LDAP provider. |
| `GET` | `/auth/oidc/{provider_id}/start` | Start OIDC authorization redirect. |
| `GET` | `/auth/oidc/{provider_id}/callback` | Complete OIDC callback and set session cookie. |

Endpoint naming can be adjusted to match existing API conventions, but the API must keep admin configuration separate from public login configuration.

## Security Requirements

- Store provider secrets encrypted at rest or through the deployment secret manager; never store clear text in normal JSON columns.
- Never return secrets from API responses.
- Validate OIDC state and nonce.
- Use Authorization Code flow with PKCE where possible.
- Validate JWT signature, issuer, audience, expiration, and token type.
- Require verified email for Google and for email-based linking on OIDC providers.
- Protect redirect URI handling against open redirects. Only relative return paths or allow-listed app origins are accepted.
- Rate-limit password-based login attempts per IP and username/provider.
- Record audit events for successful login, failed login, provider configuration changes, provider tests, and account provisioning/linking.
- Do not reveal whether a username exists in local, LDAP, or external identity mapping error messages.
- Prevent disabling or deleting the last administrator login path.
- Existing disabled users remain blocked for all provider types.

## Audit and Observability

Audit events should include:

- Provider created, updated, enabled, disabled, deleted.
- Provider connection tested.
- External login succeeded/failed.
- User auto-provisioned.
- External identity linked/unlinked.
- Group mapping applied.

Logs and audit metadata must be sanitized:

- No passwords, client secrets, authorization codes, refresh tokens, access tokens, id tokens, LDAP bind passwords, or full certificate private material.
- Include provider id/type, result, reason code, user id when known, and request id.

Metrics should distinguish:

- Local login success/failure.
- LDAP login success/failure.
- OIDC login success/failure by provider type.
- Provisioning success/failure.
- Provider test success/failure.

## Acceptance Criteria

- A system admin can configure, test, enable, disable, edit, and delete non-local auth providers from UI.
- A system admin can configure Google and Azure using guided presets without manually entering low-level claim defaults.
- The login page changes automatically based on enabled providers.
- OIDC login creates the same HTTP-only session cookie used by current local login.
- LDAP login validates against LDAP and then uses the same Karvio authorization model.
- Existing local users, project memberships, API keys, and audit history keep working.
- Disabled users cannot sign in through any provider.
- Secrets are write-only in UI/API responses.
- A misconfigured provider cannot be enabled without an explicit warning or failed validation state.
- The system prevents locking out all admins.
- Public login configuration endpoint exposes no sensitive provider configuration.

## Out of Scope for First Release

- SAML.
- SCIM provisioning.
- Just-in-time project creation from identity provider groups.
- Password reset through Karvio for externally managed users.
- Multi-factor authentication owned by Karvio; MFA should be handled by the external identity provider.
- Full directory synchronization job independent from login-time provisioning.

## Open Questions

- Should local login be disableable globally, or only hideable from non-admin users?
- Should LDAP be treated as a separate login method on the login page, or should it replace local password login when enabled?
- Do we need multiple active LDAP providers, or only one corporate directory?
- Should group mapping be required in the first release or delivered as a follow-up?
- Should auto-provisioned users be created as disabled until an admin approves them?
- Which secret storage mechanism should be used in production deployments: database encryption key, external vault, or environment-managed secrets?
