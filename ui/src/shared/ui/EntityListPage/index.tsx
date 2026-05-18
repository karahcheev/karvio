// List page layout: header plus filterable search/table region and optional footer.

import type { ReactNode } from "react";
import { PageHeaderSection } from "@/shared/ui/PageHeader";
import { FilterableEntityList } from "@/shared/ui/FilterableEntityList";

type EntityListPageProps = Readonly<{
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchPlaceholder: string;
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  activeFiltersCount: number;
  onClearFilters: () => void;
  filtersContent: ReactNode;
  isLoading: boolean;
  error: string | null;
  empty: boolean;
  colSpan: number;
  loadingMessage?: ReactNode;
  errorMessage?: ReactNode;
  emptyMessage: ReactNode;
  searchWrapperClassName?: string;
  panelClassName?: string;
  filtersTitle?: string;
  filtersTriggerLabel?: string;
  filtersClearLabel?: string;
  rightSlot?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}>;

export function EntityListPage({
  title,
  subtitle,
  actions,
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
  filtersOpen,
  onFiltersOpenChange,
  activeFiltersCount,
  onClearFilters,
  filtersContent,
  isLoading,
  error,
  empty,
  colSpan,
  loadingMessage,
  errorMessage,
  emptyMessage,
  searchWrapperClassName,
  panelClassName,
  filtersTitle,
  filtersTriggerLabel,
  filtersClearLabel,
  rightSlot,
  footer,
  children,
}: EntityListPageProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {/* Page header */}
      <PageHeaderSection title={title} subtitle={subtitle} actions={actions} />
      {/* Search, filters, and table */}
      <FilterableEntityList
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        searchPlaceholder={searchPlaceholder}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={onFiltersOpenChange}
        activeFiltersCount={activeFiltersCount}
        onClearFilters={onClearFilters}
        filtersContent={filtersContent}
        isLoading={isLoading}
        error={error}
        empty={empty}
        colSpan={colSpan}
        loadingMessage={loadingMessage}
        errorMessage={errorMessage}
        emptyMessage={emptyMessage}
        searchWrapperClassName={searchWrapperClassName}
        panelClassName={panelClassName}
        filtersTitle={filtersTitle}
        filtersTriggerLabel={filtersTriggerLabel}
        filtersClearLabel={filtersClearLabel}
        rightSlot={rightSlot}
      >
        {children}
      </FilterableEntityList>
      {/* Footer slot */}
      {footer}
    </div>
  );
}
