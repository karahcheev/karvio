import { useState } from "react";
import type { RunCaseDto } from "@/shared/api";

export function useTestRunFilters() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<RunCaseDto["status"]>>(new Set());
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set());

  const activeFiltersCount = selectedStatuses.size + selectedAssignees.size + (searchFilter.trim() ? 1 : 0);

  const handleStatusCardClick = (status: RunCaseDto["status"] | "all") => {
    setSelectedStatuses((previous) => {
      if (status === "all") return new Set();
      if (previous.size === 1 && previous.has(status)) return new Set();
      return new Set<RunCaseDto["status"]>([status]);
    });
  };

  const toggleStatusFilter = (status: RunCaseDto["status"]) => {
    setSelectedStatuses((previous) => {
      const next = new Set(previous);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const toggleAssigneeFilter = (assignee: string) => {
    setSelectedAssignees((previous) => {
      const next = new Set(previous);
      if (next.has(assignee)) next.delete(assignee);
      else next.add(assignee);
      return next;
    });
  };

  const clearAllFilters = () => {
    setSearchFilter("");
    setSelectedStatuses(new Set());
    setSelectedAssignees(new Set());
    setFiltersOpen(false);
  };

  return {
    filtersOpen,
    setFiltersOpen,
    searchFilter,
    setSearchFilter,
    selectedStatuses,
    selectedAssignees,
    activeFiltersCount,
    handleStatusCardClick,
    toggleStatusFilter,
    toggleAssigneeFilter,
    clearAllFilters,
  };
}
