import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changePassword,
  createMyApiKey,
  createProjectNotificationSettings,
  createSmtpSettings,
  createUser,
  deleteMyApiKey,
  deleteProjectAiSettings,
  deleteUser,
  getMyApiKeys,
  getProjectNotificationSettings,
  getAiSettingsOverview,
  getGlobalAiSettings,
  getProjectAiSettings,
  getSmtpEnabled,
  getSmtpSettings,
  getUsersPage,
  patchMyApiKey,
  patchUser,
  regenerateMyApiKey,
  setUserPassword,
  testProjectNotificationSettings,
  testSmtpSettings,
  updateProjectNotificationSettings,
  updateProjectAiSettings,
  updateGlobalAiSettings,
  updateSmtpSettings,
  type ApiSortDirection,
  type NotificationChannel,
  type NotificationRuleType,
  type UsersSortBy,
} from "../tms";
import { queryKeys } from "../query-keys";
import { invalidateGroups } from "./shared";

const USERS_SEARCH_PAGE_SIZE = 50;

export function useUsersQuery(
  enabled = true,
  params?: { sortBy?: UsersSortBy; sortDirection?: ApiSortDirection },
) {
  const sortBy = params?.sortBy ?? "created_at";
  const sortDirection = params?.sortDirection ?? "desc";
  return useQuery({
    queryKey: queryKeys.users.list(sortBy, sortDirection),
    queryFn: () =>
      getUsersPage({
        page: 1,
        pageSize: 100,
        sortBy,
        sortOrder: sortDirection,
      }).then((page) => page.items),
    enabled,
  });
}

export function useUsersSearchQuery(
  searchQuery: string,
  params?: { sortBy?: UsersSortBy; sortDirection?: ApiSortDirection; enabled?: boolean },
) {
  const sortBy = params?.sortBy ?? "username";
  const sortDirection = params?.sortDirection ?? "asc";
  const enabled = params?.enabled ?? true;
  return useInfiniteQuery({
    queryKey: queryKeys.users.search(searchQuery, { sortBy, sortDirection }),
    queryFn: ({ pageParam }) =>
      getUsersPage({
        search: searchQuery.trim() || undefined,
        page: pageParam ?? 1,
        pageSize: USERS_SEARCH_PAGE_SIZE,
        sortBy,
        sortOrder: sortDirection,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.has_next ? lastPage.page + 1 : undefined),
    enabled,
  });
}

export function useSmtpSettingsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.settings.smtp,
    queryFn: getSmtpSettings,
    enabled,
    retry: false,
  });
}

export function useSmtpEnabledQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.settings.smtpEnabled,
    queryFn: getSmtpEnabled,
    enabled,
    retry: false,
  });
}

export function useProjectNotificationSettingsQuery(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: projectId
      ? queryKeys.settings.notifications(projectId)
      : queryKeys.settings.notifications("unknown"),
    queryFn: () => getProjectNotificationSettings(projectId ?? ""),
    enabled: enabled && Boolean(projectId),
    retry: false,
  });
}

export function useAiSettingsOverviewQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.settings.aiOverview,
    queryFn: () => getAiSettingsOverview(),
    enabled,
    retry: false,
  });
}

export function useProjectAiSettingsQuery(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: projectId ? queryKeys.settings.ai(projectId) : queryKeys.settings.ai("unknown"),
    queryFn: () => getProjectAiSettings(projectId ?? ""),
    enabled: enabled && Boolean(projectId),
    retry: false,
  });
}

export function useMyApiKeyQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.apiKeys.me,
    queryFn: () => getMyApiKeys().then((result) => result.items),
    enabled,
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      await invalidateGroups(queryClient, [queryKeys.users.all]);
    },
  });
}

export function usePatchUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: Parameters<typeof patchUser>[1] }) =>
      patchUser(userId, payload),
    onSuccess: async (_, variables) => {
      await invalidateGroups(queryClient, [queryKeys.users.all, queryKeys.users.detail(variables.userId)]);
    },
  });
}

export function useSetUserPasswordMutation() {
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: Parameters<typeof setUserPassword>[1] }) =>
      setUserPassword(userId, payload),
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUser,
    onSuccess: async () => {
      await invalidateGroups(queryClient, [queryKeys.users.all]);
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: changePassword,
  });
}

export function useCreateSmtpSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSmtpSettings,
    onSuccess: async () => {
      await invalidateGroups(queryClient, [queryKeys.settings.smtp]);
    },
  });
}

export function useUpdateSmtpSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSmtpSettings,
    onSuccess: async () => {
      await invalidateGroups(queryClient, [queryKeys.settings.smtp]);
    },
  });
}

export function useTestSmtpSettingsMutation() {
  return useMutation({
    mutationFn: testSmtpSettings,
  });
}

export function useCreateProjectNotificationSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProjectNotificationSettings,
    onSuccess: async (data) => {
      await invalidateGroups(queryClient, [queryKeys.settings.notifications(data.project_id)]);
    },
  });
}

export function useUpdateProjectNotificationSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProjectNotificationSettings,
    onSuccess: async (data) => {
      await invalidateGroups(queryClient, [queryKeys.settings.notifications(data.project_id)]);
    },
  });
}

export function useGlobalAiSettingsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.settings.aiGlobal,
    queryFn: () => getGlobalAiSettings(),
    enabled,
    retry: false,
  });
}

export function useUpdateGlobalAiSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateGlobalAiSettings,
    onSuccess: async () => {
      await invalidateGroups(queryClient, [
        queryKeys.settings.aiGlobal,
        queryKeys.settings.aiOverview,
      ]);
    },
  });
}

export function useDeleteProjectAiSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => deleteProjectAiSettings(projectId),
    onSuccess: async (_data, projectId) => {
      await invalidateGroups(queryClient, [
        queryKeys.settings.aiOverview,
        queryKeys.settings.ai(projectId),
        queryKeys.ai.testCaseStatus(projectId),
      ]);
    },
  });
}

export function useUpdateProjectAiSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProjectAiSettings,
    onSuccess: async (data) => {
      await invalidateGroups(queryClient, [
        queryKeys.settings.aiOverview,
        queryKeys.settings.ai(data.project_id),
        queryKeys.ai.testCaseStatus(data.project_id),
      ]);
    },
  });
}

export function useTestProjectNotificationSettingsMutation() {
  return useMutation({
    mutationFn: (variables: {
      project_id: string;
      rule: NotificationRuleType;
      channel: NotificationChannel;
      recipient_email?: string | null;
    }) => testProjectNotificationSettings(variables),
  });
}

export function useCreateApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMyApiKey,
    onSuccess: async () => {
      await invalidateGroups(queryClient, [queryKeys.apiKeys.all, queryKeys.apiKeys.me]);
    },
  });
}

export function usePatchApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ apiKeyId, payload }: { apiKeyId: string; payload: Parameters<typeof patchMyApiKey>[1] }) =>
      patchMyApiKey(apiKeyId, payload),
    onSuccess: async () => {
      await invalidateGroups(queryClient, [queryKeys.apiKeys.all, queryKeys.apiKeys.me]);
    },
  });
}

export function useRegenerateApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (apiKeyId: string) => regenerateMyApiKey(apiKeyId),
    onSuccess: async () => {
      await invalidateGroups(queryClient, [queryKeys.apiKeys.all, queryKeys.apiKeys.me]);
    },
  });
}

export function useDeleteApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMyApiKey,
    onSuccess: async () => {
      await invalidateGroups(queryClient, [queryKeys.apiKeys.all, queryKeys.apiKeys.me]);
    },
  });
}
