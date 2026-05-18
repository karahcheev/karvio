import { apiRequest } from "@/shared/api/client";
import type {
  ComponentDependencyDto,
  ComponentDto,
  ComponentGraphDto,
  ComponentRiskLevel,
  PlanGenerationConfigDto,
  PlanGenerationPreviewDto,
  ProductComponentLinkDto,
  ProductDto,
  ProductStatus,
  ProductSummaryDto,
} from "./types";

export async function getProductsPage(params: {
  projectId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  statuses?: ProductStatus[];
  tags?: string[];
}): Promise<{ items: ProductDto[]; page: number; page_size: number; has_next: boolean; total?: number }> {
  const query = new URLSearchParams({
    project_id: params.projectId,
    page: String(params.page ?? 1),
    page_size: String(params.pageSize ?? 25),
  });
  params.statuses?.forEach((item) => query.append("status", item));
  params.tags?.forEach((item) => query.append("tag", item));
  if (params.search?.trim()) query.set("search", params.search.trim());
  return apiRequest(`/products?${query.toString()}`);
}

export async function getAllProducts(params: {
  projectId: string;
  statuses?: ProductStatus[];
  tags?: string[];
}): Promise<ProductDto[]> {
  const pageSize = 200;
  const items: ProductDto[] = [];
  let page = 1;

  for (let i = 0; i < 100; i += 1) {
    const response = await getProductsPage({
      projectId: params.projectId,
      page,
      pageSize,
      statuses: params.statuses,
      tags: params.tags,
    });
    items.push(...response.items);
    if (!response.has_next) {
      return items;
    }
    page += 1;
  }

  return items;
}

export async function getProduct(productId: string): Promise<ProductDto> {
  return apiRequest(`/products/${productId}`);
}

export async function createProduct(payload: {
  project_id: string;
  name: string;
  key?: string | null;
  description?: string | null;
  owner_id?: string | null;
  status?: ProductStatus;
  tags?: string[];
}): Promise<ProductDto> {
  return apiRequest("/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchProduct(productId: string, payload: Partial<ProductDto>): Promise<ProductDto> {
  return apiRequest(`/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteProduct(productId: string): Promise<void> {
  await apiRequest(`/products/${productId}`, { method: "DELETE" });
}

export async function getComponentsPage(params: {
  projectId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  statuses?: ProductStatus[];
  riskLevels?: ComponentRiskLevel[];
  productIds?: string[];
  tags?: string[];
}): Promise<{ items: ComponentDto[]; page: number; page_size: number; has_next: boolean; total?: number }> {
  const query = new URLSearchParams({
    project_id: params.projectId,
    page: String(params.page ?? 1),
    page_size: String(params.pageSize ?? 25),
  });
  params.statuses?.forEach((item) => query.append("status", item));
  params.riskLevels?.forEach((item) => query.append("risk_level", item));
  params.productIds?.forEach((item) => query.append("product_id", item));
  params.tags?.forEach((item) => query.append("tag", item));
  if (params.search?.trim()) query.set("search", params.search.trim());
  return apiRequest(`/components?${query.toString()}`);
}

export async function getAllComponents(params: {
  projectId: string;
  statuses?: ProductStatus[];
  riskLevels?: ComponentRiskLevel[];
  tags?: string[];
}): Promise<ComponentDto[]> {
  const pageSize = 200;
  const items: ComponentDto[] = [];
  let page = 1;

  // Keep a hard cap to avoid runaway loops on malformed pagination responses.
  for (let i = 0; i < 100; i += 1) {
    const response = await getComponentsPage({
      projectId: params.projectId,
      page,
      pageSize,
      statuses: params.statuses,
      riskLevels: params.riskLevels,
      tags: params.tags,
    });
    items.push(...response.items);
    if (!response.has_next) {
      return items;
    }
    page += 1;
  }

  return items;
}

export async function getComponent(componentId: string): Promise<ComponentDto> {
  return apiRequest(`/components/${componentId}`);
}

export async function createComponent(payload: {
  project_id: string;
  name: string;
  key?: string | null;
  description?: string | null;
  owner_id?: string | null;
  status?: ProductStatus;
  tags?: string[];
  business_criticality?: number;
  change_frequency?: number;
  integration_complexity?: number;
  defect_density?: number;
  production_incident_score?: number;
  automation_confidence?: number;
}): Promise<ComponentDto> {
  return apiRequest("/components", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchComponent(componentId: string, payload: Partial<ComponentDto>): Promise<ComponentDto> {
  return apiRequest(`/components/${componentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteComponent(componentId: string): Promise<void> {
  await apiRequest(`/components/${componentId}`, { method: "DELETE" });
}

export async function getProductComponents(productId: string): Promise<{ items: ProductComponentLinkDto[] }> {
  return apiRequest(`/products/${productId}/components`);
}

export async function replaceProductComponents(
  productId: string,
  links: Array<{ component_id: string; is_core?: boolean; sort_order?: number }>
): Promise<{ items: ProductComponentLinkDto[] }> {
  return apiRequest(`/products/${productId}/components`, {
    method: "PUT",
    body: JSON.stringify({ links }),
  });
}

export async function getComponentDependencies(componentId: string): Promise<{ items: ComponentDependencyDto[] }> {
  return apiRequest(`/components/${componentId}/dependencies`);
}

export async function replaceComponentDependencies(
  componentId: string,
  dependencies: Array<{ target_component_id: string; dependency_type?: "depends_on" }>
): Promise<{ items: ComponentDependencyDto[] }> {
  return apiRequest(`/components/${componentId}/dependencies`, {
    method: "PUT",
    body: JSON.stringify({ dependencies }),
  });
}

export async function getProductSummary(productId: string): Promise<ProductSummaryDto> {
  return apiRequest(`/products/${productId}/summary`);
}

export async function getComponentGraph(projectId: string): Promise<ComponentGraphDto> {
  return apiRequest(`/components/graph?project_id=${encodeURIComponent(projectId)}`);
}

export async function previewGeneratedPlan(payload: {
  project_id: string;
  config: PlanGenerationConfigDto;
}): Promise<{ preview: PlanGenerationPreviewDto }> {
  return apiRequest("/test-plans/generate-preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
