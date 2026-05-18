import { useEffect, useMemo, useState } from "react";
import { Eye, LayoutList, Network, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useComponentDependenciesQuery,
  useComponentGraphQuery,
  useComponentQuery,
  useCreateComponentMutation,
  useCreateProductMutation,
  useCreateTestPlanMutation,
  useDeleteComponentMutation,
  useDeleteProductMutation,
  useGeneratedPlanPreviewMutation,
  useAllComponentsQuery,
  usePatchComponentMutation,
  usePatchProductMutation,
  useProductComponentsQuery,
  useProductSummaryQuery,
  useReplaceComponentDependenciesMutation,
  useReplaceProductComponentsMutation,
  type ComponentDto,
  type ProductDto,
} from "@/shared/api";
import { ComponentGraph } from "@/modules/products/components/ComponentGraph";
import { useDisclosure } from "@/shared/hooks";
import { cn } from "@/shared/lib/cn";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { useDeleteConfirmation } from "@/shared/lib/use-delete-confirmation";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import {
  Button,
  CommonPage,
  EntityListPage,
  FilterChecklistSection,
  ListPageEmptyState,
  RowActionsMenu,
  UnderlineTabs,
  UnifiedTable,
} from "@/shared/ui";
import { ComponentDetailsPanel, ProductDetailsPanel } from "@/modules/products/components/DetailsPanels";
import { PlanPreviewModal } from "@/modules/products/components/PlanPreviewModal";
import {
  ComponentFormModal,
  ProductFormModal,
  type ComponentFormState,
  type ComponentRiskLevel,
  type ComponentRiskPreset,
  type ProductFormState,
} from "@/modules/products/components/FormModals";
import {
  COMPONENT_RISK_LEVEL_OPTIONS,
  COMPONENT_RISK_PRESETS,
  DEFAULT_COMPONENT_FORM,
  DEFAULT_PRODUCT_FORM,
  PRODUCT_STATUS_OPTIONS,
  RISK_FIELDS,
  RISK_VALUES,
  type ProductStatus,
} from "@/modules/products/config";
import { useProductRelationDrafts } from "@/modules/products/hooks/use-product-relation-drafts";
import { useProductsPage } from "@/modules/products/hooks/use-products-page";
import { useProductsFormActions } from "@/modules/products/hooks/use-products-form-actions";
import { buildComponentColumns, buildProductColumns } from "@/modules/products/table-columns";

export function ProductsModulePage() {
  const { confirmDelete } = useDeleteConfirmation();
  const {
    projectId,
    tab,
    setTab,
    productSearchQuery,
    setProductSearchQuery,
    componentSearchQuery,
    setComponentSearchQuery,
    filtersOpen,
    setFiltersOpen,
    productColumnsOpen,
    setProductColumnsOpen,
    componentColumnsOpen,
    setComponentColumnsOpen,
    productVisibleColumns,
    toggleProductColumn,
    componentVisibleColumns,
    toggleComponentColumn,
    selectedProductStatuses,
    selectedComponentStatuses,
    selectedComponentRiskLevels,
    toggleProductStatus,
    toggleComponentStatus,
    toggleComponentRiskLevel,
    products,
    components,
    productTablePagination,
    componentTablePagination,
    productsLoading,
    componentsLoading,
    productsError,
    componentsError,
    activeFiltersCount,
    clearFilters,
    handleReleaseScopeTabChange,
  } = useProductsPage();

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [openProductActionsId, setOpenProductActionsId] = useState<string | null>(null);
  const [openComponentActionsId, setOpenComponentActionsId] = useState<string | null>(null);

  const [productForm, setProductForm] = useState<ProductFormState>(DEFAULT_PRODUCT_FORM);
  const [componentForm, setComponentForm] = useState<ComponentFormState>(DEFAULT_COMPONENT_FORM);
  const [componentRiskPreset, setComponentRiskPreset] = useState<ComponentRiskPreset>("medium");
  const [showAdvancedRiskControls, setShowAdvancedRiskControls] = useState(false);

  const [planPreviewOpen, setPlanPreviewOpen] = useState(false);
  const [componentViewMode, setComponentViewMode] = useState<"table" | "graph">("table");

  const { isOpen: createProductOpen, open: openCreateProduct, close: closeCreateProduct } = useDisclosure(false);
  const { isOpen: createComponentOpen, open: openCreateComponent, close: closeCreateComponent } = useDisclosure(false);

  const shouldLoadAllComponents =
    createProductOpen
    || createComponentOpen
    || Boolean(editingProductId)
    || Boolean(editingComponentId);
  const allComponentsQuery = useAllComponentsQuery(projectId, shouldLoadAllComponents);

  const createProductMutation = useCreateProductMutation();
  const patchProductMutation = usePatchProductMutation();
  const deleteProductMutation = useDeleteProductMutation();
  const createComponentMutation = useCreateComponentMutation();
  const patchComponentMutation = usePatchComponentMutation();
  const deleteComponentMutation = useDeleteComponentMutation();
  const replaceProductComponentsMutation = useReplaceProductComponentsMutation();
  const replaceComponentDependenciesMutation = useReplaceComponentDependenciesMutation();
  const createPlanMutation = useCreateTestPlanMutation();
  const generatedPlanPreviewMutation = useGeneratedPlanPreviewMutation();

  const allComponents = useMemo(() => allComponentsQuery.data ?? [], [allComponentsQuery.data]);

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const editingProduct = useMemo(
    () => products.find((item) => item.id === editingProductId) ?? null,
    [products, editingProductId],
  );
  const editingComponent = useMemo(
    () => components.find((item) => item.id === editingComponentId) ?? null,
    [components, editingComponentId],
  );

  const componentGraphQuery = useComponentGraphQuery(
    projectId,
    tab === "components" && componentViewMode === "graph",
  );

  const productComponentsQuery = useProductComponentsQuery(selectedProductId ?? undefined);
  const componentDependenciesQuery = useComponentDependenciesQuery(selectedComponentId ?? undefined);
  const selectedComponentDetailQuery = useComponentQuery(selectedComponentId ?? undefined);
  const productSummaryQuery = useProductSummaryQuery(selectedProductId ?? undefined);
  const selectedComponent = useMemo(
    () => components.find((item) => item.id === selectedComponentId) ?? selectedComponentDetailQuery.data ?? null,
    [components, selectedComponentId, selectedComponentDetailQuery.data],
  );
  const {
    componentSelectionDraft,
    setComponentSelectionDraft,
    dependencySelectionDraft,
    setDependencySelectionDraft,
    resetComponentSelectionDraft,
    resetDependencySelectionDraft,
  } = useProductRelationDrafts({
    selectedProductId,
    selectedComponentId,
    productComponents: productComponentsQuery.data?.items,
    productComponentsFetching: productComponentsQuery.isFetching,
    productComponentsLoaded: Boolean(productComponentsQuery.data),
    componentDependencies: componentDependenciesQuery.data?.items,
    componentDependenciesFetching: componentDependenciesQuery.isFetching,
    componentDependenciesLoaded: Boolean(componentDependenciesQuery.data),
  });

  useEffect(() => {
    if (selectedProductId && !products.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(null);
    }
    if (editingProductId && !products.some((product) => product.id === editingProductId)) {
      setEditingProductId(null);
    }
    setOpenProductActionsId((current) => (current && !products.some((product) => product.id === current) ? null : current));
  }, [products, selectedProductId, editingProductId]);

  useEffect(() => {
    const selectedExistsInTable = Boolean(selectedComponentId && components.some((component) => component.id === selectedComponentId));
    const selectedExistsInDetail = selectedComponentDetailQuery.data?.id === selectedComponentId;
    const selectedDetailPending = selectedComponentDetailQuery.isLoading || selectedComponentDetailQuery.isFetching;
    if (selectedComponentId && !selectedExistsInTable && !selectedExistsInDetail && !selectedDetailPending) {
      setSelectedComponentId(null);
    }
    if (editingComponentId && !components.some((component) => component.id === editingComponentId)) {
      setEditingComponentId(null);
    }
    setOpenComponentActionsId((current) => (current && !components.some((component) => component.id === current) ? null : current));
  }, [
    components,
    selectedComponentId,
    editingComponentId,
    selectedComponentDetailQuery.data?.id,
    selectedComponentDetailQuery.isLoading,
    selectedComponentDetailQuery.isFetching,
  ]);

  const editingProductRelationsLoading = Boolean(editingProductId)
    && selectedProductId === editingProductId
    && (productComponentsQuery.isLoading || (productComponentsQuery.isFetching && !productComponentsQuery.data));
  const editingComponentRelationsLoading = Boolean(editingComponentId)
    && selectedComponentId === editingComponentId
    && (componentDependenciesQuery.isLoading || (componentDependenciesQuery.isFetching && !componentDependenciesQuery.data));

  const openProductModal = () => {
    setEditingProductId(null);
    setProductForm(DEFAULT_PRODUCT_FORM);
    resetComponentSelectionDraft();
    openCreateProduct();
  };

  const openComponentModal = () => {
    setEditingComponentId(null);
    setComponentForm(DEFAULT_COMPONENT_FORM);
    setComponentRiskPreset("medium");
    setShowAdvancedRiskControls(false);
    resetDependencySelectionDraft();
    openCreateComponent();
  };

  const openEditProductModal = (product: ProductDto) => {
    const hasLoadedCurrentLinks = selectedProductId === product.id;
    const currentLinks = hasLoadedCurrentLinks ? (productComponentsQuery.data?.items ?? []) : [];
    setSelectedProductId(product.id);
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      key: product.key,
      description: product.description ?? "",
    });
    setComponentSelectionDraft(new Set(currentLinks.map((item) => item.component_id)));
    openCreateProduct();
  };

  const openEditComponentModal = (component: ComponentDto) => {
    const hasLoadedCurrentDependencies = selectedComponentId === component.id;
    const currentDependencies = hasLoadedCurrentDependencies ? (componentDependenciesQuery.data?.items ?? []) : [];
    setSelectedComponentId(component.id);
    setEditingComponentId(component.id);
    setComponentForm({
      name: component.name,
      key: component.key,
      description: component.description ?? "",
      business_criticality: component.business_criticality,
      change_frequency: component.change_frequency,
      integration_complexity: component.integration_complexity,
      defect_density: component.defect_density,
      production_incident_score: component.production_incident_score,
      automation_confidence: component.automation_confidence,
    });
    setComponentRiskPreset("custom");
    setShowAdvancedRiskControls(false);
    setDependencySelectionDraft(new Set(currentDependencies.map((item) => item.target_component_id)));
    openCreateComponent();
  };

  const closeProductFormModal = () => {
    setEditingProductId(null);
    closeCreateProduct();
  };

  const closeComponentFormModal = () => {
    setEditingComponentId(null);
    setShowAdvancedRiskControls(false);
    closeCreateComponent();
  };

  const applyComponentRiskPreset = (preset: ComponentRiskPreset) => {
    setComponentRiskPreset(preset);
    if (preset === "custom") return;
    const profile = COMPONENT_RISK_PRESETS[preset];
    setComponentForm((current) => ({
      ...current,
      ...profile,
    }));
  };

  const { saveProduct, saveComponent } = useProductsFormActions({
    projectId,
    productForm,
    componentForm,
    componentSelectionDraft,
    dependencySelectionDraft,
    editingProduct,
    editingComponent,
    editingComponentId,
    createProductMutation,
    patchProductMutation,
    replaceProductComponentsMutation,
    createComponentMutation,
    patchComponentMutation,
    replaceComponentDependenciesMutation,
    onProductCreated: setSelectedProductId,
    onProductSaved: closeProductFormModal,
    onComponentSaved: closeComponentFormModal,
  });

  const handleDeleteProduct = async (product: ProductDto) => {
    const confirmed = await confirmDelete({
      title: "Delete Product",
      description: `Delete product "${product.name}"? This action cannot be undone.`,
      confirmLabel: "Delete Product",
    });
    if (!confirmed) return;
    try {
      await deleteProductMutation.mutateAsync({ productId: product.id, projectId: product.project_id });
      if (selectedProductId === product.id) {
        setSelectedProductId(null);
      }
      notifySuccess("Product deleted");
    } catch (error) {
      notifyError(error, "Failed to delete product.");
    }
  };

  const handleDeleteComponent = async (component: ComponentDto) => {
    const confirmed = await confirmDelete({
      title: "Delete Component",
      description: `Delete component "${component.name}"? This action cannot be undone.`,
      confirmLabel: "Delete Component",
    });
    if (!confirmed) return;
    try {
      await deleteComponentMutation.mutateAsync({ componentId: component.id, projectId: component.project_id });
      if (selectedComponentId === component.id) {
        setSelectedComponentId(null);
      }
      notifySuccess("Component deleted");
    } catch (error) {
      notifyError(error, "Failed to delete component.");
    }
  };

  const handleToggleProductStatus = async (product: ProductDto) => {
    try {
      await patchProductMutation.mutateAsync({
        productId: product.id,
        payload: { status: product.status === "active" ? "archived" : "active" },
      });
      notifySuccess(product.status === "active" ? "Product archived" : "Product activated");
    } catch (error) {
      notifyError(error, "Failed to update product status.");
    }
  };

  const handleToggleComponentStatus = async (component: ComponentDto) => {
    try {
      await patchComponentMutation.mutateAsync({
        componentId: component.id,
        payload: { status: component.status === "active" ? "archived" : "active" },
      });
      notifySuccess(component.status === "active" ? "Component archived" : "Component activated");
    } catch (error) {
      notifyError(error, "Failed to update component status.");
    }
  };

  const buildGeneratedPlanConfig = (productId: string) => ({
    product_ids: [productId],
    component_ids: [],
    include_dependent_components: true,
    minimum_risk_level: null,
    generation_mode: "regression" as const,
    explicit_include_case_ids: [],
    explicit_exclude_case_ids: [],
  });

  const requestGeneratedPlanPreview = async (productId: string) => {
    if (!projectId) return;
    await generatedPlanPreviewMutation.mutateAsync({
      project_id: projectId,
      config: buildGeneratedPlanConfig(productId),
    });
  };

  const openGeneratedPlanPreview = () => {
    if (!selectedProductId) return;
    setPlanPreviewOpen(true);
    void requestGeneratedPlanPreview(selectedProductId);
  };

  const closeGeneratedPlanPreview = () => {
    setPlanPreviewOpen(false);
    generatedPlanPreviewMutation.reset();
  };

  const createGeneratedPlan = async () => {
    if (!projectId || !selectedProductId || !selectedProduct) return;
    try {
      const createdPlan = await createPlanMutation.mutateAsync({
        project_id: projectId,
        name: `${selectedProduct.name} generated plan`,
        generation_source: "product_generated",
        generation_config: buildGeneratedPlanConfig(selectedProductId),
        suite_ids: [],
        case_ids: [],
      });

      notifySuccess(`Generated plan saved (${createdPlan.case_ids.length} cases)`);
      closeGeneratedPlanPreview();
    } catch (error) {
      notifyError(error, "Failed to create generated plan.");
    }
  };

  const productColumns = useMemo(() => buildProductColumns(), []);
  const componentColumns = useMemo(() => buildComponentColumns(), []);

  const linkedComponentIds = useMemo(
    () => (productComponentsQuery.data?.items ?? []).map((item) => item.component_id),
    [productComponentsQuery.data?.items],
  );
  const dependencyComponentIds = useMemo(
    () => (componentDependenciesQuery.data?.items ?? []).map((item) => item.target_component_id),
    [componentDependenciesQuery.data?.items],
  );
  const componentNameById = useMemo(() => {
    const source = allComponents.length > 0 ? allComponents : components;
    return new Map(source.map((component) => [component.id, component.name]));
  }, [allComponents, components]);
  const resolveComponentName = (componentId: string) => componentNameById.get(componentId) ?? componentId;

  const openComponentFromRelations = (componentId: string) => {
    setTab("components");
    setSelectedProductId(null);
    setSelectedComponentId(componentId);
    setOpenProductActionsId(null);
    setOpenComponentActionsId(null);
  };

  return (
    <CommonPage>
      <EntityListPage
        title={<span className="text-xl">{tab === "products" ? "Release Scope" : "Components & Risk"}</span>}
        subtitle={
          <div className="space-y-3">
            <div>
              {tab === "products"
                ? "Group components into products to see release coverage gaps and generate plans faster."
                : "Track component risk and dependencies in plain language so release plans reflect technical impact."}
            </div>
            <UnderlineTabs<"products" | "components" | "milestones" | "test-plans">
              value={tab}
              onChange={handleReleaseScopeTabChange}
              items={[
                { value: "products", label: "Products" },
                { value: "components", label: "Components" },
                { value: "milestones", label: "Milestones" },
                { value: "test-plans", label: "Test Plans" },
              ]}
            />
          </div>
        }
        actions={
          <Button
            type="button"
            variant="primary"
            size="md"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={tab === "products" ? openProductModal : openComponentModal}
            disabled={createProductMutation.isPending || createComponentMutation.isPending}
          >
            {tab === "products" ? "Create product" : "Add component"}
          </Button>
        }
        searchQuery={tab === "products" ? productSearchQuery : componentSearchQuery}
        onSearchQueryChange={tab === "products" ? setProductSearchQuery : setComponentSearchQuery}
        searchPlaceholder={tab === "products" ? "Search products..." : "Search components and risk..."}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        activeFiltersCount={activeFiltersCount}
        onClearFilters={clearFilters}
        panelClassName="w-72"
        filtersContent={
          tab === "products" ? (
            <FilterChecklistSection
              title="Status"
              values={PRODUCT_STATUS_OPTIONS}
              selectedValues={selectedProductStatuses}
              onToggle={(value) => toggleProductStatus(value as ProductStatus)}
              getLabel={(value) => value}
              emptyLabel="No statuses"
            />
          ) : (
            <>
              <FilterChecklistSection
                title="Status"
                values={PRODUCT_STATUS_OPTIONS}
                selectedValues={selectedComponentStatuses}
                onToggle={(value) => toggleComponentStatus(value as ProductStatus)}
                getLabel={(value) => value}
                emptyLabel="No statuses"
              />
              <FilterChecklistSection
                title="Risk Level"
                values={COMPONENT_RISK_LEVEL_OPTIONS}
                selectedValues={selectedComponentRiskLevels}
                onToggle={(value) => toggleComponentRiskLevel(value as ComponentRiskLevel)}
                getLabel={(value) => value}
                emptyLabel="No risk levels"
              />
            </>
          )
        }
        rightSlot={
          tab === "components" ? (
            <div className="flex items-center gap-0.5 rounded-md border border-[var(--border)] p-0.5">
              <button
                type="button"
                title="Table view"
                onClick={() => setComponentViewMode("table")}
                className={cn(
                  "flex items-center justify-center rounded p-1.5 transition-colors",
                  componentViewMode === "table"
                    ? "bg-[var(--bg-muted)] text-[var(--text)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]",
                )}
              >
                <LayoutList className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Graph view"
                onClick={() => setComponentViewMode("graph")}
                className={cn(
                  "flex items-center justify-center rounded p-1.5 transition-colors",
                  componentViewMode === "graph"
                    ? "bg-[var(--bg-muted)] text-[var(--text)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]",
                )}
              >
                <Network className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : undefined
        }
        isLoading={
          tab === "products"
            ? productsLoading
            : componentViewMode === "graph"
              ? componentGraphQuery.isLoading
              : componentsLoading
        }
        error={tab === "products" ? productsError : componentViewMode === "graph" ? null : componentsError}
        empty={
          tab === "products"
            ? products.length === 0
            : componentViewMode === "graph"
              ? (componentGraphQuery.data?.components.length ?? 1) === 0
              : components.length === 0
        }
        colSpan={tab === "products" ? productVisibleColumns.size + 1 : componentVisibleColumns.size + 1}
        loadingMessage={tab === "products" ? "Loading release scope..." : "Loading components..."}
        emptyMessage={
          tab === "products" ? (
            <ListPageEmptyState
              title="No products yet"
              description="Create your first product to group components, highlight coverage gaps, and prepare release plans."
              actions={
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={openProductModal}
                >
                  Create first product
                </Button>
              }
            />
          ) : (
            <ListPageEmptyState
              title="No components yet"
              description="Create your first component to track technical risk, map dependencies, and improve release confidence."
              actions={
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={openComponentModal}
                >
                  Create first component
                </Button>
              }
            />
          )
        }
      >
        {tab === "components" && componentViewMode === "graph" ? (
          componentGraphQuery.data ? (
            <div className="flex h-full min-h-[400px] w-full flex-1">
              <ComponentGraph
                graph={componentGraphQuery.data}
                selectedComponentId={selectedComponentId}
                onSelectComponent={(id) => {
                  setOpenComponentActionsId(null);
                  setSelectedComponentId(id);
                }}
              />
            </div>
          ) : null
        ) : tab === "products" ? (
          <UnifiedTable
            className="p-0"
            items={products}
            columns={productColumns}
            visibleColumns={productVisibleColumns}
            getRowId={(product) => product.id}
            onRowClick={(product) => {
              setOpenProductActionsId(null);
              setSelectedProductId(product.id);
            }}
            columnsMenu={{
              open: productColumnsOpen,
              onOpenChange: setProductColumnsOpen,
              onToggleColumn: toggleProductColumn,
            }}
            actions={{
              render: (product) => (
                <RowActionsMenu
                  triggerLabel="Open product actions"
                  open={openProductActionsId === product.id}
                  onOpenChange={(open) => setOpenProductActionsId(open ? product.id : null)}
                  contentClassName="w-44"
                  items={[
                    {
                      key: "view",
                      label: "View details",
                      icon: <Eye className="h-4 w-4" />,
                      onSelect: () => {
                        setSelectedProductId(product.id);
                        setOpenProductActionsId(null);
                      },
                    },
                    {
                      key: "edit",
                      label: "Edit",
                      icon: <Pencil className="h-4 w-4" />,
                      onSelect: () => {
                        openEditProductModal(product);
                        setOpenProductActionsId(null);
                      },
                    },
                    {
                      key: "toggle-status",
                      label: product.status === "active" ? "Archive" : "Activate",
                      disabled: patchProductMutation.isPending,
                      onSelect: () => {
                        invokeMaybeAsync(() => handleToggleProductStatus(product));
                        setOpenProductActionsId(null);
                      },
                    },
                    {
                      key: "delete",
                      label: "Delete",
                      icon: <Trash2 className="h-4 w-4" />,
                      variant: "destructive",
                      disabled: deleteProductMutation.isPending,
                      onSelect: () => {
                        invokeMaybeAsync(() => handleDeleteProduct(product));
                        setOpenProductActionsId(null);
                      },
                    },
                  ]}
                />
              ),
            }}
            rowClassName={(product) =>
              selectedProductId === product.id
                ? "bg-[var(--highlight-bg-soft)] hover:bg-[var(--highlight-bg)]"
                : undefined
            }
            pagination={productTablePagination}
          />
        ) : (
          <UnifiedTable
            className="p-0"
            items={components}
            columns={componentColumns}
            visibleColumns={componentVisibleColumns}
            getRowId={(component) => component.id}
            onRowClick={(component) => {
              setOpenComponentActionsId(null);
              setSelectedComponentId(component.id);
            }}
            columnsMenu={{
              open: componentColumnsOpen,
              onOpenChange: setComponentColumnsOpen,
              onToggleColumn: toggleComponentColumn,
            }}
            actions={{
              render: (component) => (
                <RowActionsMenu
                  triggerLabel="Open component actions"
                  open={openComponentActionsId === component.id}
                  onOpenChange={(open) => setOpenComponentActionsId(open ? component.id : null)}
                  contentClassName="w-44"
                  items={[
                    {
                      key: "view",
                      label: "View details",
                      icon: <Eye className="h-4 w-4" />,
                      onSelect: () => {
                        setSelectedComponentId(component.id);
                        setOpenComponentActionsId(null);
                      },
                    },
                    {
                      key: "edit",
                      label: "Edit",
                      icon: <Pencil className="h-4 w-4" />,
                      onSelect: () => {
                        openEditComponentModal(component);
                        setOpenComponentActionsId(null);
                      },
                    },
                    {
                      key: "toggle-status",
                      label: component.status === "active" ? "Archive" : "Activate",
                      disabled: patchComponentMutation.isPending,
                      onSelect: () => {
                        invokeMaybeAsync(() => handleToggleComponentStatus(component));
                        setOpenComponentActionsId(null);
                      },
                    },
                    {
                      key: "delete",
                      label: "Delete",
                      icon: <Trash2 className="h-4 w-4" />,
                      variant: "destructive",
                      disabled: deleteComponentMutation.isPending,
                      onSelect: () => {
                        invokeMaybeAsync(() => handleDeleteComponent(component));
                        setOpenComponentActionsId(null);
                      },
                    },
                  ]}
                />
              ),
            }}
            rowClassName={(component) =>
              selectedComponentId === component.id
                ? "bg-[var(--highlight-bg-soft)] hover:bg-[var(--highlight-bg)]"
                : undefined
            }
            pagination={componentTablePagination}
          />
        )}
      </EntityListPage>

      {tab === "products" && selectedProduct ? (
        <ProductDetailsPanel
          product={selectedProduct}
          summary={productSummaryQuery.data}
          linkedComponentIds={linkedComponentIds}
          resolveComponentName={resolveComponentName}
          onOpenLinkedComponent={openComponentFromRelations}
          onClose={() => setSelectedProductId(null)}
          onEdit={() => openEditProductModal(selectedProduct)}
          onToggleStatus={() => {
            void handleToggleProductStatus(selectedProduct);
          }}
          onDelete={() => {
            void handleDeleteProduct(selectedProduct);
          }}
          onPreviewGeneratedPlan={openGeneratedPlanPreview}
          busy={{
            editing: patchProductMutation.isPending || replaceProductComponentsMutation.isPending,
            toggling: patchProductMutation.isPending,
            deleting: deleteProductMutation.isPending,
            previewingPlan: generatedPlanPreviewMutation.isPending,
          }}
        />
      ) : null}

      {tab === "components" && selectedComponent ? (
        <ComponentDetailsPanel
          component={selectedComponent}
          dependencyComponentIds={dependencyComponentIds}
          resolveComponentName={resolveComponentName}
          onOpenDependencyComponent={openComponentFromRelations}
          onClose={() => setSelectedComponentId(null)}
          onEdit={() => openEditComponentModal(selectedComponent)}
          onToggleStatus={() => {
            void handleToggleComponentStatus(selectedComponent);
          }}
          onDelete={() => {
            void handleDeleteComponent(selectedComponent);
          }}
          busy={{
            editing: patchComponentMutation.isPending || replaceComponentDependenciesMutation.isPending,
            toggling: patchComponentMutation.isPending,
            deleting: deleteComponentMutation.isPending,
          }}
        />
      ) : null}

      <PlanPreviewModal
        isOpen={planPreviewOpen}
        onClose={closeGeneratedPlanPreview}
        onRetry={() => {
          if (!selectedProductId) return;
          void requestGeneratedPlanPreview(selectedProductId);
        }}
        onCreatePlan={() => {
          void createGeneratedPlan();
        }}
        createDisabled={
          createPlanMutation.isPending
          || generatedPlanPreviewMutation.isPending
          || !generatedPlanPreviewMutation.data?.preview
        }
        creatingPlan={createPlanMutation.isPending}
        productName={selectedProduct?.name ?? "Selected product"}
        preview={generatedPlanPreviewMutation.data?.preview ?? null}
        loading={generatedPlanPreviewMutation.isPending}
        errorMessage={
          generatedPlanPreviewMutation.error instanceof Error
            ? generatedPlanPreviewMutation.error.message
            : null
        }
      />

      <ProductFormModal
        isOpen={createProductOpen || Boolean(editingProductId)}
        isEditing={Boolean(editingProduct)}
        onClose={closeProductFormModal}
        onSave={() => {
          void saveProduct();
        }}
        saveDisabled={
          !productForm.name.trim()
          || editingProductRelationsLoading
          || createProductMutation.isPending
          || patchProductMutation.isPending
          || replaceProductComponentsMutation.isPending
        }
        relationsLoading={editingProductRelationsLoading}
        form={productForm}
        setForm={setProductForm}
        allComponents={allComponents}
        allComponentsLoading={allComponentsQuery.isLoading}
        componentSelectionDraft={componentSelectionDraft}
        setComponentSelectionDraft={setComponentSelectionDraft}
      />

      <ComponentFormModal
        isOpen={createComponentOpen || Boolean(editingComponentId)}
        isEditing={Boolean(editingComponent)}
        onClose={closeComponentFormModal}
        onSave={() => {
          void saveComponent();
        }}
        saveDisabled={
          !componentForm.name.trim()
          || editingComponentRelationsLoading
          || createComponentMutation.isPending
          || patchComponentMutation.isPending
          || replaceComponentDependenciesMutation.isPending
        }
        relationsLoading={editingComponentRelationsLoading}
        form={componentForm}
        setForm={setComponentForm}
        componentRiskPreset={componentRiskPreset}
        onRiskPresetChange={applyComponentRiskPreset}
        showAdvancedRiskControls={showAdvancedRiskControls}
        onToggleAdvancedRiskControls={() => setShowAdvancedRiskControls((current) => !current)}
        riskFields={RISK_FIELDS}
        riskValues={RISK_VALUES}
        editingComponentId={editingComponentId}
        allComponents={allComponents}
        allComponentsLoading={allComponentsQuery.isLoading}
        dependencySelectionDraft={dependencySelectionDraft}
        setDependencySelectionDraft={setDependencySelectionDraft}
      />
    </CommonPage>
  );
}
