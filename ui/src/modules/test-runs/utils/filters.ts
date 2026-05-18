import type { RunView } from "@/modules/test-runs/components";

function runEnvironmentSearchText(run: RunView): string {
  if (run.environment_name?.trim()) {
    const rev = run.environment_revision_number != null ? ` · r${run.environment_revision_number}` : "";
    return `${run.environment_name}${rev}`;
  }
  return (run.environment_id ?? "").trim();
}

export function filterRuns(
  runs: RunView[],
  searchQuery: string,
  selectedStatuses: Set<string>,
  selectedEnvironments: Set<string>,
) {
  const query = searchQuery.trim().toLowerCase();
  return runs.filter((run) => {
    const matchesStatus = selectedStatuses.size === 0 || selectedStatuses.has(run.status);
    const matchesEnvironment =
      selectedEnvironments.size === 0 ||
      (run.environment_id != null && selectedEnvironments.has(run.environment_id));
    const envText = runEnvironmentSearchText(run).toLowerCase();
    const matchesSearch =
      !query ||
      run.name.toLowerCase().includes(query) ||
      (run.build ?? "").toLowerCase().includes(query) ||
      envText.includes(query) ||
      (run.environment_id ?? "").toLowerCase().includes(query);
    return matchesStatus && matchesEnvironment && matchesSearch;
  });
}
