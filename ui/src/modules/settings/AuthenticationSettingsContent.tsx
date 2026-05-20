// Admin-only authentication providers management.
import { useMemo, useState } from "react";
import {
  type AuthProviderCreatePayload,
  type AuthProviderDto,
  type AuthProviderType,
  type AuthProviderUpdatePayload,
  useAuthProvidersQuery,
  useCreateAuthProviderMutation,
  useDeleteAuthProviderMutation,
  useTestAuthProviderMutation,
  useUpdateAuthProviderMutation,
} from "@/shared/api";
import { getSessionUser } from "@/shared/auth";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { Button, EmptyState, SelectField, Switch } from "@/shared/ui";
import { ActionConfirmModal } from "@/shared/ui/ActionConfirmModal";
import { AuthProviderFormPanel } from "./AuthProviderFormPanel";
import { FieldLabel } from "./field-label";

const TYPE_LABEL: Record<AuthProviderType, string> = {
  local: "Local",
  ldap: "LDAP",
  oidc: "OpenID Connect",
  google: "Google",
  azure: "Azure",
};

const STATUS_TONE: Record<string, string> = {
  enabled: "bg-[var(--status-success)]/15 text-[var(--status-success)]",
  disabled: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  misconfigured: "bg-[var(--status-failure)]/15 text-[var(--status-failure)]",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function AuthenticationSettingsContent() {
  const isAdmin = getSessionUser()?.role === "admin";
  const providersQuery = useAuthProvidersQuery(isAdmin);
  const createMutation = useCreateAuthProviderMutation();
  const updateMutation = useUpdateAuthProviderMutation();
  const deleteMutation = useDeleteAuthProviderMutation();
  const testMutation = useTestAuthProviderMutation();

  const providers = useMemo(
    () => [...(providersQuery.data ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [providersQuery.data],
  );

  const [editing, setEditing] = useState<AuthProviderDto | null>(null);
  const [createType, setCreateType] = useState<AuthProviderType | null>(null);
  const [newType, setNewType] = useState<AuthProviderType>("oidc");
  const [deleteTarget, setDeleteTarget] = useState<AuthProviderDto | null>(null);

  if (!isAdmin) {
    return (
      <EmptyState
        className="min-h-[18rem] border-[var(--border)] bg-[var(--muted)]"
        title="Authentication settings are unavailable"
        description="Authentication providers can only be managed by system administrators."
      />
    );
  }

  const panelOpen = editing !== null || createType !== null;

  async function handleCreate(payload: AuthProviderCreatePayload) {
    try {
      await createMutation.mutateAsync(payload);
      notifySuccess("Authentication provider created.");
      setCreateType(null);
    } catch (error) {
      notifyError(error, "Failed to create provider.");
    }
  }

  async function handleUpdate(providerId: string, payload: AuthProviderUpdatePayload) {
    try {
      await updateMutation.mutateAsync({ providerId, payload });
      notifySuccess("Authentication provider updated.");
      setEditing(null);
    } catch (error) {
      notifyError(error, "Failed to update provider.");
    }
  }

  async function handleToggle(provider: AuthProviderDto) {
    try {
      await updateMutation.mutateAsync({
        providerId: provider.id,
        payload: { enabled: !provider.enabled },
      });
      notifySuccess(provider.enabled ? "Provider disabled." : "Provider enabled.");
    } catch (error) {
      notifyError(error, "Failed to change provider state.");
    }
  }

  async function handleTest(providerId: string) {
    try {
      const result = await testMutation.mutateAsync(providerId);
      if (result.status === "success") {
        notifySuccess("Connection test passed.");
      } else {
        notifyError(result.detail || "Connection test failed.", "Connection test failed.");
      }
    } catch (error) {
      notifyError(error, "Connection test failed.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      notifySuccess("Provider deleted.");
      setDeleteTarget(null);
    } catch (error) {
      notifyError(error, "Failed to delete provider.");
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Authentication</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Configure how users sign in. These settings affect system access.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-44">
            <SelectField
              label={
                <FieldLabel tip="Choose the protocol/preset for the new provider. Google and Microsoft are guided OIDC presets; the local username/password provider is built-in and cannot be added here.">
                  Provider type
                </FieldLabel>
              }
              value={newType}
              onChange={(e) => setNewType(e.target.value as AuthProviderType)}
            >
              <option value="oidc">OpenID Connect</option>
              <option value="google">Google Workspace</option>
              <option value="azure">Microsoft Entra ID</option>
              <option value="ldap">LDAP / Active Directory</option>
            </SelectField>
          </div>
          <Button type="button" onClick={() => setCreateType(newType)}>
            Add provider
          </Button>
        </div>
      </div>

      {providersQuery.isLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Loading providers…</p>
      ) : providers.length === 0 ? (
        <EmptyState
          className="min-h-[16rem] border-[var(--border)] bg-[var(--muted)]"
          title="No authentication providers"
          description="Add an external provider, or the built-in local login remains active by default."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--muted)] text-[var(--muted-foreground)]">
              <tr>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Login label</th>
                <th className="px-3 py-2 font-medium">Auto-provision</th>
                <th className="px-3 py-2 font-medium">Last tested</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[provider.status] ?? STATUS_TONE.disabled}`}
                    >
                      {provider.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{TYPE_LABEL[provider.type]}</td>
                  <td className="px-3 py-2 text-[var(--foreground)]">{provider.name}</td>
                  <td className="px-3 py-2 text-[var(--muted-foreground)]">{provider.login_label || "—"}</td>
                  <td className="px-3 py-2">{provider.type === "local" ? "—" : provider.auto_provision ? "On" : "Off"}</td>
                  <td className="px-3 py-2 text-[var(--muted-foreground)]">
                    {provider.last_test_status ? `${provider.last_test_status} · ${formatDate(provider.last_tested_at)}` : "Never"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={provider.enabled}
                        onCheckedChange={() => void handleToggle(provider)}
                        disabled={updateMutation.isPending}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditing(provider)}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleTest(provider.id)}
                        disabled={testMutation.isPending}
                      >
                        Test
                      </Button>
                      {provider.type !== "local" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteTarget(provider)}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {panelOpen ? (
        <AuthProviderFormPanel
          provider={editing}
          createType={createType}
          saving={saving}
          testing={testMutation.isPending}
          onClose={() => {
            setEditing(null);
            setCreateType(null);
          }}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onTest={handleTest}
        />
      ) : null}

      <ActionConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        isPending={deleteMutation.isPending}
        tone="danger"
        title="Delete authentication provider"
        description={`Delete "${deleteTarget?.name}"? Users linked through it will no longer be able to sign in with it.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
