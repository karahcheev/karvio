import { useCallback, useEffect, useMemo, useState } from "react";
import { useSuitesSearchQuery, useTestCasesSearchQuery } from "@/shared/api";
import type { SuiteDto, TestCaseDto, TestPlanDto } from "@/shared/api";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import { LIST_SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/shared/hooks/useDebouncedValue";

export const UNSORTED_SUITE_ID = "__unsorted__";

export type TestCaseSelectionMode = "tree" | "all" | "tag";

export function caseIdsMatchingTags(activeTestCases: TestCaseDto[], selectedTags: Set<string>): string[] {
  if (selectedTags.size === 0) return [];
  return activeTestCases
    .filter((testCase) => testCase.tags.some((tag) => selectedTags.has(tag.trim())))
    .map((testCase) => testCase.id);
}

type Params = {
  isOpen: boolean;
  projectId?: string;
  suites: SuiteDto[];
  testCases: TestCaseDto[];
  /** Plan being edited; null for new plan or test run creation */
  plan: TestPlanDto | null;
  /** When true, reset selection tab to "tree" each time the modal opens (create run) */
  resetUiOnOpen?: boolean;
  /** IDs to exclude from server-side queries (e.g. cases already in the run) */
  excludeTestCaseIds?: string[];
};

/** Same shape as test plan submit: suite_ids vs case_ids (unsorted suite rolls into case_ids). */
export function selectionSetsToPlanPayload(
  selectedSuiteIds: Set<string>,
  selectedCaseIds: Set<string>,
  casesBySuite: Map<string, TestCaseDto[]>,
  selectedTags?: Set<string>,
  activeTestCases?: TestCaseDto[],
): { suite_ids: string[]; case_ids: string[] } {
  const suiteIds = Array.from(selectedSuiteIds).filter((id) => id !== UNSORTED_SUITE_ID);
  let caseIds = Array.from(selectedCaseIds);
  if (selectedSuiteIds.has(UNSORTED_SUITE_ID)) {
    const unsortedIds = (casesBySuite.get(UNSORTED_SUITE_ID) ?? []).map((testCase) => testCase.id);
    caseIds = [...new Set([...caseIds, ...unsortedIds])];
  }
  if (selectedTags && activeTestCases && selectedTags.size > 0) {
    const fromTags = caseIdsMatchingTags(activeTestCases, selectedTags);
    caseIds = [...new Set([...caseIds, ...fromTags])];
  }
  return { suite_ids: suiteIds, case_ids: caseIds };
}

/** Flat case ids for addRunCases and summaries. */
export function selectionSetsToRunCaseIds(
  selectedSuiteIds: Set<string>,
  selectedCaseIds: Set<string>,
  casesBySuite: Map<string, TestCaseDto[]>,
  selectedTags?: Set<string>,
  activeTestCases?: TestCaseDto[],
): string[] {
  const { suite_ids, case_ids } = selectionSetsToPlanPayload(
    selectedSuiteIds,
    selectedCaseIds,
    casesBySuite,
    selectedTags,
    activeTestCases,
  );
  const ids = new Set<string>(case_ids);
  for (const sid of suite_ids) {
    for (const testCase of casesBySuite.get(sid) ?? []) ids.add(testCase.id);
  }
  return Array.from(ids);
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function suiteFromTestCase(testCase: TestCaseDto): SuiteDto | null {
  if (!testCase.suite_id) return null;
  return {
    id: testCase.suite_id,
    project_id: testCase.project_id,
    name: testCase.suite_name ?? "Unknown suite",
    parent_id: null,
    description: null,
    position: 0,
    created_at: testCase.created_at,
    updated_at: testCase.updated_at,
    test_cases_count: 0,
    active_test_cases_count: 0,
  };
}

export function useTestCaseSelectionState({ isOpen, projectId, suites, testCases, plan, resetUiOnOpen, excludeTestCaseIds }: Params) {
  const [selectionMode, setSelectionMode] = useState<TestCaseSelectionMode>("tree");
  const [selectedSuiteIds, setSelectedSuiteIds] = useState<Set<string>>(new Set());
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [expandedSuiteIds, setExpandedSuiteIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, LIST_SEARCH_DEBOUNCE_MS);
  const remoteSelectionEnabled = isOpen && Boolean(projectId);
  const selectedTagValues = useMemo(() => Array.from(selectedTags).sort(), [selectedTags]);

  const suitesQuery = useSuitesSearchQuery(projectId, debouncedSearchQuery, {
    enabled: remoteSelectionEnabled,
  });
  const testCasesQuery = useTestCasesSearchQuery(projectId, debouncedSearchQuery, {
    enabled: remoteSelectionEnabled,
    tags: selectionMode === "tag" && selectedTagValues.length > 0 ? selectedTagValues : undefined,
    excludeTestCaseIds: excludeTestCaseIds?.length ? excludeTestCaseIds : undefined,
  });

  const effectiveTestCases = useMemo(() => {
    if (!remoteSelectionEnabled) return testCases;
    return uniqueById(testCasesQuery.data?.pages.flatMap((page) => page.items) ?? []);
  }, [remoteSelectionEnabled, testCases, testCasesQuery.data?.pages]);

  const effectiveSuites = useMemo(() => {
    if (!remoteSelectionEnabled) return suites;
    const suiteMap = new Map<string, SuiteDto>();
    for (const suite of suitesQuery.data?.pages.flatMap((page) => page.items) ?? []) {
      suiteMap.set(suite.id, suite);
    }
    for (const testCase of effectiveTestCases) {
      const suite = suiteFromTestCase(testCase);
      if (suite && !suiteMap.has(suite.id)) {
        suiteMap.set(suite.id, suite);
      }
    }
    return Array.from(suiteMap.values());
  }, [effectiveTestCases, remoteSelectionEnabled, suites, suitesQuery.data?.pages]);

  useEffect(() => {
    if (!isOpen) return;
    if (resetUiOnOpen) setSelectionMode("tree");
    setSelectedSuiteIds(new Set(plan?.suite_ids ?? []));
    setSelectedCaseIds(new Set(plan?.case_ids ?? []));
    setSelectedTags(new Set());
    setExpandedSuiteIds(new Set());
    setSearchQuery("");
  }, [isOpen, plan, resetUiOnOpen]);

  useEffect(() => {
    if (!isOpen || !plan) return;
    const toExpand = new Set<string>();
    (plan?.case_ids ?? []).forEach((caseId) => {
      const testCase = effectiveTestCases.find((item) => item.id === caseId);
      if (testCase?.suite_id) toExpand.add(testCase.suite_id);
      else if (testCase && !testCase.suite_id) toExpand.add(UNSORTED_SUITE_ID);
    });
    if (toExpand.size === 0) return;
    setExpandedSuiteIds((previous) => {
      const next = new Set(previous);
      toExpand.forEach((suiteId) => next.add(suiteId));
      return next;
    });
  }, [isOpen, plan, effectiveTestCases]);

  const activeTestCases = useMemo(
    () => effectiveTestCases.filter((testCase) => testCase.status === "active"),
    [effectiveTestCases],
  );

  const casesBySuite = useMemo(() => {
    const map = new Map<string, TestCaseDto[]>();
    activeTestCases.forEach((testCase) => {
      const suiteId = testCase.suite_id ?? UNSORTED_SUITE_ID;
      const list = map.get(suiteId) ?? [];
      list.push(testCase);
      map.set(suiteId, list);
    });
    map.forEach((list, suiteId) => {
      const sorted = [...list].sort((a, b) => (a.key ?? "").localeCompare(b.key ?? ""));
      map.set(suiteId, sorted);
    });
    return map;
  }, [activeTestCases]);

  const testsCountBySuite = useMemo(() => {
    const counts = new Map<string, number>();
    casesBySuite.forEach((cases, suiteId) => counts.set(suiteId, cases.length));
    return counts;
  }, [casesBySuite]);

  const suitesWithCases = useMemo(
    () =>
      effectiveSuites
        .filter((suite) => (casesBySuite.get(suite.id)?.length ?? 0) > 0 || suite.active_test_cases_count > 0)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [effectiveSuites, casesBySuite],
  );

  const suiteNameById = useMemo(
    () => new Map(effectiveSuites.map((suite) => [suite.id, suite.name])),
    [effectiveSuites],
  );

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    selectedTags.forEach((tag) => tags.add(tag));
    activeTestCases.forEach((testCase) => {
      testCase.tags.forEach((tag) => {
        const value = tag.trim();
        if (value) tags.add(value);
      });
    });
    return Array.from(tags).sort((left, right) => left.localeCompare(right));
  }, [activeTestCases, selectedTags]);

  const casesMatchingSelectedTags = useMemo(() => {
    if (selectedTags.size === 0) return [];
    return activeTestCases.filter((testCase) => testCase.tags.some((tag) => selectedTags.has(tag.trim())));
  }, [activeTestCases, selectedTags]);

  const tagViewFilteredCases = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return casesMatchingSelectedTags;
    return casesMatchingSelectedTags.filter(
      (testCase) =>
        testCase.key.toLowerCase().includes(query) || (testCase.title ?? "").toLowerCase().includes(query),
    );
  }, [casesMatchingSelectedTags, searchQuery]);

  const filteredCases = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return activeTestCases;
    return activeTestCases.filter(
      (testCase) => testCase.key.toLowerCase().includes(query) || (testCase.title ?? "").toLowerCase().includes(query),
    );
  }, [activeTestCases, searchQuery]);

  const filteredSuitesForTree = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return suitesWithCases;
    return suitesWithCases.filter((suite) => {
      const nameMatch = suite.name.toLowerCase().includes(query);
      const casesInSuite = casesBySuite.get(suite.id) ?? [];
      const caseMatch = casesInSuite.some(
        (testCase) =>
          testCase.key.toLowerCase().includes(query) || (testCase.title ?? "").toLowerCase().includes(query),
      );
      return nameMatch || caseMatch;
    });
  }, [suitesWithCases, searchQuery, casesBySuite]);

  const toggleSuite = (suiteId: string) => {
    setSelectedSuiteIds((previous) => {
      const next = new Set(previous);
      if (next.has(suiteId)) next.delete(suiteId);
      else next.add(suiteId);
      return next;
    });
  };

  const toggleCase = (caseId: string) => {
    setSelectedCaseIds((previous) => {
      const next = new Set(previous);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  };

  const toggleCaseInSuite = (caseId: string, suiteId: string) => {
    if (!selectedSuiteIds.has(suiteId)) {
      toggleCase(caseId);
      return;
    }
    // Suite is selected: expand it and exclude this specific case
    const suiteCases = casesBySuite.get(suiteId) ?? [];
    setSelectedSuiteIds((previous) => {
      const next = new Set(previous);
      next.delete(suiteId);
      return next;
    });
    setSelectedCaseIds((previous) => {
      const next = new Set(previous);
      for (const c of suiteCases) {
        if (c.id !== caseId) next.add(c.id);
      }
      return next;
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((previous) => {
      const next = new Set(previous);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const toggleExpand = (suiteId: string) => {
    setExpandedSuiteIds((previous) => {
      const next = new Set(previous);
      if (next.has(suiteId)) next.delete(suiteId);
      else next.add(suiteId);
      return next;
    });
  };

  const selectAll = () => {
    if (selectionMode === "tree") {
      const suiteIds = effectiveSuites
        .filter((suite) => (testsCountBySuite.get(suite.id) ?? 0) > 0 || suite.active_test_cases_count > 0)
        .map((suite) => suite.id);
      if ((testsCountBySuite.get(UNSORTED_SUITE_ID) ?? 0) > 0) suiteIds.push(UNSORTED_SUITE_ID);
      setSelectedSuiteIds(new Set(suiteIds));
      setSelectedCaseIds(new Set());
      return;
    }
    if (selectionMode === "tag") {
      setSelectedTags(new Set(availableTags));
      return;
    }
    setSelectedCaseIds(new Set(filteredCases.map((testCase) => testCase.id)));
    setSelectedSuiteIds(new Set());
  };

  const clearAll = () => {
    setSelectedSuiteIds(new Set());
    setSelectedCaseIds(new Set());
    setSelectedTags(new Set());
  };

  /** Clear suite/case/tag picks (plan cancel); same effect as {@link clearAll}. */
  const clearSuiteAndCaseSelection = clearAll;

  const totalSelectedCount = useMemo(() => {
    const fromStructure = selectionSetsToRunCaseIds(selectedSuiteIds, selectedCaseIds, casesBySuite);
    const fromTags = caseIdsMatchingTags(activeTestCases, selectedTags);
    return new Set([...fromStructure, ...fromTags]).size;
  }, [selectedSuiteIds, selectedCaseIds, casesBySuite, activeTestCases, selectedTags]);

  const hasMoreSelectionData = remoteSelectionEnabled && Boolean(suitesQuery.hasNextPage || testCasesQuery.hasNextPage);
  const isFetchingMoreSelectionData = Boolean(suitesQuery.isFetchingNextPage || testCasesQuery.isFetchingNextPage);
  const isFetchingSelectionData = remoteSelectionEnabled && Boolean(suitesQuery.isFetching || testCasesQuery.isFetching);
  const loadMoreSelectionData = useCallback(() => {
    if (suitesQuery.hasNextPage && !suitesQuery.isFetchingNextPage) {
      invokeMaybeAsync(() => suitesQuery.fetchNextPage());
    }
    if (testCasesQuery.hasNextPage && !testCasesQuery.isFetchingNextPage) {
      invokeMaybeAsync(() => testCasesQuery.fetchNextPage());
    }
  }, [suitesQuery, testCasesQuery]);

  return {
    selectionMode,
    setSelectionMode,
    selectedSuiteIds,
    selectedCaseIds,
    selectedTags,
    expandedSuiteIds,
    searchQuery,
    setSearchQuery,
    casesBySuite,
    suiteNameById,
    availableTags,
    filteredCases,
    filteredSuitesForTree,
    tagViewFilteredCases,
    loadedCaseCount: activeTestCases.length,
    loadedSuiteCount: effectiveSuites.length,
    hasMoreSelectionData,
    isFetchingSelectionData,
    isFetchingMoreSelectionData,
    toggleSuite,
    toggleCase,
    toggleCaseInSuite,
    toggleTag,
    toggleExpand,
    selectAll,
    clearAll,
    loadMoreSelectionData,
    totalSelectedCount,
    clearSuiteAndCaseSelection,
    activeTestCases,
  };
}
