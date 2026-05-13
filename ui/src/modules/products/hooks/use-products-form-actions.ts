import type { ComponentDto, ProductDto } from "@/shared/api";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import type { ComponentFormState, ProductFormState } from "@/modules/products/components/FormModals";

type MutationLike<TArgs, TResult = unknown> = Readonly<{
  mutateAsync: (args: TArgs) => Promise<TResult>;
}>;

type Params = Readonly<{
  projectId: string | undefined;
  productForm: ProductFormState;
  componentForm: ComponentFormState;
  componentSelectionDraft: Set<string>;
  dependencySelectionDraft: Set<string>;
  editingProduct: ProductDto | null;
  editingComponent: ComponentDto | null;
  editingComponentId: string | null;
  createProductMutation: MutationLike<
    {
      project_id: string;
      name: string;
      key?: string | null;
      description?: string | null;
    },
    ProductDto
  >;
  patchProductMutation: MutationLike<{
    productId: string;
    payload: Partial<ProductDto>;
  }>;
  replaceProductComponentsMutation: MutationLike<{
    productId: string;
    links: Array<{ component_id: string; is_core?: boolean; sort_order?: number }>;
  }>;
  createComponentMutation: MutationLike<
    {
      project_id: string;
      name: string;
      key?: string | null;
      description?: string | null;
      business_criticality?: number;
      change_frequency?: number;
      integration_complexity?: number;
      defect_density?: number;
      production_incident_score?: number;
      automation_confidence?: number;
    },
    ComponentDto
  >;
  patchComponentMutation: MutationLike<{
    componentId: string;
    payload: Partial<ComponentDto>;
  }>;
  replaceComponentDependenciesMutation: MutationLike<{
    componentId: string;
    dependencies: Array<{ target_component_id: string; dependency_type?: "depends_on" }>;
  }>;
  onProductCreated: (productId: string) => void;
  onProductSaved: () => void;
  onComponentSaved: () => void;
}>;

export function useProductsFormActions({
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
  onProductCreated,
  onProductSaved,
  onComponentSaved,
}: Params) {
  const saveProduct = async () => {
    if (!projectId || !productForm.name.trim()) return;
    try {
      const selectedComponentIds = Array.from(componentSelectionDraft);
      const allLinks = selectedComponentIds.map((componentId, index) => ({
        component_id: componentId,
        is_core: false,
        sort_order: index,
      }));

      if (editingProduct) {
        await patchProductMutation.mutateAsync({
          productId: editingProduct.id,
          payload: {
            name: productForm.name.trim(),
            key: productForm.key.trim() || editingProduct.key,
            description: productForm.description.trim() || null,
          },
        });
        await replaceProductComponentsMutation.mutateAsync({
          productId: editingProduct.id,
          links: allLinks,
        });
        notifySuccess("Product updated");
      } else {
        const created = await createProductMutation.mutateAsync({
          project_id: projectId,
          name: productForm.name.trim(),
          key: productForm.key.trim() || null,
          description: productForm.description.trim() || null,
        });
        onProductCreated(created.id);
        if (allLinks.length > 0) {
          await replaceProductComponentsMutation.mutateAsync({
            productId: created.id,
            links: allLinks,
          });
        }
        notifySuccess("Product created");
      }
      onProductSaved();
    } catch (error) {
      notifyError(error, editingProduct ? "Failed to update product." : "Failed to create product.");
    }
  };

  const saveComponent = async () => {
    if (!projectId || !componentForm.name.trim()) return;
    try {
      const dependencies = Array.from(dependencySelectionDraft)
        .filter((componentId) => componentId !== editingComponentId)
        .map((componentId) => ({ target_component_id: componentId, dependency_type: "depends_on" as const }));

      if (editingComponent) {
        await patchComponentMutation.mutateAsync({
          componentId: editingComponent.id,
          payload: {
            name: componentForm.name.trim(),
            key: componentForm.key.trim() || editingComponent.key,
            description: componentForm.description.trim() || null,
            business_criticality: componentForm.business_criticality,
            change_frequency: componentForm.change_frequency,
            integration_complexity: componentForm.integration_complexity,
            defect_density: componentForm.defect_density,
            production_incident_score: componentForm.production_incident_score,
            automation_confidence: componentForm.automation_confidence,
          },
        });
        await replaceComponentDependenciesMutation.mutateAsync({
          componentId: editingComponent.id,
          dependencies,
        });
        notifySuccess("Component updated");
      } else {
        const created = await createComponentMutation.mutateAsync({
          project_id: projectId,
          name: componentForm.name.trim(),
          key: componentForm.key.trim() || null,
          description: componentForm.description.trim() || null,
          business_criticality: componentForm.business_criticality,
          change_frequency: componentForm.change_frequency,
          integration_complexity: componentForm.integration_complexity,
          defect_density: componentForm.defect_density,
          production_incident_score: componentForm.production_incident_score,
          automation_confidence: componentForm.automation_confidence,
        });
        if (dependencies.length > 0) {
          await replaceComponentDependenciesMutation.mutateAsync({
            componentId: created.id,
            dependencies,
          });
        }
        notifySuccess("Component created");
      }
      onComponentSaved();
    } catch (error) {
      notifyError(error, editingComponent ? "Failed to update component." : "Failed to create component.");
    }
  };

  return { saveProduct, saveComponent };
}
