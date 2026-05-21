// Collapsible suite tree with create/delete and selection.
import { Check, ChevronDown, ChevronLeft, ChevronRight, FolderTree, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState, type Dispatch, type DragEvent, type SetStateAction } from "react";
import type { SuiteNode } from "./types";
import { filterSuitesForSearch } from "../lib/suite-tree.utils";
import { Button, SearchField } from "@/shared/ui";

const MAX_SUITE_DEPTH = 4;
const SUITE_DRAG_MIME = "application/x-karvio-suite-id";

type Props = Readonly<{
  suites: SuiteNode[];
  totalCount: number;
  isCollapsed: boolean;
  selectedSuite: string | null;
  expandedSuites: Set<string>;
  isCreatingNewSuite: boolean;
  creatingSuiteParentId: string | null;
  newSuiteInputValue: string;
  setNewSuiteInputValue: Dispatch<SetStateAction<string>>;
  onToggleCollapsed: () => void;
  onSelectSuite: (suiteId: string | null) => void;
  onToggleSuite: (suiteId: string) => void;
  onNewSuiteClick: (parentSuiteId: string | null) => void;
  onDeleteSuite: (suiteId: string) => void;
  canDeleteSuites: boolean;
  onCreateSuite: () => void;
  onCancelNewSuite: () => void;
  editingSuiteId: string | null;
  editSuiteInputValue: string;
  setEditSuiteInputValue: Dispatch<SetStateAction<string>>;
  onEditSuiteClick: (suiteId: string) => void;
  onConfirmEditSuite: () => void;
  onCancelEditSuite: () => void;
  onMoveSuite: (suiteId: string, newParentId: string | null) => void;
}>;

export function TestCasesSuiteTree({
  suites,
  totalCount,
  isCollapsed,
  selectedSuite,
  expandedSuites,
  isCreatingNewSuite,
  creatingSuiteParentId,
  newSuiteInputValue,
  setNewSuiteInputValue,
  onToggleCollapsed,
  onSelectSuite,
  onToggleSuite,
  onNewSuiteClick,
  onDeleteSuite,
  canDeleteSuites,
  onCreateSuite,
  onCancelNewSuite,
  editingSuiteId,
  editSuiteInputValue,
  setEditSuiteInputValue,
  onEditSuiteClick,
  onConfirmEditSuite,
  onCancelEditSuite,
  onMoveSuite,
}: Props) {
  const [suiteSearchQuery, setSuiteSearchQuery] = useState("");
  const [draggingSuiteId, setDraggingSuiteId] = useState<string | null>(null);
  const [dropTargetSuiteId, setDropTargetSuiteId] = useState<string | null | "root">(null);
  const isSuiteSearchActive = suiteSearchQuery.trim().length > 0;
  const filteredSuites = useMemo(
    () => filterSuitesForSearch(suites, suiteSearchQuery),
    [suiteSearchQuery, suites],
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, SuiteNode[]>();
    for (const suite of filteredSuites) {
      const children = map.get(suite.parent) ?? [];
      children.push(suite);
      map.set(suite.parent, children);
    }
    return map;
  }, [filteredSuites]);

  return (
    <div
      className={`flex min-h-0 flex-col border-r border-[var(--border)] bg-[var(--card)] transition-[width] duration-200 ${
        isCollapsed ? "w-14 min-w-[56px]" : "w-[300px] min-w-[260px] max-w-[340px]"
      }`}
    >

      {isCollapsed ? (
        <div className="flex flex-1 flex-col items-center gap-2 p-2">
          <Button unstyled
            onClick={() => onSelectSuite(null)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              selectedSuite === null ? "bg-[var(--highlight-bg-soft)] text-[var(--highlight-foreground)]" : "text-[var(--foreground)] hover:bg-[var(--muted)]"
            }`}
            aria-label="Show all tests"
            title="All Tests"
          >
            <FolderTree className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <div className="border-b border-[var(--border)] p-2">
            <SearchField
              value={suiteSearchQuery}
              onChange={(event) => setSuiteSearchQuery(event.target.value)}
              placeholder="Search suites..."
              aria-label="Search suites"
              inputClassName="h-9"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div
              onDragOver={(event) => {
                if (!draggingSuiteId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTargetSuiteId("root");
              }}
              onDragLeave={() => {
                setDropTargetSuiteId((current) => (current === "root" ? null : current));
              }}
              onDrop={(event) => {
                event.preventDefault();
                const suiteId = event.dataTransfer.getData(SUITE_DRAG_MIME) || draggingSuiteId;
                setDropTargetSuiteId(null);
                setDraggingSuiteId(null);
                if (suiteId) onMoveSuite(suiteId, null);
              }}
              className={`group mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                dropTargetSuiteId === "root"
                  ? "bg-[var(--tone-success-bg)] outline outline-2 outline-[var(--status-passed)]"
                  : selectedSuite === null
                  ? "bg-[var(--highlight-bg-soft)] text-[var(--highlight-foreground)]"
                  : "text-[var(--foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              <Button unstyled
                onClick={() => onSelectSuite(null)}
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                <FolderTree className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">All Tests</span>
                <span className="text-xs text-[var(--muted-foreground)]">{totalCount}</span>
              </Button>
              <Button
                unstyled
                onClick={(e) => {
                  e.stopPropagation();
                  onNewSuiteClick(null);
                }}
                className="opacity-0 group-hover:opacity-100 rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition-opacity"
                aria-label="Add suite"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {isCreatingNewSuite && creatingSuiteParentId === null && (
              <SuiteInputRow
                value={newSuiteInputValue}
                setValue={setNewSuiteInputValue}
                onConfirm={onCreateSuite}
                onCancel={onCancelNewSuite}
              />
            )}

            {(childrenByParent.get(null) ?? []).map((suite) => (
              <SuiteTreeNode
                key={suite.id}
                suite={suite}
                childrenByParent={childrenByParent}
                isSuiteSearchActive={isSuiteSearchActive}
                selectedSuite={selectedSuite}
                expandedSuites={expandedSuites}
                isCreatingNewSuite={isCreatingNewSuite}
                creatingSuiteParentId={creatingSuiteParentId}
                newSuiteInputValue={newSuiteInputValue}
                setNewSuiteInputValue={setNewSuiteInputValue}
                onSelectSuite={onSelectSuite}
                onToggleSuite={onToggleSuite}
                onNewSuiteClick={onNewSuiteClick}
                onDeleteSuite={onDeleteSuite}
                canDeleteSuites={canDeleteSuites}
                onCreateSuite={onCreateSuite}
                onCancelNewSuite={onCancelNewSuite}
                editingSuiteId={editingSuiteId}
                editSuiteInputValue={editSuiteInputValue}
                setEditSuiteInputValue={setEditSuiteInputValue}
                onEditSuiteClick={onEditSuiteClick}
                onConfirmEditSuite={onConfirmEditSuite}
                onCancelEditSuite={onCancelEditSuite}
                draggingSuiteId={draggingSuiteId}
                setDraggingSuiteId={setDraggingSuiteId}
                dropTargetSuiteId={dropTargetSuiteId}
                setDropTargetSuiteId={setDropTargetSuiteId}
                onMoveSuite={onMoveSuite}
              />
            ))}

            {isSuiteSearchActive && filteredSuites.length === 0 ? (
              <div className="px-3 py-4 text-sm text-[var(--muted-foreground)]">
                No suites match this search.
              </div>
            ) : null}
          </div>
        </>
      )}
      <div
        className={`flex h-12 items-center px-2 ${
          isCollapsed ? "justify-center" : "justify-end"
        }`}
      >
        <Button unstyled
          onClick={onToggleCollapsed}
          className={`rounded-lg p-2 text-[var(--muted-foreground)] ${
            isCollapsed ? "bg-[var(--card)] hover:bg-[var(--accent)]" : "hover:bg-[var(--accent)]"
          }`}
          aria-label={isCollapsed ? "Expand suites sidebar" : "Collapse suites sidebar"}
          title={isCollapsed ? "Expand suites sidebar" : "Collapse suites sidebar"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

type SuiteTreeNodeProps = Readonly<{
  suite: SuiteNode;
  childrenByParent: Map<string | null, SuiteNode[]>;
  isSuiteSearchActive: boolean;
  selectedSuite: string | null;
  expandedSuites: Set<string>;
  isCreatingNewSuite: boolean;
  creatingSuiteParentId: string | null;
  newSuiteInputValue: string;
  setNewSuiteInputValue: Dispatch<SetStateAction<string>>;
  onSelectSuite: (suiteId: string | null) => void;
  onToggleSuite: (suiteId: string) => void;
  onNewSuiteClick: (parentSuiteId: string | null) => void;
  onDeleteSuite: (suiteId: string) => void;
  canDeleteSuites: boolean;
  onCreateSuite: () => void;
  onCancelNewSuite: () => void;
  editingSuiteId: string | null;
  editSuiteInputValue: string;
  setEditSuiteInputValue: Dispatch<SetStateAction<string>>;
  onEditSuiteClick: (suiteId: string) => void;
  onConfirmEditSuite: () => void;
  onCancelEditSuite: () => void;
  draggingSuiteId: string | null;
  setDraggingSuiteId: Dispatch<SetStateAction<string | null>>;
  dropTargetSuiteId: string | null | "root";
  setDropTargetSuiteId: Dispatch<SetStateAction<string | null | "root">>;
  onMoveSuite: (suiteId: string, newParentId: string | null) => void;
}>;

function SuiteTreeNode({
  suite,
  childrenByParent,
  isSuiteSearchActive,
  selectedSuite,
  expandedSuites,
  isCreatingNewSuite,
  creatingSuiteParentId,
  newSuiteInputValue,
  setNewSuiteInputValue,
  onSelectSuite,
  onToggleSuite,
  onNewSuiteClick,
  onDeleteSuite,
  canDeleteSuites,
  onCreateSuite,
  onCancelNewSuite,
  editingSuiteId,
  editSuiteInputValue,
  setEditSuiteInputValue,
  onEditSuiteClick,
  onConfirmEditSuite,
  onCancelEditSuite,
  draggingSuiteId,
  setDraggingSuiteId,
  dropTargetSuiteId,
  setDropTargetSuiteId,
  onMoveSuite,
}: SuiteTreeNodeProps) {
  const children = childrenByParent.get(suite.id) ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = isSuiteSearchActive || expandedSuites.has(suite.id);
  const canCreateChildSuite = suite.depth < MAX_SUITE_DEPTH;
  const isEditing = editingSuiteId === suite.id;
  const isDropTarget = dropTargetSuiteId === suite.id && draggingSuiteId !== null && draggingSuiteId !== suite.id;
  const isDraggingSelf = draggingSuiteId === suite.id;

  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(SUITE_DRAG_MIME, suite.id);
    event.dataTransfer.setData("text/plain", suite.id);
    setDraggingSuiteId(suite.id);
  };
  const handleDragEnd = () => {
    setDraggingSuiteId(null);
    setDropTargetSuiteId(null);
  };
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!draggingSuiteId || draggingSuiteId === suite.id) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDropTargetSuiteId(suite.id);
  };
  const handleDragLeave = () => {
    setDropTargetSuiteId((current) => (current === suite.id ? null : current));
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const suiteId = event.dataTransfer.getData(SUITE_DRAG_MIME) || draggingSuiteId;
    setDropTargetSuiteId(null);
    setDraggingSuiteId(null);
    if (suiteId && suiteId !== suite.id) onMoveSuite(suiteId, suite.id);
  };

  if (isEditing) {
    return (
      <div>
        <SuiteInputRow
          value={editSuiteInputValue}
          setValue={setEditSuiteInputValue}
          onConfirm={onConfirmEditSuite}
          onCancel={onCancelEditSuite}
        />
        {hasChildren && isExpanded && (
          <div className="ml-4">
            {children.map((childSuite) => (
              <SuiteTreeNode
                key={childSuite.id}
                suite={childSuite}
                childrenByParent={childrenByParent}
                isSuiteSearchActive={isSuiteSearchActive}
                selectedSuite={selectedSuite}
                expandedSuites={expandedSuites}
                isCreatingNewSuite={isCreatingNewSuite}
                creatingSuiteParentId={creatingSuiteParentId}
                newSuiteInputValue={newSuiteInputValue}
                setNewSuiteInputValue={setNewSuiteInputValue}
                onSelectSuite={onSelectSuite}
                onToggleSuite={onToggleSuite}
                onNewSuiteClick={onNewSuiteClick}
                onDeleteSuite={onDeleteSuite}
                canDeleteSuites={canDeleteSuites}
                onCreateSuite={onCreateSuite}
                onCancelNewSuite={onCancelNewSuite}
                editingSuiteId={editingSuiteId}
                editSuiteInputValue={editSuiteInputValue}
                setEditSuiteInputValue={setEditSuiteInputValue}
                onEditSuiteClick={onEditSuiteClick}
                onConfirmEditSuite={onConfirmEditSuite}
                onCancelEditSuite={onCancelEditSuite}
                draggingSuiteId={draggingSuiteId}
                setDraggingSuiteId={setDraggingSuiteId}
                dropTargetSuiteId={dropTargetSuiteId}
                setDropTargetSuiteId={setDropTargetSuiteId}
                onMoveSuite={onMoveSuite}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${
          isDraggingSelf ? "opacity-50" : ""
        } ${
          isDropTarget
            ? "bg-[var(--tone-success-bg)] outline outline-2 outline-[var(--status-passed)]"
            : selectedSuite === suite.id
            ? "bg-[var(--highlight-bg-soft)] text-[var(--highlight-foreground)]"
            : "text-[var(--foreground)] hover:bg-[var(--muted)]"
        }`}
      >
        <Button
          unstyled
          onClick={() => {
            if (hasChildren) {
              onToggleSuite(suite.id);
            }
            onSelectSuite(suite.id);
          }}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          {(() => {
            if (!hasChildren) {
              return <span className="h-4 w-4" />;
            }
            if (isExpanded) {
              return <ChevronDown className="h-4 w-4" />;
            }
            return <ChevronRight className="h-4 w-4" />;
          })()}
          <span className="flex-1 text-left">{suite.name}</span>
          <span className="flex items-center gap-0.5 text-xs text-[var(--muted-foreground)] min-w-[2rem] justify-end">
            <span className="group-hover:hidden">{suite.count}</span>
            <span className="hidden group-hover:flex items-center gap-0.5">
              {canCreateChildSuite && (
                <Button
                  unstyled
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewSuiteClick(suite.id);
                  }}
                  className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                  aria-label="Add child suite"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              <Button
                unstyled
                onClick={(e) => {
                  e.stopPropagation();
                  onEditSuiteClick(suite.id);
                }}
                className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                aria-label="Edit suite"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {canDeleteSuites ? (
                <Button
                  unstyled
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSuite(suite.id);
                  }}
                  className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--tone-danger-bg)] hover:text-[var(--status-failure)]"
                  aria-label="Delete suite"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </span>
          </span>
        </Button>
      </div>

      {(hasChildren || (isCreatingNewSuite && creatingSuiteParentId === suite.id && canCreateChildSuite)) && isExpanded && (
        <div className="ml-4">
          {isCreatingNewSuite && creatingSuiteParentId === suite.id && canCreateChildSuite && (
            <SuiteInputRow
              value={newSuiteInputValue}
              setValue={setNewSuiteInputValue}
              onConfirm={onCreateSuite}
              onCancel={onCancelNewSuite}
            />
          )}

          {children.map((childSuite) => (
            <SuiteTreeNode
              key={childSuite.id}
              suite={childSuite}
              childrenByParent={childrenByParent}
              isSuiteSearchActive={isSuiteSearchActive}
              selectedSuite={selectedSuite}
              expandedSuites={expandedSuites}
              isCreatingNewSuite={isCreatingNewSuite}
              creatingSuiteParentId={creatingSuiteParentId}
              newSuiteInputValue={newSuiteInputValue}
              setNewSuiteInputValue={setNewSuiteInputValue}
              onSelectSuite={onSelectSuite}
              onToggleSuite={onToggleSuite}
              onNewSuiteClick={onNewSuiteClick}
              onDeleteSuite={onDeleteSuite}
              canDeleteSuites={canDeleteSuites}
              onCreateSuite={onCreateSuite}
              onCancelNewSuite={onCancelNewSuite}
              editingSuiteId={editingSuiteId}
              editSuiteInputValue={editSuiteInputValue}
              setEditSuiteInputValue={setEditSuiteInputValue}
              onEditSuiteClick={onEditSuiteClick}
              onConfirmEditSuite={onConfirmEditSuite}
              onCancelEditSuite={onCancelEditSuite}
              draggingSuiteId={draggingSuiteId}
              setDraggingSuiteId={setDraggingSuiteId}
              dropTargetSuiteId={dropTargetSuiteId}
              setDropTargetSuiteId={setDropTargetSuiteId}
              onMoveSuite={onMoveSuite}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type SuiteInputRowProps = Readonly<{
  value: string;
  setValue: Dispatch<SetStateAction<string>>;
  onConfirm: () => void;
  onCancel: () => void;
}>;

function SuiteInputRow({ value, setValue, onConfirm, onCancel }: SuiteInputRowProps) {
  return (
    <div className="mb-1 flex items-center gap-1 rounded-lg bg-[var(--highlight-bg-soft)] px-3 py-2">
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && value.trim()) {
            onConfirm();
          } else if (event.key === "Escape") {
            onCancel();
          }
        }}
        placeholder="Suite name..."
        className="flex-1 border-0 bg-transparent px-0 py-0 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-0"
        autoFocus
      />
      <Button unstyled
        onClick={onConfirm}
        disabled={!value.trim()}
        className="rounded p-1 text-[var(--status-passed)] hover:bg-[var(--tone-success-bg)] disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button unstyled onClick={onCancel} className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)]">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
