import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createComponent,
  createProduct,
  deleteComponent,
  deleteProduct,
  getAllComponents,
  getAllProducts,
  getComponent,
  getComponentDependencies,
  getComponentGraph,
  getComponentsPage,
  getProduct,
  getProductComponents,
  getProductsPage,
  getProductSummary,
  patchComponent,
  patchProduct,
  replaceComponentDependencies,
  replaceProductComponents,
} from "../tms";
import { queryKeys } from "../query-keys";
import { invalidateGroups } from "./shared";

export function useProductsPageQuery(
  projectId: string | undefined,
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
    statuses?: ("active" | "archived")[];
    tags?: string[];
  },
) {
  return useQuery({
    queryKey: projectId
      ? queryKeys.products.byProject(projectId, params)
      : queryKeys.products.byProject("unknown", params),
    queryFn: () => getProductsPage({ projectId: projectId ?? "", ...params }),
    enabled: Boolean(projectId),
  });
}

export function useAllProductsQuery(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: projectId
      ? queryKeys.products.allForProject(projectId)
      : queryKeys.products.allForProject("unknown"),
    queryFn: () => getAllProducts({ projectId: projectId ?? "" }),
    enabled: Boolean(projectId) && enabled,
    staleTime: 30_000,
  });
}

export function useProductQuery(productId: string | undefined) {
  return useQuery({
    queryKey: productId ? queryKeys.products.detail(productId) : queryKeys.products.detail("unknown"),
    queryFn: () => getProduct(productId ?? ""),
    enabled: Boolean(productId),
  });
}

export function useProductSummaryQuery(productId: string | undefined) {
  return useQuery({
    queryKey: productId ? queryKeys.products.summary(productId) : queryKeys.products.summary("unknown"),
    queryFn: () => getProductSummary(productId ?? ""),
    enabled: Boolean(productId),
  });
}

export function useComponentsPageQuery(
  projectId: string | undefined,
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
    statuses?: ("active" | "archived")[];
    riskLevels?: ("low" | "medium" | "high" | "critical")[];
    productIds?: string[];
    tags?: string[];
  },
) {
  return useQuery({
    queryKey: projectId
      ? queryKeys.components.byProject(projectId, params)
      : queryKeys.components.byProject("unknown", params),
    queryFn: () => getComponentsPage({ projectId: projectId ?? "", ...params }),
    enabled: Boolean(projectId),
  });
}

export function useAllComponentsQuery(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: projectId
      ? queryKeys.components.allForProject(projectId)
      : queryKeys.components.allForProject("unknown"),
    queryFn: () => getAllComponents({ projectId: projectId ?? "" }),
    enabled: Boolean(projectId) && enabled,
    staleTime: 30_000,
  });
}

export function useComponentQuery(componentId: string | undefined) {
  return useQuery({
    queryKey: componentId ? queryKeys.components.detail(componentId) : queryKeys.components.detail("unknown"),
    queryFn: () => getComponent(componentId ?? ""),
    enabled: Boolean(componentId),
  });
}

export function useProductComponentsQuery(productId: string | undefined) {
  return useQuery({
    queryKey: productId ? queryKeys.products.components(productId) : queryKeys.products.components("unknown"),
    queryFn: () => getProductComponents(productId ?? ""),
    enabled: Boolean(productId),
  });
}

export function useComponentGraphQuery(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: projectId ? queryKeys.components.graph(projectId) : queryKeys.components.graph("unknown"),
    queryFn: () => getComponentGraph(projectId ?? ""),
    enabled: Boolean(projectId) && enabled,
    staleTime: 30_000,
  });
}

export function useComponentDependenciesQuery(componentId: string | undefined) {
  return useQuery({
    queryKey: componentId
      ? queryKeys.components.dependencies(componentId)
      : queryKeys.components.dependencies("unknown"),
    queryFn: () => getComponentDependencies(componentId ?? ""),
    enabled: Boolean(componentId),
  });
}

export function useCreateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProduct,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.products.projectScope(result.project_id) });
    },
  });
}

export function usePatchProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, payload }: { productId: string; payload: Parameters<typeof patchProduct>[1] }) =>
      patchProduct(productId, payload),
    onSuccess: async (result) => {
      await invalidateGroups(queryClient, [
        queryKeys.products.detail(result.id),
        queryKeys.products.projectScope(result.project_id),
        queryKeys.products.summary(result.id),
      ]);
    },
  });
}

export function useDeleteProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId }: { productId: string; projectId?: string }) => deleteProduct(productId),
    onSuccess: async (_result, variables) => {
      if (variables.projectId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.products.projectScope(variables.projectId) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.components.projectScope(variables.projectId) });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
}

export function useCreateComponentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createComponent,
    onSuccess: async (result) => {
      await invalidateGroups(queryClient, [
        queryKeys.components.projectScope(result.project_id),
        queryKeys.components.allForProject(result.project_id),
      ]);
    },
  });
}

export function usePatchComponentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ componentId, payload }: { componentId: string; payload: Parameters<typeof patchComponent>[1] }) =>
      patchComponent(componentId, payload),
    onSuccess: async (result) => {
      await invalidateGroups(queryClient, [
        queryKeys.components.detail(result.id),
        queryKeys.components.projectScope(result.project_id),
        queryKeys.components.allForProject(result.project_id),
      ]);
    },
  });
}

export function useDeleteComponentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ componentId }: { componentId: string; projectId?: string }) => deleteComponent(componentId),
    onSuccess: async (_result, variables) => {
      if (variables.projectId) {
        await invalidateGroups(queryClient, [
          queryKeys.components.projectScope(variables.projectId),
          queryKeys.components.allForProject(variables.projectId),
          queryKeys.products.projectScope(variables.projectId),
        ]);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.components.all });
    },
  });
}

export function useReplaceProductComponentsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      links,
    }: {
      productId: string;
      links: Array<{ component_id: string; is_core?: boolean; sort_order?: number }>;
    }) => replaceProductComponents(productId, links),
    onSuccess: async (_result, variables) => {
      await invalidateGroups(queryClient, [
        queryKeys.products.components(variables.productId),
        queryKeys.products.summary(variables.productId),
      ]);
    },
  });
}

export function useReplaceComponentDependenciesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      componentId,
      dependencies,
    }: {
      componentId: string;
      dependencies: Array<{ target_component_id: string; dependency_type?: "depends_on" }>;
    }) => replaceComponentDependencies(componentId, dependencies),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.components.dependencies(variables.componentId) });
    },
  });
}
