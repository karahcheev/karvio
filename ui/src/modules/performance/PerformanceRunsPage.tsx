import { Navigate, useParams } from "react-router";
import { Gauge, GitCompare } from "lucide-react";
import { CommonPage, UrlHashTabs } from "@/shared/ui";
import { useUrlHashState } from "@/shared/lib/use-url-hash-state";
import { PerformanceComparisonsListView } from "./PerformanceComparisonsListView";
import { PerformanceRunsListView } from "./PerformanceRunsListView";

const PERFORMANCE_TABS = ["runs", "comparisons"] as const;
type PerformanceTab = (typeof PERFORMANCE_TABS)[number];

const PERFORMANCE_TAB_ITEMS = [
  { value: "runs", label: "Runs", icon: <Gauge className="h-4 w-4" /> },
  { value: "comparisons", label: "Comparisons", icon: <GitCompare className="h-4 w-4" /> },
] satisfies { value: PerformanceTab; label: string; icon: React.ReactNode }[];

export function PerformanceRunsModulePage() {
  const { projectId } = useParams();
  const [activeTab, setActiveTab] = useUrlHashState<PerformanceTab>({
    values: PERFORMANCE_TABS,
    defaultValue: "runs",
    omitHashFor: "runs",
  });

  if (!projectId) {
    return <Navigate to="/" replace />;
  }

  return (
    <CommonPage>
      <UrlHashTabs activeTab={activeTab} onTabChange={setActiveTab} items={PERFORMANCE_TAB_ITEMS} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === "runs" ? <PerformanceRunsListView /> : <PerformanceComparisonsListView />}
      </div>
    </CommonPage>
  );
}
