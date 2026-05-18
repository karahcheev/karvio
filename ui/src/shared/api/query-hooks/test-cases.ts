import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bulkOperateTestCases,
  checkAiDuplicates,
  createSuite,
  createTestCase,
  deleteTestCase,
  generateAiTestCases,
  getAiTestCaseStatus,
  deleteSuite,
  getStepAttachments,
  getSuitesPage,
  getTestCase,
  getTestCaseAttachments,
  getTestCaseSteps,
  getTestCases,
  getTestCasesPage,
  patchTestCase,
  replaceTestCaseSteps,
  reviewAiTestCase,
  type ApiSortDirection,
  type TestCasesSortBy,
} from "../tms";
import { queryKeys } from "../query-keys";
import { invalidateGroups } from "./shared";

const TEST_CASES_SEARCH_PAGE_SIZE = 50;
const SUITES_SEARCH_PAGE_SIZE = 100;

export function useSuitesQuery(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: projectId ? queryKeys.suites.byProject(projectId) : queryKeys.suites.byProject("unknown"),
    queryFn: () =>
      getSuitesPage({
        projectId: projectId ?? "",
        page: 1,
        pageSize: 200,
      }).then((page) => page.items),
    enabled: Boolean(projectId) && enabled,
  });
}

export function useTestCasesQuery(
  projectId: string | undefined,
  params?: { sortBy?: TestCasesSortBy; sortDirection?: ApiSortDirection },
) {
  const sortBy = params?.sortBy ?? "created_at";
  const sortDirection = params?.sortDirection ?? "desc";
  return useQuery({
    queryKey: projectId
      ? queryKeys.testCases.list(projectId, sortBy, sortDirection)
      : queryKeys.testCases.list("unknown", sortBy, sortDirection),
    queryFn: () => getTestCases(projectId ?? "", { sortBy, sortDirection }),
    enabled: Boolean(projectId),
  });
}

export type TestCasesPageParams = Parameters<typeof getTestCasesPage>[0];

export function useTestCasesPageQuery(
  projectId: string | undefined,
  params: Omit<TestCasesPageParams, "projectId" | "page">,
) {
  return useInfiniteQuery({
    queryKey: projectId ? queryKeys.testCases.page(projectId, params) : queryKeys.testCases.page("unknown", params),
    queryFn: ({ pageParam }) =>
      getTestCasesPage({
        projectId: projectId ?? "",
        ...params,
        page: pageParam ?? 1,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.has_next ? lastPage.page + 1 : undefined),
    enabled: Boolean(projectId),
  });
}

/** Total rows for list filters excluding suite (only needed when the main list is scoped by suite). */
export function useTestCasesUnscopedTotalQuery(
  projectId: string | undefined,
  params: Omit<TestCasesPageParams, "projectId" | "page" | "pageSize" | "suiteIds">,
  options?: { enabled?: boolean },
) {
  const pageParams = { ...params, pageSize: 1 };
  const enabled = (options?.enabled ?? true) && Boolean(projectId);
  return useQuery({
    queryKey: projectId
      ? queryKeys.testCases.page(projectId, pageParams)
      : queryKeys.testCases.page("unknown", pageParams),
    queryFn: () =>
      getTestCasesPage({
        projectId: projectId ?? "",
        ...params,
        page: 1,
        pageSize: 1,
      }),
    enabled,
    select: (page) => (typeof page.total === "number" ? page.total : 0),
  });
}

export function useTestCasesSearchQuery(
  projectId: string | undefined,
  searchQuery: string,
  params?: {
    excludeTestCaseIds?: string[];
    tags?: string[];
    enabled?: boolean;
  },
) {
  const enabled = (params?.enabled ?? true) && Boolean(projectId);
  return useInfiniteQuery({
    queryKey: projectId
      ? queryKeys.testCases.search(projectId, searchQuery, {
          excludeTestCaseIds: params?.excludeTestCaseIds,
          tags: params?.tags,
        })
      : queryKeys.testCases.search("unknown", searchQuery),
    queryFn: ({ pageParam }) =>
      getTestCasesPage({
        projectId: projectId ?? "",
        search: searchQuery.trim() || undefined,
        pageSize: TEST_CASES_SEARCH_PAGE_SIZE,
        page: pageParam ?? 1,
        statuses: ["active"],
        excludeTestCaseIds: params?.excludeTestCaseIds,
        tags: params?.tags,
        sortBy: "key",
        sortOrder: "asc",
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.has_next ? lastPage.page + 1 : undefined),
    enabled,
  });
}

export function useSuitesSearchQuery(
  projectId: string | undefined,
  searchQuery: string,
  params?: { enabled?: boolean },
) {
  const enabled = (params?.enabled ?? true) && Boolean(projectId);
  return useInfiniteQuery({
    queryKey: projectId
      ? queryKeys.suites.search(projectId, searchQuery)
      : queryKeys.suites.search("unknown", searchQuery),
    queryFn: ({ pageParam }) =>
      getSuitesPage({
        projectId: projectId ?? "",
        search: searchQuery.trim() || undefined,
        page: pageParam ?? 1,
        pageSize: SUITES_SEARCH_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.has_next ? lastPage.page + 1 : undefined),
    enabled,
  });
}

export function useTestCaseQuery(testCaseId: string | undefined) {
  return useQuery({
    queryKey: testCaseId ? queryKeys.testCases.detail(testCaseId) : queryKeys.testCases.detail("unknown"),
    queryFn: () => getTestCase(testCaseId ?? ""),
    enabled: Boolean(testCaseId),
  });
}

export function useTestCaseStepsQuery(testCaseId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: testCaseId ? queryKeys.testCases.steps(testCaseId) : queryKeys.testCases.steps("unknown"),
    queryFn: () => getTestCaseSteps(testCaseId ?? ""),
    enabled: Boolean(testCaseId) && enabled,
  });
}

export function useTestCaseAttachmentsQuery(testCaseId: string | undefined) {
  return useQuery({
    queryKey: testCaseId
      ? queryKeys.testCases.attachments(testCaseId)
      : queryKeys.testCases.attachments("unknown"),
    queryFn: () => getTestCaseAttachments(testCaseId ?? ""),
    enabled: Boolean(testCaseId),
  });
}

export function useStepAttachmentsQuery(testCaseId: string | undefined, stepId: string | undefined) {
  return useQuery({
    queryKey:
      testCaseId && stepId
        ? queryKeys.testCases.stepAttachments(testCaseId, stepId)
        : (["test-cases", "unknown", "steps", "unknown", "attachments"] as const),
    queryFn: () => getStepAttachments(testCaseId ?? "", stepId ?? ""),
    enabled: Boolean(testCaseId) && Boolean(stepId),
  });
}

export type TestCaseDetailQueryResult = Awaited<ReturnType<typeof fetchTestCaseDetail>>;

async function fetchTestCaseDetail(projectId: string, testCaseId: string) {
  const [testCase, caseFiles] = await Promise.all([
    getTestCase(testCaseId),
    getTestCaseAttachments(testCaseId),
  ]);
  const stepsResponse =
    testCase.template_type === "steps"
      ? await getTestCaseSteps(testCaseId)
      : { test_case_id: testCaseId, steps: [], step_attachments: {} };
  const stepItems = stepsResponse.steps;
  const stepAttachments = stepsResponse.step_attachments ?? {};

  return {
    testCase,
    stepItems,
    caseFiles,
    stepAttachments,
  };
}

export function useTestCaseDetailQuery(projectId: string | undefined, testCaseId: string | undefined) {
  return useQuery({
    queryKey:
      projectId && testCaseId
        ? queryKeys.testCases.detailFull(projectId, testCaseId)
        : (["test-cases", "unknown", "detail-full", "unknown"] as const),
    queryFn: () => fetchTestCaseDetail(projectId ?? "", testCaseId ?? ""),
    enabled: Boolean(projectId) && Boolean(testCaseId),
  });
}

export function useCreateSuiteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSuite,
    onSuccess: async (_, variables) => {
      await invalidateGroups(queryClient, [
        queryKeys.suites.byProject(variables.project_id),
        queryKeys.testCases.byProject(variables.project_id),
      ]);
    },
  });
}

export function useDeleteSuiteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSuite,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (q) =>
          (q.queryKey[0] === "projects" && q.queryKey[2] === "suites") ||
          (q.queryKey[0] === "projects" && q.queryKey[2] === "test-cases"),
      });
    },
  });
}

export function useCreateTestCaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTestCase,
    onSuccess: async (_, variables) => {
      await invalidateGroups(queryClient, [
        queryKeys.testCases.byProject(variables.project_id),
        queryKeys.suites.byProject(variables.project_id),
      ]);
    },
  });
}

export function useDeleteTestCaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { testCaseId: string; projectId?: string }) => deleteTestCase(variables.testCaseId),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.testCases.detail(variables.testCaseId) }),
        queryClient.cancelQueries({ queryKey: queryKeys.testCases.steps(variables.testCaseId) }),
        queryClient.cancelQueries({ queryKey: queryKeys.testCases.attachments(variables.testCaseId) }),
        ...(variables.projectId
          ? [
              queryClient.cancelQueries({
                queryKey: queryKeys.testCases.detailFull(variables.projectId, variables.testCaseId),
              }),
              queryClient.cancelQueries({
                queryKey: queryKeys.datasets.byTestCase(variables.projectId, variables.testCaseId),
              }),
              queryClient.cancelQueries({
                queryKey: queryKeys.testCases.resultsHistory(variables.projectId, variables.testCaseId),
              }),
            ]
          : []),
      ]);

      queryClient.removeQueries({ queryKey: queryKeys.testCases.detail(variables.testCaseId), exact: true });
      queryClient.removeQueries({ queryKey: queryKeys.testCases.steps(variables.testCaseId), exact: true });
      queryClient.removeQueries({ queryKey: queryKeys.testCases.attachments(variables.testCaseId), exact: true });
      if (variables.projectId) {
        queryClient.removeQueries({
          queryKey: queryKeys.testCases.detailFull(variables.projectId, variables.testCaseId),
          exact: true,
        });
        queryClient.removeQueries({
          queryKey: queryKeys.datasets.byTestCase(variables.projectId, variables.testCaseId),
        });
        queryClient.removeQueries({
          queryKey: queryKeys.testCases.resultsHistory(variables.projectId, variables.testCaseId),
        });
      }

      const keys = [
        queryKeys.testCases.all,
        ...(variables.projectId ? [queryKeys.testCases.byProject(variables.projectId)] : []),
      ] as ReadonlyArray<readonly unknown[]>;
      await invalidateGroups(queryClient, keys);
    },
  });
}

export function usePatchTestCaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ testCaseId, payload }: { testCaseId: string; payload: Parameters<typeof patchTestCase>[1] }) =>
      patchTestCase(testCaseId, payload),
    onSuccess: async (data) => {
      queryClient.setQueryData(queryKeys.testCases.detail(data.id), data);
      queryClient.setQueryData(
        queryKeys.testCases.detailFull(data.project_id, data.id),
        (current: TestCaseDetailQueryResult | undefined) =>
          current
            ? {
                ...current,
                testCase: data,
              }
            : undefined,
      );
      await invalidateGroups(queryClient, [
        queryKeys.testCases.byProject(data.project_id),
        queryKeys.testCases.steps(data.id),
      ] as ReadonlyArray<readonly unknown[]>);
    },
  });
}

export function useReplaceTestCaseStepsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: {
      testCaseId: string;
      projectId?: string;
      steps: Parameters<typeof replaceTestCaseSteps>[1];
    }) => replaceTestCaseSteps(variables.testCaseId, variables.steps),
    onSuccess: async (_, variables) => {
      const keys = [
        queryKeys.testCases.steps(variables.testCaseId),
        queryKeys.testCases.detail(variables.testCaseId),
        ...(variables.projectId
          ? [queryKeys.testCases.detailFull(variables.projectId, variables.testCaseId)]
          : []),
      ] as ReadonlyArray<readonly unknown[]>;
      await invalidateGroups(queryClient, keys);
    },
  });
}

export function useSetTestCaseStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: {
      testCaseId: string;
      projectId?: string;
      status: "draft" | "active" | "archived";
    }) => patchTestCase(variables.testCaseId, { status: variables.status }),
    onSuccess: async (data, variables) => {
      await invalidateGroups(queryClient, [
        queryKeys.testCases.detail(data.id),
        queryKeys.testCases.all,
        ...(variables.projectId ? [queryKeys.testCases.detailFull(variables.projectId, data.id)] : []),
      ] as ReadonlyArray<readonly unknown[]>);
    },
  });
}

export function useBulkOperateTestCasesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkOperateTestCases,
    onSuccess: async (_, variables) => {
      await invalidateGroups(queryClient, [
        queryKeys.testCases.byProject(variables.project_id),
        queryKeys.suites.byProject(variables.project_id),
      ]);
    },
  });
}

export function useAiTestCaseStatusQuery(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.ai.testCaseStatus(projectId),
    queryFn: () => getAiTestCaseStatus(projectId),
    retry: false,
  });
}

export function useGenerateAiTestCasesMutation() {
  return useMutation({
    mutationFn: generateAiTestCases,
  });
}

export function useReviewAiTestCaseMutation() {
  return useMutation({
    mutationFn: ({ testCaseId, payload }: { testCaseId: string; payload: Parameters<typeof reviewAiTestCase>[1] }) =>
      reviewAiTestCase(testCaseId, payload),
  });
}

export function useCheckAiDuplicatesMutation() {
  return useMutation({
    mutationFn: checkAiDuplicates,
  });
}
