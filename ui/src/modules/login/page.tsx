// Login page: configuration-driven sign-in (local, LDAP, and OIDC providers).
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { API_BASE_URL, getMe, getPublicAuthConfig, login, loginLdap } from "@/shared/api";
import type { PublicAuthConfigDto } from "@/shared/api";
import { setSessionUser } from "@/shared/auth";
import { Button } from "@/shared/ui/Button";
import { SelectField, TextField } from "@/shared/ui";
import { safeReturnPath } from "./login-utils";

const GENERIC_ERROR = "Unable to sign in with the selected method.";

const PROVIDER_ERROR_MESSAGES: Record<string, string> = {
  domain_not_allowed: "Your email domain is not allowed to sign.",
  email_unverified: "Your email is not verified with the identity provider.",
  provisioning_disabled: "Your account does not exist and automatic provisioning is disabled. Contact your administrator.",
  user_disabled: "Your account is disabled. Contact your administrator.",
  provider_unavailable: "Sign-in provider is currently unavailable.",
  provider_misconfigured: "Sign-in provider is misconfigured. Contact your administrator.",
  provider_error: "The identity provider returned an error.",
  invalid_transaction: "Your sign-in session expired. Please try again.",
  state_mismatch: "Your sign-in session expired. Please try again.",
  token_invalid: "Could not verify the identity provider response. Please try again.",
  token_exchange_failed: "Could not complete sign-in with the identity provider. Please try again.",
  no_subject: "The identity provider did not return a valid account identifier.",
  discovery: "Sign-in provider is currently unavailable.",
  discovery_unreachable: "Sign-in provider is currently unavailable.",
  start_failed: "Could not start sign-in with the selected provider. Please try again.",
};

function providerErrorMessage(reason: string | null): string {
  if (!reason) return GENERIC_ERROR;
  return PROVIDER_ERROR_MESSAGES[reason] ?? GENERIC_ERROR;
}

type PasswordMethod = { id: string; label: string; kind: "local" | "ldap" };

export function LoginPage() {
  const navigate = useNavigate();
  const { returnTo, initialError } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    const reasonParam = params.get("reason");
    return {
      returnTo: safeReturnPath(params.get("return_to")),
      initialError: errorParam ? providerErrorMessage(reasonParam) : null,
    };
  }, []);

  const [config, setConfig] = useState<PublicAuthConfigDto | null>(null);
  const [configError, setConfigError] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [methodId, setMethodId] = useState<string>("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    let active = true;
    getMe()
      .then((user) => {
        if (!active) return;
        setSessionUser({
          id: user.id,
          username: user.username,
          role: user.role,
          project_memberships: user.project_memberships,
        });
        navigate(returnTo, { replace: true });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setCheckingAuth(false);
      });
    return () => {
      active = false;
    };
  }, [navigate, returnTo]);

  useEffect(() => {
    getPublicAuthConfig()
      .then(setConfig)
      .catch(() => setConfigError(true));
  }, []);

  const passwordMethods = useMemo<PasswordMethod[]>(() => {
    if (!config) return [];
    const methods: PasswordMethod[] = [];
    if (config.local_login.enabled) {
      methods.push({ id: "local", label: config.local_login.label, kind: "local" });
    }
    for (const provider of config.providers) {
      if (provider.uses_password_form) {
        methods.push({ id: provider.id, label: provider.label, kind: "ldap" });
      }
    }
    return methods;
  }, [config]);

  const redirectProviders = useMemo(
    () => (config?.providers ?? []).filter((provider) => !provider.uses_password_form),
    [config],
  );

  useEffect(() => {
    if (passwordMethods.length > 0 && !passwordMethods.some((m) => m.id === methodId)) {
      setMethodId(passwordMethods[0].id);
    }
  }, [passwordMethods, methodId]);

  const activeMethod = passwordMethods.find((m) => m.id === methodId) ?? null;

  function startOidc(providerId: string) {
    setRedirecting(true);
    const url = `${API_BASE_URL}/auth/oidc/${providerId}/start?return_to=${encodeURIComponent(returnTo)}`;
    window.location.assign(url);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeMethod) return;
    setLoading(true);
    setError(null);
    try {
      const result =
        activeMethod.kind === "local"
          ? await login({ username, password })
          : await loginLdap({ provider_id: activeMethod.id, username, password });
      setSessionUser({
        id: result.user.id,
        username: result.user.username,
        role: result.user.role,
        project_memberships: result.user.project_memberships,
      });
      navigate(returnTo, { replace: true });
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-[var(--muted-foreground)]">
        Loading...
      </div>
    );
  }

  const noMethods =
    configError || (config !== null && passwordMethods.length === 0 && redirectProviders.length === 0);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h1 className="mb-4 text-2xl font-semibold text-[var(--foreground)]">Sign in to Karvio</h1>

        {!config && !configError ? (
          <p className="text-sm text-[var(--muted-foreground)]">Loading sign-in options…</p>
        ) : null}

        {noMethods ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Sign-in is currently unavailable. Please contact your administrator.
          </p>
        ) : null}

        {error ? (
          <p className="mb-4 rounded-md border border-[var(--status-failure)]/30 bg-[var(--status-failure)]/10 p-3 text-sm text-[var(--status-failure)]">
            {error}
          </p>
        ) : null}

        {redirectProviders.length > 0 ? (
          <div className="space-y-2">
            {redirectProviders.map((provider) => (
              <Button
                key={provider.id}
                type="button"
                variant="outline"
                size="md"
                className="w-full rounded-lg"
                disabled={redirecting || loading}
                onClick={() => startOidc(provider.id)}
              >
                {provider.label}
              </Button>
            ))}
          </div>
        ) : null}

        {redirectProviders.length > 0 && passwordMethods.length > 0 ? (
          <div className="my-5 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
            <span className="h-px flex-1 bg-[var(--border)]" />
            or
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>
        ) : null}

        {passwordMethods.length > 0 ? (
          <form className="space-y-4" onSubmit={onSubmit}>
            {passwordMethods.length > 1 ? (
              <SelectField
                label="Sign-in method"
                value={methodId}
                onChange={(e) => setMethodId(e.target.value)}
              >
                {passwordMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.label}
                  </option>
                ))}
              </SelectField>
            ) : null}
            <TextField
              id="username"
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
            <TextField
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full rounded-lg"
              loading={loading}
              disabled={redirecting}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
