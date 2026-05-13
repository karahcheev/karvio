import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMilestone,
  createRunFromTestPlan,
  createTestPlan,
  deleteMilestone,
  deleteTestPlan,
  getMilestone,
  getMilestoneSummary,
  getMilestonesPage,
  getTestPlan,
  getTestPlanTags,
  getTestPlansPage,
  patchMilestone,
  patchTestPlan,
  previewGeneratedPlan,
} from "../tms";
import { queryKeys } from "../query-keys";
import { invalidateGroups } from "./shared";

export type TestPlansPageQueryParams = Omit<Parameters<typeof getTestPlansPage>[0], "projectId"> & { page: number };

export function useTestPlansPageQuery(projectId: string | undefined, params: TestPlansPageQueryParams) {
  return useQuery({
    queryKey: projectId
      ? queryKeys.testPlans.byProject(projectId, params)
      : queryKeys.testPlans.byProject("unknown", params),
    queryFn: () => getTestPlansPage({ projectId: projectId ?? "", ...params }),
    enabled: Boolean(projectId),
  });
}

export function useTestPlanTagsQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? queryKeys.testPlans.tagValues(projectId) : queryKeys.testPlans.tagValues("unknown"),
    queryFn: () => getTestPlanTags(projectId ?? ""),
    enabled: Boolean(projectId),
    select: (data) => data.items,
  });
}

export function useTestPlanQuery(testPlanId: string | undefined) {
  return useQuery({
    queryKey: testPlanId ? queryKeys.testPlans.detail(testPlanId) : queryKeys.testPlans.detail("unknown"),
    queryFn: () => getTestPlan(testPlanId ?? ""),
    enabled: Boolean(testPlanId),
  });
}

export type MilestonesPageQueryParams = Omit<Parameters<typeof getMilestonesPage>[0], "projectId"> & { page: number };

export function useMilestonesPageQuery(
  projectId: string | undefined,
  params: MilestonesPageQueryParams,
  enabled = true,
) {
  return useQuery({
    queryKey: projectId
      ? queryKeys.milestones.byProject(projectId, params)
      : queryKeys.milestones.byProject("unknown", params),
    queryFn: () => getMilestonesPage({ projectId: projectId ?? "", ...params }),
    enabled: Boolean(projectId) && enabled,
  });
}

export function useMilestoneQuery(milestoneId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: milestoneId ? queryKeys.milestones.detail(milestoneId) : queryKeys.milestones.detail("unknown"),
    queryFn: () => getMilestone(milestoneId ?? ""),
    enabled: Boolean(milestoneId) && enabled,
  });
}

export function useMilestoneSummaryQuery(milestoneId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: milestoneId ? queryKeys.milestones.summary(milestoneId) : queryKeys.milestones.summary("unknown"),
    queryFn: () => getMilestoneSummary(milestoneId ?? ""),
    enabled: Boolean(milestoneId) && enabled,
  });
}

export function useCreateTestPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTestPlan,
    onSuccess: async (_, variables) => {
      await invalidateGroups(queryClient, [
        queryKeys.testPlans.projectScope(variables.project_id),
        queryKeys.milestones.projectScope(variables.project_id),
      ]);
      if (variables.milestone_id) {
        await invalidateGroups(queryClient, [queryKeys.milestones.summary(variables.milestone_id)]);
      }
    },
  });
}

export function useCreateMilestoneMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMilestone,
    onSuccess: async (milestone) => {
      await invalidateGroups(queryClient, [
        queryKeys.milestones.projectScope(milestone.project_id),
        queryKeys.milestones.detail(milestone.id),
      ]);
    },
  });
}

export function usePatchMilestoneMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ milestoneId, payload }: { milestoneId: string; payload: Parameters<typeof patchMilestone>[1] }) =>
      patchMilestone(milestoneId, payload),
    onSuccess: async (milestone) => {
      await invalidateGroups(queryClient, [
        queryKeys.milestones.projectScope(milestone.project_id),
        queryKeys.milestones.detail(milestone.id),
        queryKeys.milestones.summary(milestone.id),
        queryKeys.testPlans.projectScope(milestone.project_id),
        queryKeys.testRuns.projectScope(milestone.project_id),
      ]);
    },
  });
}

export function useDeleteMilestoneMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ milestoneId, projectId }: { milestoneId: string; projectId: string }) =>
      deleteMilestone(milestoneId).then(() => ({ milestoneId, projectId })),
    onSuccess: async (_, { milestoneId, projectId }) => {
      await invalidateGroups(queryClient, [
        queryKeys.milestones.projectScope(projectId),
        queryKeys.milestones.detail(milestoneId),
        queryKeys.milestones.summary(milestoneId),
        queryKeys.testPlans.projectScope(projectId),
        queryKeys.testRuns.projectScope(projectId),
      ]);
    },
  });
}

export function usePatchTestPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, payload }: { planId: string; payload: Parameters<typeof patchTestPlan>[1] }) =>
      patchTestPlan(planId, payload),
    onSuccess: async (data) => {
      await invalidateGroups(queryClient, [
        queryKeys.testPlans.detail(data.id),
        queryKeys.testPlans.projectScope(data.project_id),
        queryKeys.milestones.projectScope(data.project_id),
      ]);
      if (data.milestone_id) {
        await invalidateGroups(queryClient, [queryKeys.milestones.summary(data.milestone_id)]);
      }
    },
  });
}

export function useDeleteTestPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, projectId }: { planId: string; projectId: string }) =>
      deleteTestPlan(planId).then(() => ({ planId, projectId })),
    onSuccess: async (_, { planId, projectId }) => {
      await invalidateGroups(queryClient, [
        queryKeys.testPlans.detail(planId),
        queryKeys.testPlans.projectScope(projectId),
        queryKeys.milestones.projectScope(projectId),
      ]);
      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "milestones" && query.queryKey[2] === "summary",
      });
    },
  });
}

export function useCreateRunFromTestPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, payload }: { planId: string; payload: Parameters<typeof createRunFromTestPlan>[1] }) =>
      createRunFromTestPlan(planId, payload),
    onSuccess: async (run) => {
      await invalidateGroups(queryClient, [
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

export function useGeneratedPlanPreviewMutation() {
  return useMutation({
    mutationFn: previewGeneratedPlan,
  });
}
