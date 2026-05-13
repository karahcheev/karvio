import { Bell, Bot, Mail, PlugZap } from "lucide-react";
import { getSessionUser } from "@/shared/auth";
import { EmptyState } from "@/shared/ui/EmptyState";
import { UrlHashTabs } from "@/shared/ui/Tabs";
import { useUrlHashState } from "@/shared/lib/use-url-hash-state";
import { NotificationsSettingsContent } from "./NotificationsSettingsContent";
import { SmtpSettingsContent } from "./SmtpSettingsContent";
import { JiraIntegrationsSettingsContent } from "./JiraIntegrationsSettingsContent";
import { AiSettingsContent } from "./AiSettingsContent";
import { SETTINGS_TABS, type SettingsTab } from "./settings-types";

const SETTINGS_TAB_ITEMS = [
  { value: "notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
  { value: "smtp", label: "SMTP", icon: <Mail className="h-4 w-4" /> },
  { value: "integrations", label: "Integrations", icon: <PlugZap className="h-4 w-4" /> },
  { value: "ai", label: "AI (beta)", icon: <Bot className="h-4 w-4" /> },
] satisfies { value: SettingsTab; label: string; icon: React.ReactNode }[];

function SettingsPlaceholderTab({
  title,
  description,
}: Readonly<{ title: string; description: string }>) {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">{description}</p>
      </div>
      <EmptyState
        className="min-h-[22rem] border-[var(--border)] bg-[var(--muted)]"
        title={`${title} settings are not configured yet`}
        description="This tab is prepared as a placeholder and ready for the first implementation pass."
      />
    </>
  );
}

export function SettingsModulePage() {
  const sessionUser = getSessionUser();
  const canManageNotifications =
    sessionUser?.role === "admin" ||
    sessionUser?.project_memberships.some((membership) => membership.role === "lead" || membership.role === "manager");
  const isAdmin = sessionUser?.role === "admin";

  const availableTabItems = isAdmin
    ? SETTINGS_TAB_ITEMS
    : SETTINGS_TAB_ITEMS.filter(
        (item) => item.value === "notifications" || item.value === "integrations" || item.value === "ai"
      );
  const availableTabs = availableTabItems.map((item) => item.value) as readonly SettingsTab[];

  const [activeTab, setActiveTab] = useUrlHashState<SettingsTab>({
    defaultValue: "notifications",
    omitHashFor: "notifications",
    values: availableTabs.length ? availableTabs : SETTINGS_TABS,
  });

  if (!canManageNotifications) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-[var(--table-canvas)]">
        <div className="border-b border-[var(--border)] bg-[var(--card)] px-4 py-5">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Settings</h1>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xs">
            <EmptyState
              className="min-h-[18rem] border-[var(--border)] bg-[var(--muted)]"
              title="Notifications are unavailable"
              description="Notification settings are available for project leads, managers, and administrators."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--table-canvas)]">
      <div className="border-b border-[var(--border)] bg-[var(--card)] px-4 py-5">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Settings</h1>
      </div>

      <UrlHashTabs activeTab={activeTab} onTabChange={setActiveTab} items={availableTabItems} />

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xs">
          {(() => {
            if (activeTab === "notifications") {
              return <NotificationsSettingsContent />;
            }
            if (activeTab === "smtp") {
              return <SmtpSettingsContent />;
            }
            if (activeTab === "integrations") {
              return <JiraIntegrationsSettingsContent />;
            }
            if (activeTab === "ai") {
              return <AiSettingsContent />;
            }
            if (activeTab === "webhooks") {
              return (
                <SettingsPlaceholderTab
                  title="Webhooks"
                  description="Manage outbound events, signing secrets, and delivery endpoints for external integrations."
                />
              );
            }
            if (activeTab === "agents") {
              return (
                <SettingsPlaceholderTab
                  title="Agents (runners)"
                  description="Register and manage execution agents, runner pools, and capacity allocation policies."
                />
              );
            }
            return (
              <SettingsPlaceholderTab
                title="AI"
                description="Control model providers, automation policies, and AI-assisted workflow defaults."
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
}
