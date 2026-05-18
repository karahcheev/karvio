import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProject,
  deleteProject,
  getAuditLogs,
  getProjectMembers,
  getProjectOverview,
  getProjects,
  getVersion,
  type ApiSortDirection,
  type AuditLogsSortBy,
  type GetAuditLogsParams,
  type ProjectsSortBy,
} from "../tms";
import { queryKeys } from "../query-keys";
import { invalidateGroups } from "./shared";

export function useProjectsQuery(params?: { sortBy?: ProjectsSortBy; sortDirection?: ApiSortDirection }) {
  const sortBy = params?.sortBy ?? "created_at";
  const sortDirection = params?.sortDirection ?? "desc";
  return useQuery({
    queryKey: queryKeys.projects.list(sortBy, sortDirection),
    queryFn: () => getProjects({ sortBy, sortDirection }),
  });
}

export function useProjectMembersQuery(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: projectId ? queryKeys.projects.members(projectId) : queryKeys.projects.members("unknown"),
    queryFn: () => getProjectMembers(projectId ?? ""),
    enabled: Boolean(projectId) && enabled,
  });
}

export function useVersionQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.version.current,
    queryFn: getVersion,
    enabled,
  });
}

export function useProjectOverviewQuery(
  projectId: string | undefined,
  filters?: Parameters<typeof getProjectOverview>[1],
) {
  return useQuery({
    queryKey: projectId
      ? queryKeys.projects.overview(projectId, filters)
      : queryKeys.projects.overview("unknown", filters),
    queryFn: () => getProjectOverview(projectId ?? "", filters),
    enabled: Boolean(projectId),
  });
}

export function useAuditLogsQuery(enabled = true, params?: GetAuditLogsParams & { sortBy?: AuditLogsSortBy }) {
  const normalizedParams = {
    ...params,
    sort_by: params?.sortBy ?? params?.sort_by,
  } satisfies GetAuditLogsParams;

  return useQuery({
    queryKey: queryKeys.auditLogs.list(normalizedParams),
    queryFn: () => getAuditLogs(normalizedParams),
    enabled,
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,
    onSuccess: async () => {
      await invalidateGroups(queryClient, [queryKeys.projects.all]);
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProject,
    onSuccess: async () => {
      await invalidateGroups(queryClient, [queryKeys.projects.all]);
    },
  });
}
