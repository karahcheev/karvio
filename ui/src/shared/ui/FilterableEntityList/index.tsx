// Search and filters toolbar above a stateful entity table region.

import type { ReactNode } from "react";
import { SearchFiltersToolbar } from "@/shared/ui/SearchFiltersToolbar";
import { EntityTableWithStates } from "@/shared/ui/EntityTableWithStates";

type FilterableEntityListProps = Readonly<{
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
  children: ReactNode;
}>;

export function FilterableEntityList({
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
  children,
}: FilterableEntityListProps) {
  return (
    <>
      {/* Toolbar: search + filters */}
      <SearchFiltersToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        searchPlaceholder={searchPlaceholder}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={onFiltersOpenChange}
        activeFiltersCount={activeFiltersCount}
        onClearFilters={onClearFilters}
        filtersContent={filtersContent}
        rightSlot={rightSlot}
        searchWrapperClassName={searchWrapperClassName}
        panelClassName={panelClassName}
        filtersTitle={filtersTitle}
        filtersTriggerLabel={filtersTriggerLabel}
        filtersClearLabel={filtersClearLabel}
      />

      {/* Table area with loading / empty handling */}
      <div className="flex min-h-0 flex-1 overflow-hidden bg-[var(--table-canvas)] p-3">
        <EntityTableWithStates
          isLoading={isLoading}
          error={error}
          empty={empty}
          colSpan={colSpan}
          loadingMessage={loadingMessage}
          errorMessage={errorMessage}
          emptyMessage={emptyMessage}
        >
          {children}
        </EntityTableWithStates>
      </div>
    </>
  );
}
