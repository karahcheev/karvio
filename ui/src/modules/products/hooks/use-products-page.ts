import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useComponentsPageQuery, useProductsPageQuery, type ComponentDto, type ProductDto } from "@/shared/api";
import { useColumnVisibility, useDisclosure, useSearchState } from "@/shared/hooks";
import { LIST_SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import type { UnifiedTableProps } from "@/shared/ui";
import {
  DEFAULT_COMPONENT_COLUMNS,
  DEFAULT_PRODUCT_COLUMNS,
  getTotalPages,
  type ComponentColumn,
  type ComponentRiskLevel,
  type ProductColumn,
  type ProductStatus,
} from "@/modules/products/config";

function toggleSetValue<T>(setter: Dispatch<SetStateAction<Set<T>>>, value: T) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  });
}

export function useProductsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") === "components" ? "components" : "products";
  const [tab, setTab] = useState<"products" | "components">(tabFromUrl);
  const { searchValue: productSearchQuery, setSearchValue: setProductSearchQuery } = useSearchState("");
  const { searchValue: componentSearchQuery, setSearchValue: setComponentSearchQuery } = useSearchState("");
  const debouncedProductSearchQuery = useDebouncedValue(productSearchQuery, LIST_SEARCH_DEBOUNCE_MS);
  const debouncedComponentSearchQuery = useDebouncedValue(componentSearchQuery, LIST_SEARCH_DEBOUNCE_MS);

  const { isOpen: filtersOpen, setIsOpen: setFiltersOpen } = useDisclosure(false);
  const { isOpen: productColumnsOpen, setIsOpen: setProductColumnsOpen } = useDisclosure(false);
  const { isOpen: componentColumnsOpen, setIsOpen: setComponentColumnsOpen } = useDisclosure(false);

  const { visibleColumns: productVisibleColumns, toggleColumn: toggleProductColumn } = useColumnVisibility<ProductColumn>(DEFAULT_PRODUCT_COLUMNS);
  const { visibleColumns: componentVisibleColumns, toggleColumn: toggleComponentColumn } = useColumnVisibility<ComponentColumn>(DEFAULT_COMPONENT_COLUMNS);

  const [selectedProductStatuses, setSelectedProductStatuses] = useState<Set<ProductStatus>>(new Set());
  const [selectedComponentStatuses, setSelectedComponentStatuses] = useState<Set<ProductStatus>>(new Set());
  const [selectedComponentRiskLevels, setSelectedComponentRiskLevels] = useState<Set<ComponentRiskLevel>>(new Set());

  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(25);
  const [componentPage, setComponentPage] = useState(1);
  const [componentPageSize, setComponentPageSize] = useState(25);

  const productsQuery = useProductsPageQuery(projectId, {
    page: productPage,
    pageSize: productPageSize,
    search: debouncedProductSearchQuery.trim() || undefined,
    statuses: selectedProductStatuses.size > 0 ? Array.from(selectedProductStatuses) : undefined,
  });

  const componentsQuery = useComponentsPageQuery(projectId, {
    page: componentPage,
    pageSize: componentPageSize,
    search: debouncedComponentSearchQuery.trim() || undefined,
    statuses: selectedComponentStatuses.size > 0 ? Array.from(selectedComponentStatuses) : undefined,
    riskLevels: selectedComponentRiskLevels.size > 0 ? Array.from(selectedComponentRiskLevels) : undefined,
  });

  const products = useMemo(() => productsQuery.data?.items ?? [], [productsQuery.data?.items]);
  const components = useMemo(() => componentsQuery.data?.items ?? [], [componentsQuery.data?.items]);

  useEffect(() => {
    setProductPage(1);
  }, [debouncedProductSearchQuery, selectedProductStatuses]);

  useEffect(() => {
    setComponentPage(1);
  }, [debouncedComponentSearchQuery, selectedComponentStatuses, selectedComponentRiskLevels]);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  const productTotalItems = useMemo(() => {
    const total = productsQuery.data?.total;
    return typeof total === "number" ? total : undefined;
  }, [productsQuery.data?.total]);

  const productTotalPages = useMemo(
    () => getTotalPages(productTotalItems, productPageSize, productPage, productsQuery.data?.has_next),
    [productTotalItems, productPageSize, productPage, productsQuery.data?.has_next],
  );

  const productTablePagination = useMemo((): NonNullable<UnifiedTableProps<ProductDto, ProductColumn>["pagination"]> => {
    return {
      enabled: true,
      mode: "server",
      page: productPage,
      totalPages: productTotalPages,
      totalItems: productTotalItems,
      pageSize: productPageSize,
      pageSizeOptions: [10, 25, 50],
      defaultPageSize: productPageSize,
      onPageChange: (page: number) => {
        if (page === productPage) return;
        if (page < 1 || page > productTotalPages) return;
        setProductPage(page);
      },
      onPageSizeChange: (nextSize: number) => {
        if (nextSize === productPageSize) return;
        setProductPageSize(nextSize);
        setProductPage(1);
      },
    };
  }, [productPage, productTotalPages, productTotalItems, productPageSize]);

  const componentTotalItems = useMemo(() => {
    const total = componentsQuery.data?.total;
    return typeof total === "number" ? total : undefined;
  }, [componentsQuery.data?.total]);

  const componentTotalPages = useMemo(
    () => getTotalPages(componentTotalItems, componentPageSize, componentPage, componentsQuery.data?.has_next),
    [componentTotalItems, componentPageSize, componentPage, componentsQuery.data?.has_next],
  );

  const componentTablePagination = useMemo((): NonNullable<UnifiedTableProps<ComponentDto, ComponentColumn>["pagination"]> => {
    return {
      enabled: true,
      mode: "server",
      page: componentPage,
      totalPages: componentTotalPages,
      totalItems: componentTotalItems,
      pageSize: componentPageSize,
      pageSizeOptions: [10, 25, 50],
      defaultPageSize: componentPageSize,
      onPageChange: (page: number) => {
        if (page === componentPage) return;
        if (page < 1 || page > componentTotalPages) return;
        setComponentPage(page);
      },
      onPageSizeChange: (nextSize: number) => {
        if (nextSize === componentPageSize) return;
        setComponentPageSize(nextSize);
        setComponentPage(1);
      },
    };
  }, [componentPage, componentTotalPages, componentTotalItems, componentPageSize]);

  const activeFiltersCount = tab === "products"
    ? selectedProductStatuses.size
    : selectedComponentStatuses.size + selectedComponentRiskLevels.size;

  const clearFilters = () => {
    if (tab === "products") {
      setSelectedProductStatuses(new Set());
      return;
    }
    setSelectedComponentStatuses(new Set());
    setSelectedComponentRiskLevels(new Set());
  };

  const handleReleaseScopeTabChange = (next: "products" | "components" | "milestones" | "test-plans") => {
    if (!projectId) return;
    if (next === "milestones") {
      navigate(`/projects/${projectId}/products/milestones`);
      return;
    }
    if (next === "test-plans") {
      navigate(`/projects/${projectId}/products/test-plans`);
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    if (next === "components") nextParams.set("tab", "components");
    else nextParams.delete("tab");
    setSearchParams(nextParams, { replace: true });
    setTab(next);
  };

  return {
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
    toggleProductStatus: (value: ProductStatus) => toggleSetValue(setSelectedProductStatuses, value),
    toggleComponentStatus: (value: ProductStatus) => toggleSetValue(setSelectedComponentStatuses, value),
    toggleComponentRiskLevel: (value: ComponentRiskLevel) => toggleSetValue(setSelectedComponentRiskLevels, value),
    productsQuery,
    componentsQuery,
    products,
    components,
    productTablePagination,
    componentTablePagination,
    productsLoading: productsQuery.isLoading,
    componentsLoading: componentsQuery.isLoading,
    productsError: productsQuery.error instanceof Error ? productsQuery.error.message : null,
    componentsError: componentsQuery.error instanceof Error ? componentsQuery.error.message : null,
    activeFiltersCount,
    clearFilters,
    handleReleaseScopeTabChange,
  };
}
