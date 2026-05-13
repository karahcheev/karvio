import * as React from "react";
import { Button } from "@/shared/ui/Button";
import { SearchField } from "@/shared/ui/SearchField";
import { SelectableCardList, type SelectableCardListProps } from "@/shared/ui/SelectableCardList";

type SearchableEntityPickerProps<T> = Readonly<
  Omit<SelectableCardListProps<T>, "className"> & {
    searchValue: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder?: string;
    searchLabel?: React.ReactNode;
    searchRequired?: boolean;
    selectedSummary?: React.ReactNode;
    isLoading?: boolean;
    loadingState?: React.ReactNode;
    className?: string;
    listClassName?: string;
    emptyState?: React.ReactNode;
    loadMoreLabel?: string;
    onLoadMore?: () => void;
    isLoadingMore?: boolean;
    hasMore?: boolean;
    loadMoreClassName?: string;
    loadMoreContainerClassName?: string;
  }
>;

export function SearchableEntityPicker<T>({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  searchLabel,
  searchRequired,
  selectedSummary,
  isLoading = false,
  loadingState,
  items,
  getKey,
  isSelected,
  onToggle,
  renderItem,
  selectionType,
  name,
  getInputAriaLabel,
  getItemDisabled,
  getItemClassName,
  showSelectedIndicator,
  className,
  listClassName,
  emptyState,
  onLoadMore,
  loadMoreLabel = "Load more",
  hasMore = false,
  isLoadingMore = false,
  loadMoreClassName,
  loadMoreContainerClassName,
}: SearchableEntityPickerProps<T>) {
  return (
    <div className={className}>
      <SearchField
        label={searchLabel}
        required={searchRequired}
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
      />

      {selectedSummary ? <div className="mt-3">{selectedSummary}</div> : null}

      <div className="mt-2">
        {isLoading && items.length === 0 ? (
          loadingState ?? <div className="rounded-lg border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted-foreground)]">Loading...</div>
        ) : (
          <SelectableCardList
            items={items}
            getKey={getKey}
            isSelected={isSelected}
            onToggle={onToggle}
            renderItem={renderItem}
            selectionType={selectionType}
            name={name}
            getInputAriaLabel={getInputAriaLabel}
            getItemDisabled={getItemDisabled}
            getItemClassName={getItemClassName}
            showSelectedIndicator={showSelectedIndicator}
            className={listClassName}
            emptyState={emptyState}
          />
        )}
      </div>

      {hasMore && onLoadMore ? (
        <div className={loadMoreContainerClassName ?? "mt-2"}>
          <Button
            type="button"
            unstyled
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className={
              loadMoreClassName ?? "w-full rounded-lg px-3 py-2 text-center text-sm text-[var(--highlight-foreground)] hover:bg-[var(--muted)] disabled:opacity-50"
            }
          >
            {isLoadingMore ? "Loading..." : loadMoreLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
