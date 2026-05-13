import { useEffect, useState } from "react";

type ProductComponentLink = Readonly<{
  component_id: string;
}>;

type ComponentDependency = Readonly<{
  target_component_id: string;
}>;

type Params = Readonly<{
  selectedProductId: string | null;
  selectedComponentId: string | null;
  productComponents?: ProductComponentLink[];
  productComponentsFetching: boolean;
  productComponentsLoaded: boolean;
  componentDependencies?: ComponentDependency[];
  componentDependenciesFetching: boolean;
  componentDependenciesLoaded: boolean;
}>;

export function useProductRelationDrafts({
  selectedProductId,
  selectedComponentId,
  productComponents,
  productComponentsFetching,
  productComponentsLoaded,
  componentDependencies,
  componentDependenciesFetching,
  componentDependenciesLoaded,
}: Params) {
  const [componentSelectionDraft, setComponentSelectionDraft] = useState<Set<string>>(new Set());
  const [dependencySelectionDraft, setDependencySelectionDraft] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (productComponentsFetching && !productComponentsLoaded) return;
    const next = new Set((productComponents ?? []).map((item) => item.component_id));
    setComponentSelectionDraft(next);
  }, [productComponents, selectedProductId, productComponentsFetching, productComponentsLoaded]);

  useEffect(() => {
    if (componentDependenciesFetching && !componentDependenciesLoaded) return;
    const next = new Set((componentDependencies ?? []).map((item) => item.target_component_id));
    setDependencySelectionDraft(next);
  }, [componentDependencies, selectedComponentId, componentDependenciesFetching, componentDependenciesLoaded]);

  return {
    componentSelectionDraft,
    setComponentSelectionDraft,
    dependencySelectionDraft,
    setDependencySelectionDraft,
    resetComponentSelectionDraft: () => setComponentSelectionDraft(new Set()),
    resetDependencySelectionDraft: () => setDependencySelectionDraft(new Set()),
  };
}
