# Authentication Providers

Karvio supports several ways for users to sign in:

- **Local** — built-in username and password accounts managed in Karvio.
- **LDAP / Active Directory** — corporate directory authentication.
- **OpenID Connect (OIDC)** — any standards-compliant identity provider.
- **Google** — preset over OIDC for Google Workspace.
- **Microsoft Entra ID (Azure AD)** — preset over OIDC for Microsoft tenants.

External providers verify identity only — Karvio still owns the user record, system role, and project memberships. After a successful external login Karvio sets the same session cookie as a local login, so the rest of the app behaves identically.

Only system administrators can manage authentication providers.

---

## Authentication Settings Page

Go to **Settings** → **Authentication**.

The page lists all configured providers with:

| Column | Description |
|--------|-------------|
| **Status** | `Enabled`, `Disabled`, or `Misconfigured`. |
| **Type** | Local, LDAP, OpenID Connect, Google, or Azure. |
| **Name** | Admin-defined display name. |
| **Login label** | Text shown on the login page. |
| **Auto-provisioning** | Whether new users are created on first login. |
| **Last tested** | Timestamp and result of the latest connection test. |
| **Actions** | Edit, test, enable/disable, delete (non-local only). |

The **Local** provider is built in and cannot be deleted. It can be disabled, but the system always keeps at least one administrator sign-in path available.

---

## Add a Provider

1. Open **Settings** → **Authentication**.
2. Click **New provider** and choose the type: `LDAP`, `OpenID Connect`, `Google`, or `Azure`.
3. Fill in the form (sections below depend on the type).
4. Click **Test connection** to validate the configuration.
5. Save, then toggle **Enabled** when you are ready to expose it on the login page.

### Common Fields

| Field | Description |
|-------|-------------|
| **Name** | Internal admin name, e.g. `Corporate SSO`. |
| **Login label** | Text shown on the login button or password form, e.g. `Continue with SSO`. |
| **Enabled** | Whether the provider appears on the login page. |
| **Sort order** | Position among other buttons on the login page. |
| **Auto-provisioning** | If on, an unknown external user is created on first successful login. If off, only previously linked Karvio users can sign in. |
| **Default global role** | Role assigned to auto-provisioned users (`User` by default). |

Secret fields (passwords, client secrets) are write-only: existing values are shown as **Configured — leave blank to keep** and never returned by the API.

---

## LDAP / Active Directory

Use LDAP when users live in Active Directory or an LDAP-compatible directory.

### Connection

| Field | Example |
|-------|---------|
| **Server URL** | `ldaps://ldap.example.com:636` |
| **TLS mode** | Plain, StartTLS, or LDAPS |
| **Certificate validation** | Validate / Skip; optional CA certificate |
| **Timeout** | Connection timeout in seconds |

### Bind Mode

- **Service account bind** — Karvio binds with a service DN and then searches for the user.
  - **Service bind DN**, e.g. `cn=svc,dc=example,dc=com`
  - **Service bind password**
  - **Base DN**, e.g. `dc=example,dc=com`
  - **User search filter**, e.g. `(sAMAccountName={login})` or `(mail={login})`
- **Direct user bind** — Karvio binds directly with a DN built from the username.
  - **User DN template**, e.g. `uid={login},ou=people,dc=example,dc=com`

### Attribute Mapping

| Karvio field | Typical attribute |
|--------------|-------------------|
| Unique ID | `objectGUID`, `entryUUID`, `uid` |
| Username | `sAMAccountName`, `uid` |
| Email | `mail` |
| First name | `givenName` |
| Last name | `sn` |
| Team / department | `department` |

Optional group settings allow group-based role mapping (see [Group Mapping](#group-mapping)).

### Test Connection

The LDAP test verifies:

- Server reachability and TLS/certificate validity.
- Service bind credentials or user DN template.
- That the user search filter runs.
- Attribute mapping for a sample username (if you provide one).

---

## OpenID Connect (Generic)

Use generic OIDC for any standards-compliant provider (Okta, Keycloak, Auth0, etc.).

### Connection

| Field | Description |
|-------|-------------|
| **Issuer URL** | e.g. `https://idp.example.com` |
| **Discovery URL** | Optional override if `/.well-known/openid-configuration` lives elsewhere |
| **Client ID** | Application client ID at the provider |
| **Client secret** | Application client secret |
| **Redirect URI** | Read-only value to copy into the identity provider |
| **Scopes** | Default `openid profile email` |
| **PKCE** | Recommended — enabled by default |

### Claim Mapping

| Karvio field | Default claim |
|--------------|---------------|
| Subject | `sub` |
| Email | `email` |
| Email verified | `email_verified` |
| Username | `preferred_username`, falls back to `email`, then `sub` |
| First name | `given_name` |
| Last name | `family_name` |
| Team | optional |
| Groups | optional |

Optionally restrict sign-in to one or more email domains.

---

## Google Workspace

Google is a preset over OIDC. Defaults are filled in for you:

- **Issuer:** `https://accounts.google.com`
- **Scopes:** `openid profile email`
- Claim mapping uses `sub`, `email`, `email_verified`, `given_name`, `family_name`.

You only need to configure:

- **Client ID** and **Client secret** from Google Cloud Console.
- **Allowed domains** — optional list of Google Workspace domains permitted to sign in. Users outside the list are rejected before any account is created.

Google logins require a verified email.

---

## Microsoft Entra ID / Azure AD

Azure is a preset over OIDC.

### Tenant Mode

- **Single tenant** — provide your **Tenant ID**. Only users from that tenant can sign in.
- **Multi-tenant** — must be explicitly enabled. Optionally restrict to an **Allowed tenants** list.

### Connection

| Field | Description |
|-------|-------------|
| **Client ID** | Application (client) ID from Azure App Registration |
| **Client secret** | Client secret from Azure |
| **Redirect URI** | Read-only — copy into Azure's app redirect URIs |

Username fallback order is `preferred_username` → `email` → `upn` → `sub`. Karvio uses the stable subject claim as the external identity key, not email or UPN (these can change).

---

## Test Connection

Every non-local provider has a **Test connection** action. The result is persisted with timestamp, status (`pass`, `fail`), and sanitized error details, and is shown in the providers list under **Last tested**.

OIDC / Google / Azure tests verify:

- The discovery document is reachable.
- Authorization, token, and JWKS endpoints respond.
- Client ID and client secret are configured.
- The expected redirect URI matches Karvio's callback path.

A provider that fails its test cannot be enabled without an explicit warning.

---

## Auto-Provisioning and User Linking

When a user signs in through an external provider, Karvio links the external identity to a Karvio user record:

1. **Match by external subject.** If the provider's subject is already linked, that user signs in.
2. **Match by verified email.** If enabled for the provider and the email is verified, the existing Karvio user with that email is linked.
3. **Auto-provision.** If no match exists and auto-provisioning is on, a new Karvio user is created with the configured default global role and no project memberships (unless group mapping assigns them).
4. **Reject.** If auto-provisioning is off and no match exists, login is rejected with a generic message.

Disabled Karvio users cannot sign in through any provider, even if the external authentication succeeds.

A Karvio user can have multiple linked external identities (for example local + Google).

---

## Group Mapping

Optional group mapping translates LDAP groups or OIDC `groups` claim values into Karvio roles.

Supported targets:

- **Global role** — `Admin` or `User`.
- **Project membership role** — `Viewer`, `Tester`, `Manager`, or `Lead`.

Rules:

- One external group can map to multiple Karvio targets.
- When several mappings match, the highest global role and the highest project role win.
- By default, mappings only **add** memberships. Manually assigned project memberships are not removed unless you explicitly enable full sync for the provider.

---

## Login Page Behavior

The login page is driven by enabled providers. Admins do not edit the page directly — it reflects the current configuration:

| Configuration | Login page |
|---------------|------------|
| Local only | Username and password form. |
| OIDC providers only | One full-width button per provider. |
| Local + OIDC | Provider buttons, divider, then username/password. |
| LDAP + local | Single password form, or a method selector if both are password-based. |
| Nothing enabled | System unavailable message. |

The return URL is preserved through OIDC redirects, so users land on the page they originally requested.

---

## Security Notes

- Secrets are stored encrypted at rest and never returned by the API.
- OIDC flows validate `state`, `nonce`, issuer, audience, signature, expiration, and token type. Authorization Code with PKCE is used wherever possible.
- Redirect URIs are restricted to Karvio's own callback path — open redirects are rejected.
- Failed logins do not reveal whether a username exists locally or in any external directory.
- Password-based logins are rate-limited per IP and per username/provider.
- The system prevents deleting or disabling the last administrator sign-in path.

---

## Audit Events

Every change and every login attempt produces an audit event. See [Audit Logs](../audit-logs.md). Captured events include:

- Provider created, updated, enabled, disabled, deleted.
- Provider connection tested.
- External login succeeded or failed.
- User auto-provisioned.
- External identity linked or unlinked.
- Group mapping applied.

Audit metadata is sanitized: passwords, client secrets, authorization codes, tokens, and LDAP bind passwords are never recorded.

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Provider stuck on **Misconfigured** | Run **Test connection** and read the result; fix the field it points at. |
| OIDC callback fails | Confirm the Redirect URI shown in the form matches the one configured at the identity provider. |
| LDAP test fails on bind | Verify the service bind DN and password, or the user DN template; check TLS/certificate settings. |
| User cannot sign in but provider test passes | Confirm the Karvio user is enabled and (if auto-provisioning is off) that an external identity is linked. |
| Login page is empty | At least one provider, including local, must be enabled. |

For deeper inspection, see backend and worker logs from the [Installation](../../getting-started/installation.md#logs) guide.
