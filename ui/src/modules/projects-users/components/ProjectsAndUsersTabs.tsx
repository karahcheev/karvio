// Top-level workspace tabs: projects vs users.
import { UrlHashTabs } from "@/shared/ui/Tabs";

export type WorkspaceTab = "projects" | "users";
export const WORKSPACE_TABS: readonly WorkspaceTab[] = ["projects", "users"];
const TAB_ITEMS = [
  { value: "projects", label: "Projects" },
  { value: "users", label: "Users" },
] satisfies { value: WorkspaceTab; label: string }[];

type ProjectsAndUsersTabsProps = Readonly<{
  activeTab: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
}>;

export function ProjectsAndUsersTabs({ activeTab, onChange }: ProjectsAndUsersTabsProps) {
  return (
    <UrlHashTabs
      activeTab={activeTab}
      onTabChange={onChange}
      items={TAB_ITEMS}
    />
  );
}
