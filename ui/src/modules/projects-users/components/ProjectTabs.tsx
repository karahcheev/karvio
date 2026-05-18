// Hash-synced tabs for project details vs members.
import { UrlHashTabs } from "@/shared/ui/Tabs";

export type ProjectTab = "details" | "members";

const TAB_ITEMS = [
  { value: "details", label: "Details" },
  { value: "members", label: "Members" },
] satisfies { value: ProjectTab; label: string }[];

type ProjectTabsProps = Readonly<{
  activeTab: ProjectTab;
  onChange: (tab: ProjectTab) => void;
}>;

export function ProjectTabs({ activeTab, onChange }: ProjectTabsProps) {
  return (
    <UrlHashTabs
      activeTab={activeTab}
      onTabChange={onChange}
      items={TAB_ITEMS}
    />
  );
}
