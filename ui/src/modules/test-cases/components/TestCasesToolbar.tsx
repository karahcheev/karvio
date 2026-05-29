// Test cases list header: search, filters, optional bulk actions, and new test case.
import { Plus } from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { PageHeaderSection } from "@/shared/ui/PageHeader";
import { SearchableFilterChecklistSection } from "@/shared/ui/SearchableFilterChecklistSection";
import { SearchFiltersToolbar } from "@/shared/ui/SearchFiltersToolbar";
import { Switch } from "@/shared/ui/Switch";
import { TagChip } from "@/shared/ui/TagChip";
import { formatTestCaseStatusLabel } from "./TestCaseBadges";
import { TestCaseExportMenu } from "./TestCaseExportMenu";
import type { SuiteNode } from "../utils/types";
import type { TestCaseExportFormat } from "@/shared/api";
import { TEST_CASE_TYPE_OPTIONS, formatTestCaseTypeLabel } from "@/shared/domain/testCaseType";
import { Button } from "@/shared/ui/Button";

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

type OwnerOption = { id: string; username: string };
type NamedOption = { id: string; name: string };

type Props = Readonly<{
  suites: SuiteNode[];
  selectedSuite: string | null;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  filtersOpen: boolean;
  setFiltersOpen: Dispatch<SetStateAction<boolean>>;
  activeFiltersCount: number;
  selectedStatuses: Set<string>;
  selectedPriorities: Set<string>;
  selectedTags: Set<string>;
  selectedTypes: Set<string>;
  selectedProducts: Set<string>;
  selectedComponents: Set<string>;
  selectedOwnerId: string | null;
  includeNestedSuites: boolean;
  tagOptions: string[];
  ownerOptions: OwnerOption[];
  productOptions: NamedOption[];
  componentOptions: NamedOption[];
  onToggleFilter: (filterSet: Set<string>, setFilter: (set: Set<string>) => void, value: string) => void;
  onToggleOwner: (ownerId: string) => void;
  setSelectedStatuses: (set: Set<string>) => void;
  setSelectedPriorities: (set: Set<string>) => void;
  setSelectedTags: (set: Set<string>) => void;
  setSelectedTypes: (set: Set<string>) => void;
  setSelectedProducts: (set: Set<string>) => void;
  setSelectedComponents: (set: Set<string>) => void;
  setIncludeNestedSuites: Dispatch<SetStateAction<boolean>>;
  onClearAllFilters: () => void;
  onNewTestCaseClick: () => void;
  onExport: (format: TestCaseExportFormat) => void | Promise<void>;
  exportBusy: boolean;
  exportSelectedCount: number;
  /** Shown to the right of the filters control (e.g. bulk selection icons). */
  toolbarRightSlot?: ReactNode;
}>;

export function TestCasesToolbar({
  suites,
  selectedSuite,
  searchQuery,
  setSearchQuery,
  filtersOpen,
  setFiltersOpen,
  activeFiltersCount,
  selectedStatuses,
  selectedPriorities,
  selectedTags,
  selectedTypes,
  selectedProducts,
  selectedComponents,
  selectedOwnerId,
  includeNestedSuites,
  tagOptions,
  ownerOptions,
  productOptions,
  componentOptions,
  onToggleFilter,
  onToggleOwner,
  setSelectedStatuses,
  setSelectedPriorities,
  setSelectedTags,
  setSelectedTypes,
  setSelectedProducts,
  setSelectedComponents,
  setIncludeNestedSuites,
  onClearAllFilters,
  onNewTestCaseClick,
  onExport,
  exportBusy,
  exportSelectedCount,
  toolbarRightSlot,
}: Props) {
  const selectedSuiteName = suites.find((suite) => suite.id === selectedSuite)?.name;
  const ownerLabelById = new Map(ownerOptions.map((owner) => [owner.id, owner.username]));
  const productLabelById = new Map(productOptions.map((product) => [product.id, product.name]));
  const componentLabelById = new Map(componentOptions.map((component) => [component.id, component.name]));
  const selectedOwnerSet = selectedOwnerId ? new Set([selectedOwnerId]) : new Set<string>();

  const statusOptionItems = ["draft", "active", "archived"].map((value) => ({
    value,
    label: formatTestCaseStatusLabel(value),
  }));
  const priorityOptionItems = ["critical", "high", "medium", "low"].map((value) => ({
    value,
    label: capitalize(value),
  }));
  const typeOptionItems = TEST_CASE_TYPE_OPTIONS.map((value) => ({ value, label: formatTestCaseTypeLabel(value) }));
  const tagOptionItems = tagOptions.map((tag) => ({ value: tag, label: tag }));
  const ownerOptionItems = ownerOptions.map((owner) => ({ value: owner.id, label: owner.username }));
  const productOptionItems = productOptions.map((product) => ({ value: product.id, label: product.name }));
  const componentOptionItems = componentOptions.map((component) => ({ value: component.id, label: component.name }));

  // Flat list of active filters rendered as removable chips at the top of the panel.
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [
    ...(selectedSuite && !includeNestedSuites
      ? [{ key: "nested", label: "Direct suite only", onRemove: () => setIncludeNestedSuites(true) }]
      : []),
    ...Array.from(selectedStatuses).map((value) => ({
      key: `status:${value}`,
      label: formatTestCaseStatusLabel(value),
      onRemove: () => onToggleFilter(selectedStatuses, setSelectedStatuses, value),
    })),
    ...Array.from(selectedPriorities).map((value) => ({
      key: `priority:${value}`,
      label: capitalize(value),
      onRemove: () => onToggleFilter(selectedPriorities, setSelectedPriorities, value),
    })),
    ...Array.from(selectedTypes).map((value) => ({
      key: `type:${value}`,
      label: formatTestCaseTypeLabel(value),
      onRemove: () => onToggleFilter(selectedTypes, setSelectedTypes, value),
    })),
    ...(selectedOwnerId
      ? [
          {
            key: `owner:${selectedOwnerId}`,
            label: ownerLabelById.get(selectedOwnerId) ?? selectedOwnerId,
            onRemove: () => onToggleOwner(selectedOwnerId),
          },
        ]
      : []),
    ...Array.from(selectedTags).map((value) => ({
      key: `tag:${value}`,
      label: value,
      onRemove: () => onToggleFilter(selectedTags, setSelectedTags, value),
    })),
    ...Array.from(selectedProducts).map((value) => ({
      key: `product:${value}`,
      label: productLabelById.get(value) ?? value,
      onRemove: () => onToggleFilter(selectedProducts, setSelectedProducts, value),
    })),
    ...Array.from(selectedComponents).map((value) => ({
      key: `component:${value}`,
      label: componentLabelById.get(value) ?? value,
      onRemove: () => onToggleFilter(selectedComponents, setSelectedComponents, value),
    })),
  ];

  return (
    <>
      <PageHeaderSection
        title="Test Cases"
        subtitle={selectedSuite ? `Viewing suite: ${selectedSuiteName}` : "All tests"}
        actions={
          <div className="flex items-center gap-2">
            <TestCaseExportMenu
              label={exportSelectedCount > 0 ? `Export (${exportSelectedCount})` : "Export"}
              busy={exportBusy}
              align="right"
              onSelect={onExport}
            />
            <Button unstyled
              onClick={onNewTestCaseClick}
              className="flex items-center gap-2 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)]"
            >
              <Plus className="h-4 w-4" />
              New Test Case
            </Button>
          </div>
        }
      />
      <SearchFiltersToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchPlaceholder="Search test cases..."
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        activeFiltersCount={activeFiltersCount}
        onClearFilters={onClearAllFilters}
        panelClassName="w-80"
        rightSlot={toolbarRightSlot}
        filtersContent={
          <>
            {activeChips.length > 0 ? (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {activeChips.map((chip) => (
                  <TagChip
                    key={chip.key}
                    variant="fill"
                    removable
                    onRemove={chip.onRemove}
                    removeAriaLabel={`Remove ${chip.label}`}
                  >
                    {chip.label}
                  </TagChip>
                ))}
              </div>
            ) : null}
            {selectedSuite ? (
              <label className="mb-4 flex cursor-pointer items-center justify-between gap-2">
                <span className="text-sm font-medium text-[var(--foreground)]">Include nested suites</span>
                <Switch checked={includeNestedSuites} onCheckedChange={setIncludeNestedSuites} />
              </label>
            ) : null}
            <SearchableFilterChecklistSection
              title="Status"
              options={statusOptionItems}
              selectedValues={selectedStatuses}
              onToggle={(value) => onToggleFilter(selectedStatuses, setSelectedStatuses, value)}
              collapsible
            />
            <SearchableFilterChecklistSection
              title="Priority"
              options={priorityOptionItems}
              selectedValues={selectedPriorities}
              onToggle={(value) => onToggleFilter(selectedPriorities, setSelectedPriorities, value)}
              collapsible
            />
            <SearchableFilterChecklistSection
              title="Type"
              options={typeOptionItems}
              selectedValues={selectedTypes}
              onToggle={(value) => onToggleFilter(selectedTypes, setSelectedTypes, value)}
              collapsible
            />
            <SearchableFilterChecklistSection
              title="Owner"
              mode="single"
              options={ownerOptionItems}
              selectedValues={selectedOwnerSet}
              onToggle={onToggleOwner}
              collapsible
              defaultOpen={false}
              emptyLabel="No owners found"
            />
            <SearchableFilterChecklistSection
              title="Tags"
              options={tagOptionItems}
              selectedValues={selectedTags}
              onToggle={(value) => onToggleFilter(selectedTags, setSelectedTags, value)}
              collapsible
              defaultOpen={false}
              emptyLabel="No tags found"
            />
            <SearchableFilterChecklistSection
              title="Product"
              options={productOptionItems}
              selectedValues={selectedProducts}
              onToggle={(value) => onToggleFilter(selectedProducts, setSelectedProducts, value)}
              collapsible
              defaultOpen={false}
              emptyLabel="No products found"
            />
            <SearchableFilterChecklistSection
              title="Component"
              options={componentOptionItems}
              selectedValues={selectedComponents}
              onToggle={(value) => onToggleFilter(selectedComponents, setSelectedComponents, value)}
              collapsible
              defaultOpen={false}
              emptyLabel="No components found"
            />
          </>
        }
      />
    </>
  );
}
