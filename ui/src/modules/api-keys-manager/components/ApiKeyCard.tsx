import { Activity, Calendar, KeyRound, RefreshCcw, Trash2 } from "lucide-react";

import { formatDate, getRelativeTime, maskKey } from "@/modules/api-keys-manager/formatters";
import type { ApiKeyDto } from "@/shared/api";
import { Button } from "@/shared/ui/Button";

type ApiKeyCardProps = Readonly<{
  apiKey: ApiKeyDto;
  isPending: boolean;
  onRegenerate: (apiKey: ApiKeyDto) => void;
  onRevoke: (apiKey: ApiKeyDto) => void;
}>;

export function ApiKeyCard({ apiKey, isPending, onRegenerate, onRevoke }: ApiKeyCardProps) {
  const lastUsedLabel = apiKey.last_used_at
    ? `${getRelativeTime(apiKey.last_used_at)} (${formatDate(apiKey.last_used_at)})`
    : "Never used";

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--muted)]">
            <KeyRound className="size-4 text-[var(--muted-foreground)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">{apiKey.name}</p>
            {apiKey.description ? (
              <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">{apiKey.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<RefreshCcw />}
            onClick={() => onRegenerate(apiKey)}
            disabled={isPending}
          >
            Regenerate
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            leftIcon={<Trash2 />}
            onClick={() => onRevoke(apiKey)}
            disabled={isPending}
          >
            Revoke
          </Button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 font-mono text-xs text-[var(--foreground)]">
        {maskKey(apiKey.key_prefix, apiKey.key_hint)}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
        <span className="inline-flex items-center gap-1">
          <Calendar className="size-3.5" />
          Created {formatDate(apiKey.created_at)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Activity className="size-3.5" />
          Last used {lastUsedLabel}
        </span>
      </div>

      {(apiKey.last_used_ip || apiKey.last_used_user_agent) ? (
        <div className="mt-2 grid grid-cols-1 gap-1 rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-xs text-[var(--muted-foreground)] sm:grid-cols-[auto_1fr] sm:gap-x-3">
          <span className="font-medium text-[var(--foreground)]">IP</span>
          <span className="truncate">{apiKey.last_used_ip || "Unknown"}</span>
          <span className="font-medium text-[var(--foreground)]">User agent</span>
          <span className="truncate">{apiKey.last_used_user_agent || "Unknown"}</span>
        </div>
      ) : null}

      {apiKey.recent_logins.length > 0 ? (
        <div className="mt-2 rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
          <p className="font-medium text-[var(--foreground)]">Recent activity</p>
          <ul className="mt-1 space-y-0.5">
            {apiKey.recent_logins.slice(0, 2).map((login, index) => (
              <li key={`${login.authenticated_at}-${index}`}>
                {formatDate(login.authenticated_at)} from {login.ip || "unknown IP"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
