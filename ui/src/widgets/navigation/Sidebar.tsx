// Primary navigation for the current project and admin-only links.
import type { ElementType } from "react";
import { Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  FileText,
  PanelLeft,
  PlayCircle,
  UserRoundCog,
  ScrollText,
  ChevronLeft,
  Database,
  Server,
  Gauge,
  Settings,
  Boxes,
} from "lucide-react";
import { useTestRunsInProgressCountQuery } from "@/shared/api";
import { getSessionUser } from "@/shared/auth";
import { Button } from "@/shared/ui/Button";

type SidebarProps = Readonly<{
  collapsed: boolean;
  onToggle: () => void;
  currentProjectId?: string;
  isAdmin: boolean;
}>;

type NavItem = Readonly<{
  path: string;
  label: string;
  icon: ElementType;
  badge?: string;
}>;

export function Sidebar({ collapsed, onToggle, currentProjectId, isAdmin }: SidebarProps) {
  const location = useLocation();
  const { data: inProgressRunsCount = 0 } = useTestRunsInProgressCountQuery(currentProjectId);
  const sessionUser = getSessionUser();
  const canManageNotifications =
    isAdmin ||
    sessionUser?.project_memberships.some(
      (membership) => membership.role === "lead" || membership.role === "manager"
    ) === true;

  // Project-scoped links; badge shows count of runs currently in progress.
  const projectNav: NavItem[] = currentProjectId ? [
    { path: `/projects/${currentProjectId}/overview`, label: "Overview", icon: LayoutDashboard },
    { path: `/projects/${currentProjectId}/test-cases`, label: "Test Cases", icon: FileText },
    { path: `/projects/${currentProjectId}/datasets`, label: "Datasets", icon: Database },
    { path: `/projects/${currentProjectId}/environments`, label: "Environments", icon: Server },
    {
      path: `/projects/${currentProjectId}/test-runs`,
      label: "Test Runs",
      icon: PlayCircle,
      badge: inProgressRunsCount > 0 ? String(inProgressRunsCount) : undefined,
    },
    { path: `/projects/${currentProjectId}/performance`, label: "Performance", icon: Gauge },
    { path: `/projects/${currentProjectId}/products`, label: "Release Scope", icon: Boxes },
  ] : [];

  const canOpenAuditLogs = isAdmin || Boolean(currentProjectId);

  // Workspace-level entries: Settings for lead+/admin, audit log for admins or current project members.
  const workspaceNav: NavItem[] = [
    ...(canManageNotifications ? [{ path: "/settings", label: "Settings", icon: Settings } satisfies NavItem] : []),
    ...(canOpenAuditLogs ? [{ path: "/audit-logs", label: "Audit Log", icon: ScrollText } satisfies NavItem] : []),
    ...(isAdmin ? [{ path: "/projects-and-users", label: "Projects and Users", icon: UserRoundCog }] : []),
  ];

  /** Active state: exact match for home; prefix match for nested routes. */
  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={`flex flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-all ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Link groups */}
      <nav className="flex min-h-0 flex-1 flex-col p-3">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {projectNav.length > 0 && (
            <div className="space-y-1">
              {projectNav.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive(item.path)
                      ? "bg-[var(--highlight-bg)] text-[var(--highlight-foreground)]"
                      : "text-[color-mix(in_srgb,var(--sidebar-foreground),transparent_10%)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && item.badge && (
                    <span className="ml-auto rounded-full bg-[var(--highlight-strong)] px-2 py-0.5 text-xs text-[var(--highlight-strong-foreground)]">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {workspaceNav.length > 0 && (
          <div className="mt-auto flex-shrink-0 pt-3">
            <div className="space-y-1">
              {workspaceNav.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive(item.path)
                      ? "bg-[var(--highlight-bg)] text-[var(--highlight-foreground)]"
                      : "text-[color-mix(in_srgb,var(--sidebar-foreground),transparent_10%)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Collapse / expand control */}
      <div className={`flex h-12 items-center px-2 ${collapsed ? "justify-center" : "justify-end"}`}>
        <Button unstyled
          onClick={onToggle}
          className={`rounded-lg p-2 text-[var(--muted-foreground)] ${
            collapsed ? " bg-[var(--sidebar)] hover:bg-[var(--sidebar-accent)]" : "hover:bg-[var(--sidebar-accent)]"
          }`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
