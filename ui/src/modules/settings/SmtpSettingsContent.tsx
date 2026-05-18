import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useCreateSmtpSettingsMutation,
  useSmtpSettingsQuery,
  useTestSmtpSettingsMutation,
  useUpdateSmtpSettingsMutation,
} from "@/shared/api";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { Button, Switch, TextField } from "@/shared/ui";
import { mapSmtpToForm, type SmtpFormState } from "./settings-types";

export function SmtpSettingsContent() {
  const smtpQuery = useSmtpSettingsQuery();
  const createSmtpMutation = useCreateSmtpSettingsMutation();
  const updateSmtpMutation = useUpdateSmtpSettingsMutation();
  const testSmtpMutation = useTestSmtpSettingsMutation();

  const [smtpForm, setSmtpForm] = useState<SmtpFormState>(() => mapSmtpToForm());
  const [smtpTestRecipient, setSmtpTestRecipient] = useState("");

  useEffect(() => {
    if (smtpQuery.data) {
      setSmtpForm(mapSmtpToForm(smtpQuery.data));
      if (!smtpTestRecipient) {
        setSmtpTestRecipient(smtpQuery.data.from_email);
      }
    }
  }, [smtpQuery.data, smtpTestRecipient]);

  const saveSmtpSettings = async () => {
    const payload = {
      enabled: smtpForm.enabled,
      host: smtpForm.host.trim(),
      port: Number(smtpForm.port),
      username: smtpForm.username.trim() || null,
      password: smtpForm.password.trim() || null,
      from_email: smtpForm.from_email.trim(),
      from_name: smtpForm.from_name.trim() || null,
      reply_to: smtpForm.reply_to.trim() || null,
      use_tls: smtpForm.use_tls,
      use_starttls: smtpForm.use_starttls,
      timeout_seconds: Number(smtpForm.timeout_seconds),
    };

    try {
      if (smtpQuery.data) {
        await updateSmtpMutation.mutateAsync(payload);
      } else {
        await createSmtpMutation.mutateAsync(payload);
      }
      setSmtpForm((current) => ({ ...current, password: "" }));
      notifySuccess("SMTP settings saved.");
      await smtpQuery.refetch();
    } catch (error) {
      notifyError(error, "Failed to save SMTP settings.");
    }
  };

  const buildSmtpPayload = useCallback(
    () => ({
      enabled: smtpForm.enabled,
      host: smtpForm.host.trim(),
      port: Number(smtpForm.port),
      username: smtpForm.username.trim() || null,
      password: smtpForm.password.trim() || null,
      from_email: smtpForm.from_email.trim(),
      from_name: smtpForm.from_name.trim() || null,
      reply_to: smtpForm.reply_to.trim() || null,
      use_tls: smtpForm.use_tls,
      use_starttls: smtpForm.use_starttls,
      timeout_seconds: Number(smtpForm.timeout_seconds),
    }),
    [smtpForm],
  );

  const isSmtpDirty = useMemo(() => {
    const server = smtpQuery.data;
    if (!server) return false;
    const cur = buildSmtpPayload();
    if (cur.password !== null) return true;
    const norm = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);
    return (
      cur.enabled !== server.enabled ||
      cur.host !== server.host.trim() ||
      cur.port !== server.port ||
      norm(cur.username) !== norm(server.username) ||
      cur.from_email !== server.from_email.trim() ||
      norm(cur.from_name) !== norm(server.from_name) ||
      norm(cur.reply_to) !== norm(server.reply_to) ||
      cur.use_tls !== server.use_tls ||
      cur.use_starttls !== server.use_starttls ||
      cur.timeout_seconds !== server.timeout_seconds
    );
  }, [buildSmtpPayload, smtpQuery.data]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Switch
            checked={smtpForm.enabled}
            onCheckedChange={(checked) => setSmtpForm((current) => ({ ...current, enabled: checked }))}
          />
          <span className="text-sm text-[var(--muted-foreground)]">Enabled</span>
        </div>
      </div>

      {smtpForm.enabled && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <TextField
              label="Host"
              value={smtpForm.host}
              onChange={(event) => setSmtpForm((current) => ({ ...current, host: event.target.value }))}
              placeholder="smtp.example.com"
            />
            <TextField
              label="Port"
              value={smtpForm.port}
              onChange={(event) => setSmtpForm((current) => ({ ...current, port: event.target.value }))}
              placeholder="587"
            />
            <TextField
              label="Username"
              value={smtpForm.username}
              onChange={(event) => setSmtpForm((current) => ({ ...current, username: event.target.value }))}
              placeholder="smtp-user"
            />
            <TextField
              label="Password"
              type="password"
              value={smtpForm.password}
              onChange={(event) => setSmtpForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="••••••••"
              hint={smtpQuery.data?.password_configured ? "Leave empty to keep the current password." : undefined}
            />
            <TextField
              label="From email"
              value={smtpForm.from_email}
              onChange={(event) => setSmtpForm((current) => ({ ...current, from_email: event.target.value }))}
              placeholder="noreply@example.com"
            />
            <TextField
              label="From name"
              value={smtpForm.from_name}
              onChange={(event) => setSmtpForm((current) => ({ ...current, from_name: event.target.value }))}
              placeholder="Karvio"
            />
            <TextField
              label="Reply-to"
              value={smtpForm.reply_to}
              onChange={(event) => setSmtpForm((current) => ({ ...current, reply_to: event.target.value }))}
              placeholder="support@example.com"
            />
            <TextField
              label="Timeout (seconds)"
              value={smtpForm.timeout_seconds}
              onChange={(event) => setSmtpForm((current) => ({ ...current, timeout_seconds: event.target.value }))}
              placeholder="30"
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-[var(--border)] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--foreground)]">TLS</span>
                  <Switch
                    checked={smtpForm.use_tls}
                    onCheckedChange={(checked) =>
                      setSmtpForm((current) => ({
                        ...current,
                        use_tls: checked,
                        use_starttls: checked ? false : current.use_starttls,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="rounded-lg border border-[var(--border)] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--foreground)]">STARTTLS</span>
                  <Switch
                    checked={smtpForm.use_starttls}
                    onCheckedChange={(checked) =>
                      setSmtpForm((current) => ({
                        ...current,
                        use_starttls: checked,
                        use_tls: checked ? false : current.use_tls,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)] p-4 md:flex-row md:items-end">
            <TextField
              label="Test recipient"
              className="flex-1"
              value={smtpTestRecipient}
              onChange={(event) => setSmtpTestRecipient(event.target.value)}
              placeholder="qa@example.com"
            />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await testSmtpMutation.mutateAsync({
                    recipient_email: smtpTestRecipient.trim(),
                    smtp: buildSmtpPayload(),
                  });
                  notifySuccess("SMTP test email sent.");
                } catch (error) {
                  notifyError(error, "Failed to send SMTP test email.");
                }
              }}
            >
              Send SMTP Test
            </Button>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={saveSmtpSettings}>
              Save SMTP
            </Button>
          </div>
        </>
      )}
      {!smtpForm.enabled && isSmtpDirty ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)] p-4">
          <p className="text-sm text-[var(--muted-foreground)]">SMTP is disabled. Save to apply this change.</p>
          <Button type="button" onClick={saveSmtpSettings}>
            Save SMTP
          </Button>
        </div>
      ) : null}
    </div>
  );
}
