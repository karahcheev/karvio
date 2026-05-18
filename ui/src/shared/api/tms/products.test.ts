import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest } = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock("@/shared/api/client", () => ({
  apiRequest,
}));

import {
  createComponent,
  createProduct,
  getComponentsPage,
  getProductsPage,
  previewGeneratedPlan,
  replaceComponentDependencies,
  replaceProductComponents,
} from "./products";

describe("products api", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("builds products query params", async () => {
    apiRequest.mockResolvedValue({ items: [], page: 1, page_size: 25, has_next: false });
    await getProductsPage({ projectId: "proj_1", page: 2, pageSize: 10, search: "pay", statuses: ["active"] });
    const url = apiRequest.mock.calls[0][0] as string;
    expect(url).toContain("/products?");
    expect(url).toContain("project_id=proj_1");
    expect(url).toContain("page=2");
    expect(url).toContain("page_size=10");
    expect(url).toContain("search=pay");
    expect(url).toContain("status=active");
  });

  it("builds components query params", async () => {
    apiRequest.mockResolvedValue({ items: [], page: 1, page_size: 25, has_next: false });
    await getComponentsPage({
      projectId: "proj_1",
      riskLevels: ["high"],
      productIds: ["prod_1"],
    });
    const url = apiRequest.mock.calls[0][0] as string;
    expect(url).toContain("risk_level=high");
    expect(url).toContain("product_id=prod_1");
  });

  it("creates product and component", async () => {
    apiRequest.mockResolvedValue({ id: "x" });
    await createProduct({ project_id: "proj_1", name: "Checkout" });
    await createComponent({ project_id: "proj_1", name: "Payments" });
    expect(apiRequest).toHaveBeenNthCalledWith(1, "/products", {
      method: "POST",
      body: JSON.stringify({ project_id: "proj_1", name: "Checkout" }),
    });
    expect(apiRequest).toHaveBeenNthCalledWith(2, "/components", {
      method: "POST",
      body: JSON.stringify({ project_id: "proj_1", name: "Payments" }),
    });
  });

  it("replaces links/dependencies and previews generation", async () => {
    apiRequest.mockResolvedValue({ items: [] });
    await replaceProductComponents("prod_1", [{ component_id: "comp_1" }]);
    await replaceComponentDependencies("comp_1", [{ target_component_id: "comp_2" }]);
    await previewGeneratedPlan({
      project_id: "proj_1",
      config: {
        product_ids: ["prod_1"],
        component_ids: [],
        include_dependent_components: true,
        minimum_risk_level: null,
        generation_mode: "regression",
        explicit_include_case_ids: [],
        explicit_exclude_case_ids: [],
      },
    });

    expect(apiRequest).toHaveBeenNthCalledWith(1, "/products/prod_1/components", {
      method: "PUT",
      body: JSON.stringify({ links: [{ component_id: "comp_1" }] }),
    });
    expect(apiRequest).toHaveBeenNthCalledWith(2, "/components/comp_1/dependencies", {
      method: "PUT",
      body: JSON.stringify({ dependencies: [{ target_component_id: "comp_2" }] }),
    });
    expect(apiRequest).toHaveBeenNthCalledWith(3, "/test-plans/generate-preview", {
      method: "POST",
      body: JSON.stringify({
        project_id: "proj_1",
        config: {
          product_ids: ["prod_1"],
          component_ids: [],
          include_dependent_components: true,
          minimum_risk_level: null,
          generation_mode: "regression",
          explicit_include_case_ids: [],
          explicit_exclude_case_ids: [],
        },
      }),
    });
  });
});
