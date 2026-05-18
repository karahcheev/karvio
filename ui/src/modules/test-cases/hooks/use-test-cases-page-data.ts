import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  useAllComponentsQuery,
  useAllProductsQuery,
  useProjectMembersQuery,
  useSuitesQuery,
  useTestCasesPageQuery,
  useTestCasesUnscopedTotalQuery,
  type TestCaseDto,
} from "@/shared/api";
import type { UnifiedTableSorting } from "@/shared/ui/Table";
import { LIST_SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { SELECTED_SUITE_PARAM } from "../utils/constants";
import { mapTestCaseToListItem, mapTestCaseSorting } from "../lib/test-cases-page.mappers";
import { getSelectedSuiteIdsForFilter } from "../lib/suite-tree.utils";
import type { TestCaseColumn, SuiteNode } from "../utils/types";

type OwnerOption = { id: string; username: string };

export type UseTestCasesPageDataParams = {
  projectId: string | undefined;
  selectedStatuses: Set<string>;
  selectedPriorities: Set<string>;
  searchQuery: string;
  sorting: UnifiedTableSorting<TestCaseColumn>;
};

export function useTestCasesPageData(params: UseTestCasesPageDataParams) {
  const [searchParams] = useSearchParams();
  const selectedSuite = searchParams.get(SELECTED_SUITE_PARAM);
  const { projectId, selectedStatuses, selectedPriorities, searchQuery, sorting } = params;
  const debouncedSearchQuery = useDebouncedValue(searchQuery, LIST_SEARCH_DEBOUNCE_MS);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const suitesQuery = useSuitesQuery(projectId);
  const projectMembersQuery = useProjectMembersQuery(projectId);
  const productsQuery = useAllProductsQuery(projectId);
  const componentsQuery = useAllComponentsQuery(projectId);

  const selectedSuiteIdsForFilter = useMemo(
    () => getSelectedSuiteIdsForFilter(selectedSuite, suitesQuery.data),
    [selectedSuite, suitesQuery.data],
  );

  const listFilters = useMemo(
    () => ({
      statuses: selectedStatuses.size > 0 ? (Array.from(selectedStatuses) as TestCaseDto["status"][]) : undefined,
      priorities: selectedPriorities.size > 0 ? Array.from(selectedPriorities) : undefined,
      search: debouncedSearchQuery.trim() || undefined,
      sortBy: mapTestCaseSorting(sorting.column) ?? undefined,
      sortOrder: sorting.direction,
    }),
    [selectedStatuses, selectedPriorities, debouncedSearchQuery, sorting.column, sorting.direction],
  );

  const testCasesPageQuery = useTestCasesPageQuery(projectId, {
    pageSize,
    suiteIds: selectedSuiteIdsForFilter ? Array.from(selectedSuiteIdsForFilter) : undefined,
    ...listFilters,
  });

  const listScopedBySuite = Boolean(selectedSuiteIdsForFilter);

  const listFiltersKey = useMemo(
    () =>
      JSON.stringify({
        projectId: projectId ?? "",
        statuses: listFilters.statuses ?? null,
        priorities: listFilters.priorities ?? null,
        search: listFilters.search ?? null,
        sortBy: listFilters.sortBy ?? null,
        sortOrder: listFilters.sortOrder ?? null,
      }),
    [projectId, listFilters],
  );

  const [unscopedTotalByListFiltersKey, setUnscopedTotalByListFiltersKey] = useState<Map<string, number>>(
    () => new Map(),
  );

  const pages = useMemo(() => testCasesPageQuery.data?.pages ?? [], [testCasesPageQuery.data?.pages]);
  const firstPageTotal = pages[0] && typeof pages[0].total === "number" ? pages[0].total : undefined;

  useEffect(() => {
    if (listScopedBySuite || firstPageTotal === undefined) return;
    setUnscopedTotalByListFiltersKey((prev) => {
      if (prev.get(listFiltersKey) === firstPageTotal) return prev;
      const next = new Map(prev);
      next.set(listFiltersKey, firstPageTotal);
      return next;
    });
  }, [firstPageTotal, listFiltersKey, listScopedBySuite]);

  const cachedUnscopedTotal = unscopedTotalByListFiltersKey.get(listFiltersKey);
  const needsUnscopedTotalFetch = listScopedBySuite && cachedUnscopedTotal === undefined;

  const allTestsTotalQuery = useTestCasesUnscopedTotalQuery(projectId, listFilters, {
    enabled: Boolean(projectId) && needsUnscopedTotalFetch,
  });

  useEffect(() => {
    if (allTestsTotalQuery.data === undefined) return;
    setUnscopedTotalByListFiltersKey((prev) => {
      if (prev.get(listFiltersKey) === allTestsTotalQuery.data) return prev;
      const next = new Map(prev);
      next.set(listFiltersKey, allTestsTotalQuery.data);
      return next;
    });
  }, [allTestsTotalQuery.data, listFiltersKey]);

  const hasNextPage = testCasesPageQuery.hasNextPage;
  const fetchNextPage = testCasesPageQuery.fetchNextPage;

  useEffect(() => {
    if (hasNextPage && currentPage > pages.length) {
      void fetchNextPage();
    }
  }, [currentPage, fetchNextPage, hasNextPage, pages.length]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSuiteIdsForFilter, selectedStatuses, selectedPriorities, debouncedSearchQuery, sorting.column, sorting.direction]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  const suites = useMemo<SuiteNode[]>(() => {
    if (!suitesQuery.data) return [];
    return suitesQuery.data.map((item) => ({
      id: item.id,
      name: item.name,
      parent: item.parent_id,
      count: 0,
      depth: 1,
      testCasesCount: item.test_cases_count ?? item.active_test_cases_count ?? 0,
    }));
  }, [suitesQuery.data]);

  const suiteNamesById = useMemo(
    () => new Map(suitesQuery.data?.map((item) => [item.id, item.name]) ?? []),
    [suitesQuery.data],
  );

  const listTotalItems = useMemo((): number | undefined => {
    const first = pages[0];
    if (first && typeof first.total === "number") return first.total;
    return undefined;
  }, [pages]);

  const totalPages = useMemo(() => {
    const first = pages[0];
    if (first && typeof first.total === "number") {
      return Math.max(1, Math.ceil(first.total / pageSize));
    }
    return Math.max(1, pages.length + (hasNextPage ? 1 : 0));
  }, [hasNextPage, pages, pageSize]);

  const totalFromMainListFirstPage = useMemo(() => {
    const first = pages[0];
    if (first && typeof first.total === "number") return first.total;
    return pages.reduce((acc, page) => acc + page.items.length, 0);
  }, [pages]);

  const allTestsTotal = listScopedBySuite
    ? (cachedUnscopedTotal ?? allTestsTotalQuery.data ?? 0)
    : totalFromMainListFirstPage;

  const testCases = useMemo(() => {
    const pageIndex = Math.min(currentPage - 1, pages.length - 1);
    const items = pageIndex >= 0 ? pages[pageIndex]?.items ?? [] : [];
    return items.map((item) => mapTestCaseToListItem(item, suiteNamesById));
  }, [pages, currentPage, suiteNamesById]);

  const ownerOptions = useMemo<OwnerOption[]>(() => {
    const members = projectMembersQuery.data ?? [];
    return members
      .map((m) => ({ id: m.user_id, username: m.username ?? "Unknown user" }))
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [projectMembersQuery.data]);

  const productOptions = useMemo(
    () =>
      (productsQuery.data ?? [])
        .map((product) => ({ id: product.id, name: product.name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [productsQuery.data],
  );

  const componentOptions = useMemo(
    () =>
      (componentsQuery.data ?? [])
        .map((component) => ({ id: component.id, name: component.name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [componentsQuery.data],
  );

  return {
    suites,
    suiteNamesById,
    testCases,
    allTestsTotal,
    ownerOptions,
    productOptions,
    componentOptions,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    listTotalItems,
    pages,
    totalPages,
    testCasesPageQuery,
  };
}
