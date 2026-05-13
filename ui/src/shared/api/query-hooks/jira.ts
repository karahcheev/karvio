import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  connectJiraViaApiToken,
  createJiraIssueFromRunCase,
  createJiraIssueFromRunCases,
  createJiraMapping,
  deleteJiraConnection,
  deleteJiraMapping,
  getJiraConnections,
  getJiraMappings,
  getJiraSystemSettings,
  linkJiraIssue,
  linkJiraIssueToRunCases,
  listExternalIssueLinks,
  patchJiraConnection,
  patchJiraMapping,
  refreshJiraSync,
  unlinkJiraIssue,
  upsertJiraSystemSettings,
} from "../tms";
import { queryKeys } from "../query-keys";
import { invalidateGroups } from "./shared";

export function useJiraConnectionsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.settings.jiraConnections,
    queryFn: () => getJiraConnections(),
    enabled,
  });
}

export function useJiraSystemSettingsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.settings.jiraSystem,
    queryFn: () => getJiraSystemSettings(),
    enabled,
    retry: false,
  });
}

export function useJiraMappingsQuery(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: projectId ? queryKeys.settings.jiraMappings(projectId) : queryKeys.settings.jiraMappingsAll,
    queryFn: () => getJiraMappings(projectId),
    enabled,
  });
}

export function useExternalIssueLinksQuery(
  ownerType: "run_case" | "test_case" | "test_run",
  ownerId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ownerId
      ? queryKeys.externalIssues.owner(ownerType, ownerId)
      : queryKeys.externalIssues.owner(ownerType, "unknown"),
    queryFn: () => listExternalIssueLinks({ ownerType, ownerId: ownerId ?? "" }),
    enabled: enabled && Boolean(ownerId),
  });
}

export function useConnectJiraViaApiTokenMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => connectJiraViaApiToken(),
    onSuccess: async () => {
      await invalidateGroups(queryClient, [queryKeys.settings.jiraConnections]);
    },
  });
}

export function useUpsertJiraSystemSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: upsertJiraSystemSettings,
    onSuccess: async () => {
      await invalidateGroups(queryClient, [queryKeys.settings.jiraSystem, queryKeys.settings.jiraConnections]);
    },
  });
}

export function useDeleteJiraConnectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) => deleteJiraConnection(connectionId),
    onSuccess: async () => {
      await invalidateGroups(queryClient, [queryKeys.settings.jiraConnections]);
    },
  });
}

export function usePatchJiraConnectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      connectionId,
      payload,
    }: {
      connectionId: string;
      payload: Parameters<typeof patchJiraConnection>[1];
    }) => patchJiraConnection(connectionId, payload),
    onSuccess: async () => {
      await invalidateGroups(queryClient, [queryKeys.settings.jiraConnections]);
    },
  });
}

export function useCreateJiraMappingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createJiraMapping,
    onSuccess: async (mapping) => {
      await invalidateGroups(queryClient, [queryKeys.settings.jiraMappingsAll, queryKeys.settings.jiraMappings(mapping.project_id)]);
    },
  });
}

export function usePatchJiraMappingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mappingId, payload }: { mappingId: string; payload: Parameters<typeof patchJiraMapping>[1] }) =>
      patchJiraMapping(mappingId, payload),
    onSuccess: async (mapping) => {
      await invalidateGroups(queryClient, [queryKeys.settings.jiraMappingsAll, queryKeys.settings.jiraMappings(mapping.project_id)]);
    },
  });
}

export function useDeleteJiraMappingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mappingId }: { mappingId: string; projectId: string }) => deleteJiraMapping(mappingId),
    onSuccess: async (_, variables) => {
      await invalidateGroups(queryClient, [queryKeys.settings.jiraMappingsAll, queryKeys.settings.jiraMappings(variables.projectId)]);
    },
  });
}

export function useLinkJiraIssueMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: linkJiraIssue,
    onSuccess: async (link) => {
      const keys: readonly (readonly unknown[])[] = [
        queryKeys.externalIssues.owner(link.owner_type, link.owner_id),
        ...(link.owner_type === "run_case" ? [queryKeys.testRuns.runCase(link.owner_id)] : []),
        ...(link.owner_type === "test_case"
          ? [queryKeys.testCases.detail(link.owner_id), queryKeys.testCases.detailFull(link.project_id, link.owner_id)]
          : []),
      ];
      await invalidateGroups(queryClient, keys);
      if (link.owner_type === "run_case") {
        await queryClient.invalidateQueries({ queryKey: queryKeys.testRuns.all });
      }
    },
  });
}

export function useCreateJiraIssueFromRunCaseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createJiraIssueFromRunCase,
    onSuccess: async (link) => {
      await invalidateGroups(queryClient, [
        queryKeys.externalIssues.owner(link.owner_type, link.owner_id),
        queryKeys.testRuns.runCase(link.owner_id),
      ]);
      await queryClient.invalidateQueries({ queryKey: queryKeys.testRuns.all });
    },
  });
}

export function useCreateJiraIssueFromRunCasesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createJiraIssueFromRunCases,
    onSuccess: async (result) => {
      const keys: (readonly unknown[])[] = [];
      for (const link of result.items) {
        keys.push(
          queryKeys.externalIssues.owner(link.owner_type, link.owner_id),
          queryKeys.testRuns.runCase(link.owner_id),
        );
      }
      await invalidateGroups(queryClient, keys);
      await queryClient.invalidateQueries({ queryKey: queryKeys.testRuns.all });
    },
  });
}

export function useLinkJiraIssueToRunCasesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: linkJiraIssueToRunCases,
    onSuccess: async (result) => {
      const keys: (readonly unknown[])[] = [];
      for (const link of result.items) {
        keys.push(
          queryKeys.externalIssues.owner(link.owner_type, link.owner_id),
          queryKeys.testRuns.runCase(link.owner_id),
        );
      }
      await invalidateGroups(queryClient, keys);
      await queryClient.invalidateQueries({ queryKey: queryKeys.testRuns.all });
    },
  });
}

export function useUnlinkJiraIssueMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      linkId,
    }: {
      linkId: string;
      ownerType: "run_case" | "test_case" | "test_run";
      ownerId: string;
      projectId?: string;
    }) => unlinkJiraIssue(linkId),
    onSuccess: async (_, variables) => {
      const keys: readonly (readonly unknown[])[] = [
        queryKeys.externalIssues.owner(variables.ownerType, variables.ownerId),
        ...(variables.ownerType === "run_case" ? [queryKeys.testRuns.runCase(variables.ownerId)] : []),
        ...(variables.ownerType === "test_case"
          ? [
              queryKeys.testCases.detail(variables.ownerId),
              ...(variables.projectId
                ? [queryKeys.testCases.detailFull(variables.projectId, variables.ownerId)]
                : []),
            ]
          : []),
      ];
      await invalidateGroups(queryClient, keys);
      if (variables.ownerType === "run_case" && variables.projectId) {
        await queryClient.invalidateQueries({
          queryKey: ["projects", variables.projectId, "test-cases"],
        });
      }
      if (variables.ownerType === "run_case") {
        await queryClient.invalidateQueries({ queryKey: queryKeys.testRuns.all });
      }
    },
  });
}

export function useRefreshJiraSyncMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId?: string) => refreshJiraSync(projectId),
    onSuccess: async (_, projectId) => {
      const keys: readonly (readonly unknown[])[] = projectId
        ? [queryKeys.settings.jiraConnections, queryKeys.settings.jiraMappings(projectId)]
        : [queryKeys.settings.jiraConnections];
      await invalidateGroups(queryClient, keys);
    },
  });
}
