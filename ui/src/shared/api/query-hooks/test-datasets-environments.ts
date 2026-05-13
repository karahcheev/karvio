import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bindDatasetToTestCase,
  bulkOperateTestDatasets,
  createEnvironment,
  createTestDataset,
  deleteEnvironment,
  deleteTestDataset,
  getEnvironment,
  getEnvironmentRevisionsPage,
  getEnvironmentUseCases,
  getEnvironmentsPage,
  getTestCaseDatasetBindings,
  getTestDataset,
  getTestDatasetsPage,
  patchEnvironment,
  patchTestDataset,
  unbindDatasetFromTestCase,
} from "../tms";
import { queryKeys } from "../query-keys";
import { invalidateGroups } from "./shared";

export type TestDatasetsPageQueryParams = Omit<Parameters<typeof getTestDatasetsPage>[0], "projectId"> & {
  page: number;
};

function testDatasetsPageQueryKey(projectId: string | undefined, params: TestDatasetsPageQueryParams) {
  const scope = projectId ?? "unknown";
  const testCaseId = params.testCaseId;
  if (testCaseId) {
    return queryKeys.datasets.byTestCase(scope, testCaseId, params);
  }
  return queryKeys.datasets.byProject(scope, params);
}

export function useTestDatasetsPageQuery(
  projectId: string | undefined,
  params: TestDatasetsPageQueryParams,
  enabled = true,
) {
  return useQuery({
    queryKey: testDatasetsPageQueryKey(projectId, params),
    queryFn: () => getTestDatasetsPage({ projectId: projectId ?? "", ...params }),
    enabled: Boolean(projectId) && enabled,
  });
}

export function useTestDatasetQuery(datasetId: string | undefined) {
  return useQuery({
    queryKey: datasetId ? queryKeys.datasets.detail(datasetId) : queryKeys.datasets.detail("unknown"),
    queryFn: () => getTestDataset(datasetId ?? ""),
    enabled: Boolean(datasetId),
  });
}

export function useTestCaseDatasetBindingsQuery(testCaseId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: testCaseId
      ? queryKeys.datasets.bindingsByTestCase(testCaseId)
      : queryKeys.datasets.bindingsByTestCase("unknown"),
    queryFn: () => getTestCaseDatasetBindings(testCaseId ?? ""),
    enabled: Boolean(testCaseId) && enabled,
    select: (data) => data.items,
  });
}

export type EnvironmentsPageQueryParams = Omit<Parameters<typeof getEnvironmentsPage>[0], "projectId"> & {
  page: number;
};

export function useEnvironmentsPageQuery(
  projectId: string | undefined,
  params: EnvironmentsPageQueryParams,
  enabled = true,
) {
  return useQuery({
    queryKey: projectId
      ? queryKeys.environments.byProject(projectId, params)
      : queryKeys.environments.byProject("unknown", params),
    queryFn: () => getEnvironmentsPage({ projectId: projectId ?? "", ...params }),
    enabled: Boolean(projectId) && enabled,
  });
}

export function useEnvironmentUseCasesQuery(
  projectId: string | undefined,
  includeArchived = false,
  enabled = true,
) {
  return useQuery({
    queryKey: projectId
      ? queryKeys.environments.useCaseValues(projectId, { includeArchived })
      : queryKeys.environments.useCaseValues("unknown", { includeArchived }),
    queryFn: () => getEnvironmentUseCases(projectId ?? "", includeArchived),
    enabled: Boolean(projectId) && enabled,
    select: (data) => data.items,
  });
}

export function useEnvironmentQuery(environmentId: string | undefined) {
  return useQuery({
    queryKey: environmentId
      ? queryKeys.environments.detail(environmentId)
      : queryKeys.environments.detail("unknown"),
    queryFn: () => getEnvironment(environmentId ?? ""),
    enabled: Boolean(environmentId),
  });
}

export function useEnvironmentRevisionsPageQuery(
  environmentId: string | undefined,
  params: { page?: number; pageSize?: number } = {},
  enabled = true,
) {
  return useQuery({
    queryKey: environmentId
      ? queryKeys.environments.revisions(environmentId, params)
      : queryKeys.environments.revisions("unknown", params),
    queryFn: () => getEnvironmentRevisionsPage({ environmentId: environmentId ?? "", ...params }),
    enabled: Boolean(environmentId) && enabled,
  });
}

export function useCreateTestDatasetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTestDataset,
    onSuccess: async (dataset) => {
      await invalidateGroups(queryClient, [
        queryKeys.datasets.detail(dataset.id),
        queryKeys.datasets.projectScope(dataset.project_id),
      ]);
    },
  });
}

export function usePatchTestDatasetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ datasetId, payload }: { datasetId: string; payload: Parameters<typeof patchTestDataset>[1] }) =>
      patchTestDataset(datasetId, payload),
    onSuccess: async (dataset) => {
      await invalidateGroups(queryClient, [
        queryKeys.datasets.detail(dataset.id),
        queryKeys.datasets.projectScope(dataset.project_id),
      ]);
    },
  });
}

export function useDeleteTestDatasetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ datasetId, projectId }: { datasetId: string; projectId: string }) =>
      deleteTestDataset(datasetId).then(() => ({ datasetId, projectId })),
    onSuccess: async (_, { datasetId, projectId }) => {
      await invalidateGroups(queryClient, [
        queryKeys.datasets.detail(datasetId),
        queryKeys.datasets.projectScope(projectId),
      ]);
    },
  });
}

export function useBulkOperateTestDatasetsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkOperateTestDatasets,
    onSuccess: async (_, variables) => {
      await invalidateGroups(queryClient, [queryKeys.datasets.projectScope(variables.project_id)]);
      for (const datasetId of variables.dataset_ids) {
        queryClient.removeQueries({ queryKey: queryKeys.datasets.detail(datasetId) });
      }
    },
  });
}

export function useCreateEnvironmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEnvironment,
    onSuccess: async (environment) => {
      await invalidateGroups(queryClient, [
        queryKeys.environments.detail(environment.id),
        queryKeys.environments.projectScope(environment.project_id),
      ]);
    },
  });
}

export function usePatchEnvironmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      environmentId,
      payload,
    }: {
      environmentId: string;
      payload: Parameters<typeof patchEnvironment>[1];
    }) => patchEnvironment(environmentId, payload),
    onSuccess: async (environment) => {
      await invalidateGroups(queryClient, [
        queryKeys.environments.detail(environment.id),
        queryKeys.environments.projectScope(environment.project_id),
      ]);
    },
  });
}

export function useDeleteEnvironmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      environmentId,
      projectId,
    }: {
      environmentId: string;
      projectId: string;
    }) => deleteEnvironment(environmentId).then(() => ({ environmentId, projectId })),
    onSuccess: async (_, { environmentId, projectId }) => {
      await invalidateGroups(queryClient, [
        queryKeys.environments.detail(environmentId),
        queryKeys.environments.projectScope(projectId),
      ]);
    },
  });
}

export function useBulkArchiveEnvironmentsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      environmentIds,
      projectId,
    }: {
      environmentIds: string[];
      projectId: string;
    }) => {
      const results = await Promise.allSettled(
        environmentIds.map(async (environmentId) => {
          await deleteEnvironment(environmentId);
          return environmentId;
        }),
      );

      const succeededIds: string[] = [];
      const failed: Array<{ environmentId: string; reason: unknown }> = [];
      results.forEach((result, index) => {
        const environmentId = environmentIds[index];
        if (result.status === "fulfilled") {
          succeededIds.push(environmentId);
          return;
        }
        failed.push({ environmentId, reason: result.reason });
      });

      return {
        projectId,
        environmentIds,
        succeededIds,
        failed,
      };
    },
    onSuccess: async (result) => {
      if (result.succeededIds.length === 0) return;
      await invalidateGroups(queryClient, [queryKeys.environments.projectScope(result.projectId)]);
      for (const environmentId of result.succeededIds) {
        queryClient.removeQueries({ queryKey: queryKeys.environments.detail(environmentId) });
      }
    },
  });
}

export function useBindDatasetToTestCaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      testCaseId,
      projectId,
      payload,
    }: {
      testCaseId: string;
      projectId: string;
      payload: Parameters<typeof bindDatasetToTestCase>[1];
    }) => bindDatasetToTestCase(testCaseId, payload).then((result) => ({ ...result, projectId })),
    onSuccess: async (_, variables) => {
      await invalidateGroups(queryClient, [
        queryKeys.datasets.projectScope(variables.projectId),
        queryKeys.datasets.byTestCase(variables.projectId, variables.testCaseId),
        queryKeys.datasets.bindingsByTestCase(variables.testCaseId),
        queryKeys.testCases.detail(variables.testCaseId),
        queryKeys.testCases.detailFull(variables.projectId, variables.testCaseId),
        queryKeys.testCases.byProject(variables.projectId),
      ]);
    },
  });
}

export function useUnbindDatasetFromTestCaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      testCaseId,
      bindingId,
      projectId,
    }: {
      testCaseId: string;
      bindingId: string;
      projectId: string;
    }) => unbindDatasetFromTestCase(testCaseId, bindingId).then(() => ({ testCaseId, bindingId, projectId })),
    onSuccess: async (_, variables) => {
      await invalidateGroups(queryClient, [
        queryKeys.datasets.projectScope(variables.projectId),
        queryKeys.datasets.byTestCase(variables.projectId, variables.testCaseId),
        queryKeys.datasets.bindingsByTestCase(variables.testCaseId),
        queryKeys.testCases.detail(variables.testCaseId),
        queryKeys.testCases.detailFull(variables.projectId, variables.testCaseId),
        queryKeys.testCases.byProject(variables.projectId),
      ]);
    },
  });
}
