// Login page: sign-in form and redirect when session already exists.
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getMe, login } from "@/shared/api";
import { setSessionUser } from "@/shared/auth";
import { Button } from "@/shared/ui/Button";
import { TextField } from "@/shared/ui";

export function LoginPage() {
  const navigate = useNavigate();
  // Local form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    getMe()
      .then((user) => {
        setSessionUser({
          id: user.id,
          username: user.username,
          role: user.role,
          project_memberships: user.project_memberships,
        });
        navigate("/", { replace: true });
      })
      .catch(() => {})
      .finally(() => setCheckingAuth(false));
  }, [navigate]);

  // Handlers
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await login({ username, password });
      setSessionUser({
        id: result.user.id,
        username: result.user.username,
        role: result.user.role,
        project_memberships: result.user.project_memberships,
      });
      navigate("/", { replace: true });
    } catch {
      setError("Invalid username or password");
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-[var(--foreground)]">Sign in to Karvio</h1>
        <form className="space-y-4" onSubmit={onSubmit}>
          <TextField
            id="username"
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <TextField
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <p className="text-sm text-[var(--status-failure)]">{error}</p> : null}
          <Button type="submit" variant="primary" size="md" className="w-full rounded-lg" loading={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
