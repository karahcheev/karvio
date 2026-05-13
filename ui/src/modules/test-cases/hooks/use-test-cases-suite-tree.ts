import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useCreateSuiteMutation, useDeleteSuiteMutation } from "@/shared/api";
import { getSessionUser } from "@/shared/auth/session";
import { useDeleteConfirmation } from "@/shared/lib/use-delete-confirmation";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import {
  EXPANDED_SUITES_PARAM,
  MAX_SUITE_DEPTH,
  SELECTED_SUITE_PARAM,
  SUITES_COLLAPSED_PARAM,
  SUITES_COLLAPSED_STORAGE_KEY,
} from "../utils/constants";
import { parseExpandedSuites, getStoredSuitesCollapsed } from "../lib/test-cases-page.utils";
import { buildSuiteMeta } from "../lib/suite-tree.utils";
import type { SuiteNode } from "../utils/types";

export type UseTestCasesSuiteTreeParams = {
  suites: SuiteNode[];
};

export function useTestCasesSuiteTree(params: UseTestCasesSuiteTreeParams) {
  const { suites } = params;
  const [searchParams, setSearchParams] = useSearchParams();
  const { confirmDelete } = useDeleteConfirmation();

  const createSuiteMutation = useCreateSuiteMutation();
  const deleteSuiteMutation = useDeleteSuiteMutation();
  const isAdmin = getSessionUser()?.role === "admin";

  const [selectedSuite, setSelectedSuite] = useState<string | null>(() => searchParams.get(SELECTED_SUITE_PARAM));
  const [isSuitesSidebarCollapsed, setIsSuitesSidebarCollapsed] = useState(() => {
    const fromUrl = searchParams.get(SUITES_COLLAPSED_PARAM);
    if (fromUrl !== null) return fromUrl === "1";
    return getStoredSuitesCollapsed();
  });
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(() =>
    parseExpandedSuites(searchParams.get(EXPANDED_SUITES_PARAM)),
  );
  const [isCreatingNewSuite, setIsCreatingNewSuite] = useState(false);
  const [creatingSuiteParentId, setCreatingSuiteParentId] = useState<string | null>(null);
  const [newSuiteInputValue, setNewSuiteInputValue] = useState("");

  useEffect(() => {
    const fromUrl = searchParams.get(SUITES_COLLAPSED_PARAM);
    setIsSuitesSidebarCollapsed(fromUrl !== null ? fromUrl === "1" : getStoredSuitesCollapsed());
    setSelectedSuite(searchParams.get(SELECTED_SUITE_PARAM));
    setExpandedSuites(parseExpandedSuites(searchParams.get(EXPANDED_SUITES_PARAM)));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    const expanded = Array.from(expandedSuites).sort((a, b) => a.localeCompare(b)).join(",");
    if (expanded) nextParams.set(EXPANDED_SUITES_PARAM, expanded);
    else nextParams.delete(EXPANDED_SUITES_PARAM);

    if (selectedSuite) nextParams.set(SELECTED_SUITE_PARAM, selectedSuite);
    else nextParams.delete(SELECTED_SUITE_PARAM);

    if (isSuitesSidebarCollapsed) {
      nextParams.set(SUITES_COLLAPSED_PARAM, "1");
      try {
        localStorage.setItem(SUITES_COLLAPSED_STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
    } else {
      nextParams.delete(SUITES_COLLAPSED_PARAM);
      try {
        localStorage.setItem(SUITES_COLLAPSED_STORAGE_KEY, "0");
      } catch {
        /* ignore */
      }
    }

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [expandedSuites, isSuitesSidebarCollapsed, searchParams, selectedSuite, setSearchParams]);

  const directCaseCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const suite of suites) map.set(suite.id, suite.testCasesCount);
    return map;
  }, [suites]);

  const suiteMeta = useMemo(
    () => buildSuiteMeta(suites, directCaseCounts),
    [suites, directCaseCounts],
  );

  const suitesWithMeta = useMemo(
    () => suites.map((suite) => ({ ...suite, count: suiteMeta.getAggregateCount(suite.id), depth: suiteMeta.getDepth(suite.id) })),
    [suiteMeta, suites],
  );

  const toggleSuite = useCallback((suiteId: string) => {
    setExpandedSuites((prev) => {
      const next = new Set(prev);
      if (next.has(suiteId)) next.delete(suiteId);
      else next.add(suiteId);
      return next;
    });
  }, []);

  const handleNewSuiteClick = useCallback(
    (parentSuiteId: string | null) => {
      const parentDepth = parentSuiteId ? suiteMeta.getDepth(parentSuiteId) : 0;
      if (parentSuiteId && parentDepth >= MAX_SUITE_DEPTH) {
        notifyError(`Suite nesting is limited to ${MAX_SUITE_DEPTH} levels.`, "Failed to create suite.");
        return;
      }
      if (parentSuiteId) {
        setExpandedSuites((prev) => {
          const next = new Set(prev);
          next.add(parentSuiteId);
          return next;
        });
      }
      setCreatingSuiteParentId(parentSuiteId);
      setIsCreatingNewSuite(true);
      setNewSuiteInputValue("");
    },
    [suiteMeta],
  );

  const handleCreateSuite = useCallback(
    async (projectId: string | undefined) => {
      if (!projectId || !newSuiteInputValue.trim()) return;
      try {
        const created = await createSuiteMutation.mutateAsync({
          project_id: projectId,
          name: newSuiteInputValue.trim(),
          parent_id: creatingSuiteParentId,
          description: null,
        });
        setIsCreatingNewSuite(false);
        setCreatingSuiteParentId(null);
        setNewSuiteInputValue("");
        notifySuccess(`Suite "${created.name}" created`);
      } catch (error) {
        notifyError(error, "Failed to create suite.");
      }
    },
    [createSuiteMutation, creatingSuiteParentId, newSuiteInputValue],
  );

  const handleCancelNewSuite = useCallback(() => {
    setIsCreatingNewSuite(false);
    setCreatingSuiteParentId(null);
    setNewSuiteInputValue("");
  }, []);

  const handleDeleteSuite = useCallback(
    async (suiteId: string) => {
      if (!isAdmin) {
        notifyError("Only admins can delete suites.", "Forbidden");
        return;
      }
      const suite = suitesWithMeta.find((item) => item.id === suiteId);
      if (!suite) return;
      const confirmed = await confirmDelete({
        title: "Delete Suite",
        description:
          `Delete suite "${suite.name}"? All nested suites and all test cases inside this branch will be permanently deleted. This action cannot be undone.`,
        confirmLabel: "Delete Suite",
        acknowledgementLabel: "I understand that all nested suites and test cases will be permanently deleted.",
      });
      if (!confirmed) return;

      try {
        await deleteSuiteMutation.mutateAsync(suiteId);
        const deletedIds = new Set([suiteId, ...suiteMeta.getDescendants(suiteId)]);
        if (selectedSuite && deletedIds.has(selectedSuite)) setSelectedSuite(null);
        notifySuccess(`Suite "${suite.name}" deleted`);
      } catch (error) {
        notifyError(error, "Failed to delete suite.");
      }
    },
    [confirmDelete, deleteSuiteMutation, isAdmin, selectedSuite, suiteMeta, suitesWithMeta],
  );

  return {
    selectedSuite,
    setSelectedSuite,
    isSuitesSidebarCollapsed,
    setIsSuitesSidebarCollapsed,
    expandedSuites,
    isCreatingNewSuite,
    creatingSuiteParentId,
    newSuiteInputValue,
    setNewSuiteInputValue,
    suitesWithMeta,
    suiteMeta,
    toggleSuite,
    onNewSuiteClick: handleNewSuiteClick,
    onCreateSuite: handleCreateSuite,
    onCancelNewSuite: handleCancelNewSuite,
    onDeleteSuite: handleDeleteSuite,
    canDeleteSuites: isAdmin,
  };
}
