import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bulkCreateRunCases,
  createTestRun,
  deleteRunCase,
  deleteTestRun,
  getRunCase,
  getRunCases,
  getRunCasesPage,
  getTestCaseRunCasesPage,
  getTestRun,
  getTestRunsPage,
  importJunitXml,
  importProjectJunitXml,
  patchRunCase,
  patchRunCaseRow,
  patchTestRun,
  type ApiSortDirection,
  type RunCasesSortBy,
} from "../tms";
import { queryKeys } from "../query-keys";
import { invalidateGroups } from "./shared";

export type TestRunsPageQueryParams = Omit<Parameters<typeof getTestRunsPage>[0], "projectId" | "page"> & {
  page: number;
};

/** Paginated test runs for the project list (one request per visible page). */
export function useTestRunsPageQuery(projectId: string | undefined, params: TestRunsPageQueryParams) {
  return useQuery({
    queryKey: projectId
      ? queryKeys.testRuns.byProject(projectId, params)
      : queryKeys.testRuns.byProject("unknown", params),
    queryFn: () => getTestRunsPage({ projectId: projectId ?? "", ...params }),
    enabled: Boolean(projectId),
  });
}

/** Count of runs with status `in_progress` for sidebar badge (single lightweight request). */
export function useTestRunsInProgressCountQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? queryKeys.testRuns.inProgressBadge(projectId)
      : queryKeys.testRuns.inProgressBadge("unknown"),
    queryFn: () =>
      getTestRunsPage({
        projectId: projectId ?? "",
        page: 1,
        pageSize: 1,
        statuses: ["in_progress"],
        sortBy: "created_at",
        sortOrder: "desc",
      }),
    enabled: Boolean(projectId),
    select: (data) => (typeof data.total === "number" ? data.total : 0),
  });
}

export function useTestRunQuery(testRunId: string | undefined) {
  return useQuery({
    queryKey: testRunId ? queryKeys.testRuns.detail(testRunId) : queryKeys.testRuns.detail("unknown"),
    queryFn: () => getTestRun(testRunId ?? ""),
    enabled: Boolean(testRunId),
  });
}

export function useRunCasesQuery(
  testRunId: string | undefined,
  params?: { sortBy?: RunCasesSortBy; sortDirection?: ApiSortDirection },
) {
  return useQuery({
    queryKey: testRunId
      ? queryKeys.testRuns.runCases(testRunId, params)
      : queryKeys.testRuns.runCases("unknown", params),
    queryFn: () => getRunCases(testRunId ?? "", params),
    enabled: Boolean(testRunId),
  });
}

export type RunCasesPageParams = Omit<Parameters<typeof getRunCasesPage>[0], "testRunId" | "page">;

export function useRunCasesPageQuery(testRunId: string | undefined, params?: RunCasesPageParams) {
  const normalizedParams = params ?? {};
  return useInfiniteQuery({
    queryKey: testRunId
      ? queryKeys.testRuns.runCasesPage(testRunId, normalizedParams)
      : queryKeys.testRuns.runCasesPage("unknown", normalizedParams),
    queryFn: ({ pageParam }) =>
      getRunCasesPage({
        testRunId: testRunId ?? "",
        ...normalizedParams,
        page: pageParam ?? 1,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.has_next ? lastPage.page + 1 : undefined),
    enabled: Boolean(testRunId),
  });
}

export type TestCaseRunCasesPageParams = Omit<
  Parameters<typeof getTestCaseRunCasesPage>[0],
  "projectId" | "testCaseId" | "page"
>;

export function useTestCaseRunCasesPageQuery(
  projectId: string | undefined,
  testCaseId: string | undefined,
  params?: TestCaseRunCasesPageParams,
) {
  const normalizedParams = params ?? {};
  return useInfiniteQuery({
    queryKey:
      projectId && testCaseId
        ? queryKeys.testCases.resultsHistory(projectId, testCaseId, normalizedParams)
        : queryKeys.testCases.resultsHistory("unknown", "unknown", normalizedParams),
    queryFn: ({ pageParam }) =>
      getTestCaseRunCasesPage({
        projectId: projectId ?? "",
        testCaseId: testCaseId ?? "",
        ...normalizedParams,
        page: pageParam ?? 1,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.has_next ? lastPage.page + 1 : undefined),
    enabled: Boolean(projectId) && Boolean(testCaseId),
  });
}

export function useRunCaseQuery(runCaseId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: runCaseId ? queryKeys.testRuns.runCase(runCaseId) : queryKeys.testRuns.runCase("unknown"),
    queryFn: () => getRunCase(runCaseId ?? ""),
    enabled: Boolean(runCaseId) && enabled,
  });
}

export function useCreateTestRunMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTestRun,
    onSuccess: async (run) => {
      await invalidateGroups(queryClient, [
        queryKeys.testRuns.projectScope(run.project_id),
        queryKeys.milestones.projectScope(run.project_id),
      ]);
      if (run.milestone_id) {
        await invalidateGroups(queryClient, [queryKeys.milestones.summary(run.milestone_id)]);
      }
    },
  });
}

export function useAddRunCasesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ runId, payload }: { runId: string; payload: Parameters<typeof bulkCreateRunCases>[1] }) =>
      bulkCreateRunCases(runId, payload),
    onSuccess: async (_, variables) => {
      const run = queryClient.getQueryData<Awaited<ReturnType<typeof getTestRun>>>(
        queryKeys.testRuns.detail(variables.runId),
      );
      const groups = [
        queryKeys.testRuns.runCases(variables.runId),
        queryKeys.testRuns.runCasesPage(variables.runId),
        queryKeys.testRuns.detail(variables.runId),
        ...(run?.project_id ? [queryKeys.testRuns.projectScope(run.project_id)] : []),
      ];
      await invalidateGroups(queryClient, groups);
    },
  });
}

export function useSetTestRunStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      runId,
      status,
      started_at,
    }: {
      runId: string;
      status: "in_progress" | "completed" | "archived";
      started_at?: string | null;
    }) => patchTestRun(runId, { status, started_at }),
    onSuccess: async (run) => {
      await invalidateGroups(queryClient, [
        queryKeys.testRuns.detail(run.id),
        queryKeys.testRuns.projectScope(run.project_id),
        queryKeys.testRuns.detail(run.id),
        queryKeys.milestones.projectScope(run.project_id),
      ]);
      if (run.milestone_id) {
        await invalidateGroups(queryClient, [queryKeys.milestones.summary(run.milestone_id)]);
      }
    },
  });
}

export function useImportJunitXmlMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      runId,
      file,
      dryRun,
      createMissingCases,
    }: {
      runId: string;
      projectId: string;
      file: File;
      dryRun?: boolean;
      createMissingCases?: boolean;
    }) => importJunitXml(runId, { file, dryRun, createMissingCases }),
    onSuccess: async (result, variables) => {
      await invalidateGroups(queryClient, [
        queryKeys.testRuns.detail(result.test_run_id),
        queryKeys.testRuns.projectScope(variables.projectId),
        queryKeys.testRuns.runCases(result.test_run_id),
        queryKeys.testRuns.runCasesPage(result.test_run_id),
      ]);
    },
  });
}

export function useImportProjectJunitXmlMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      file,
      createMissingCases,
    }: {
      projectId: string;
      file: File;
      createMissingCases?: boolean;
    }) => importProjectJunitXml(projectId, { file, createMissingCases }),
    onSuccess: async (result, variables) => {
      await invalidateGroups(queryClient, [
        queryKeys.testRuns.projectScope(variables.projectId),
        queryKeys.testRuns.detail(result.test_run_id),
        queryKeys.testRuns.runCases(result.test_run_id),
        queryKeys.testRuns.runCasesPage(result.test_run_id),
      ]);
    },
  });
}

export function useDeleteTestRunMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTestRun,
    onSuccess: async (_, runId) => {
      await invalidateGroups(queryClient, [
        queryKeys.testRuns.detail(runId),
        queryKeys.testRuns.detail(runId),
        queryKeys.testRuns.runCases(runId),
      ]);
      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "projects" && query.queryKey[2] === "milestones",
      });
    },
  });
}

export function usePatchRunCaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: {
      runCaseId: string;
      runId: string;
      payload: Parameters<typeof patchRunCase>[1];
    }) => patchRunCase(variables.runCaseId, variables.payload),
    onSuccess: async (data, variables) => {
      await invalidateGroups(queryClient, [
        queryKeys.testRuns.runCase(data.id),
        queryKeys.testRuns.runCases(variables.runId),
        queryKeys.testRuns.runCasesPage(variables.runId),
        queryKeys.testRuns.detail(variables.runId),
      ]);
    },
  });
}

export function usePatchRunCaseRowMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: {
      runCaseRowId: string;
      runCaseId: string;
      runId: string;
      payload: Parameters<typeof patchRunCaseRow>[1];
    }) => patchRunCaseRow(variables.runCaseRowId, variables.payload),
    onSuccess: async (_, variables) => {
      await invalidateGroups(queryClient, [
        queryKeys.testRuns.runCase(variables.runCaseId),
        queryKeys.testRuns.runCases(variables.runId),
        queryKeys.testRuns.runCasesPage(variables.runId),
        queryKeys.testRuns.detail(variables.runId),
      ]);
    },
  });
}

export function useDeleteRunCaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ runCaseId }: { runCaseId: string; runId: string }) => deleteRunCase(runCaseId),
    onSuccess: async (_, variables) => {
      if (variables.runId) {
        await invalidateGroups(queryClient, [
          queryKeys.testRuns.runCases(variables.runId),
          queryKeys.testRuns.runCasesPage(variables.runId),
          queryKeys.testRuns.detail(variables.runId),
        ]);
      }
    },
  });
}
