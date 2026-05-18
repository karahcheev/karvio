import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ExternalLink, Layers, Server, SlidersHorizontal } from "lucide-react";
import { Button, UnderlineTabs } from "@/shared/ui";
import { UnifiedTable, type UnifiedTableColumn } from "@/shared/ui/Table";
import { PerfGroupedTableSection } from "./perf-ui";
import {
  buildRunMetricDelta,
  deriveCompareMetricOptions,
  formatRunMetricValue,
  formatTransactionMetricValue,
  getMetricDeltaColor,
  getRunEnvironmentSnapshot,
  getRunMetricValue,
  getTransactionMetricValue,
} from "./perf-utils";
import { TransactionDetailsCompareModal } from "./transaction-details-compare-modal";
import type { CompareMetricKey, PerfRun, PerfTransaction } from "./types";

type ComparisonPivotRow = {
  key: string;
  label: string;
  values: (number | null)[];
};

type ComparisonGroupBlock = {
  group: string | null;
  rows: ComparisonPivotRow[];
};

type ComparisonViewSection = "metrics" | "environment";

const SECTION_TABS: { value: ComparisonViewSection; label: string; icon: React.ReactNode }[] = [
  { value: "metrics", label: "Metrics", icon: <SlidersHorizontal className="h-4 w-4" /> },
  { value: "environment", label: "Environment", icon: <Server className="h-4 w-4" /> },
];

function buildTransactionPivotRow(
  key: string,
  transactionsByRun: Map<string, PerfTransaction>[],
  selectedMetric: CompareMetricKey,
): ComparisonPivotRow {
  const firstFoundTransaction =
    transactionsByRun.map((map) => map.get(key)).find((transaction) => Boolean(transaction)) ?? null;
  const values = transactionsByRun.map((map) => {
    const transaction = map.get(key);
    if (!transaction) return null;
    return getTransactionMetricValue(transaction, selectedMetric);
  });
  return {
    key,
    label: firstFoundTransaction?.label ?? key,
    values,
  };
}

/**
 * Pure comparison rendering: metric/environment switcher + the pivot table.
 * Caller owns the runs[] order — index 0 is the reference run.
 *
 * `projectId` enables in-portal links from the column headers and the row drill-down.
 * The public viewer omits it on purpose — run details require authentication.
 */
export function PerformanceComparisonView({
  runs,
  metricKey,
  onMetricKeyChange,
  projectId,
  toolbar,
}: Readonly<{
  runs: PerfRun[];
  metricKey: CompareMetricKey;
  onMetricKeyChange?: (key: CompareMetricKey) => void;
  projectId?: string;
  toolbar?: React.ReactNode;
}>) {
  const [section, setSection] = useState<ComparisonViewSection>("metrics");
  const [drillDownTransactionKey, setDrillDownTransactionKey] = useState<string | null>(null);

  const metricOptions = useMemo(() => deriveCompareMetricOptions(runs), [runs]);
  const selectedOption = metricOptions.find((o) => o.key === metricKey) ?? metricOptions[0];

  useEffect(() => {
    if (!onMetricKeyChange || metricOptions.length === 0) return;
    if (!metricOptions.some((option) => option.key === metricKey)) {
      onMetricKeyChange(metricOptions[0].key);
    }
  }, [metricOptions, metricKey, onMetricKeyChange]);

  const groupBlocks = useMemo((): ComparisonGroupBlock[] => {
    if (!selectedOption?.supportsTransactions) {
      return [
        {
          group: null,
          rows: [
            {
              key: "overall",
              label: "Overall",
              values: runs.map((r) => getRunMetricValue(r, metricKey)),
            },
          ],
        },
      ];
    }

    const transactionsByRun = runs.map(
      (r) => new Map(r.transactions.map((tx) => [tx.key, tx])),
    );

    const keyToGroup = new Map<string, string>();
    runs.forEach((r) => {
      r.transactions.forEach((tx) => {
        if (!keyToGroup.has(tx.key)) keyToGroup.set(tx.key, tx.group || "General");
      });
    });

    const orderedKeys: string[] = [];
    runs.forEach((r) => {
      r.transactions.forEach((tx) => {
        if (!orderedKeys.includes(tx.key)) orderedKeys.push(tx.key);
      });
    });

    const groupToKeys = new Map<string, string[]>();
    for (const key of orderedKeys) {
      const groupName = keyToGroup.get(key) ?? "General";
      const bucket = groupToKeys.get(groupName);
      if (bucket) bucket.push(key);
      else groupToKeys.set(groupName, [key]);
    }

    const sortedGroupNames = Array.from(groupToKeys.keys()).sort((a, b) => a.localeCompare(b));
    return sortedGroupNames.map((groupName) => {
      const keys = groupToKeys.get(groupName) ?? [];
      const rows = keys.map((key) =>
        buildTransactionPivotRow(key, transactionsByRun, metricKey),
      );
      return { group: groupName, rows };
    });
  }, [runs, metricKey, selectedOption]);

  const tableColumns = useMemo<UnifiedTableColumn<ComparisonPivotRow, string>[]>(() => {
    const cols: UnifiedTableColumn<ComparisonPivotRow, string>[] = [
      {
        id: "test",
        label: "Test",
        menuLabel: "Test",
        defaultWidth: 220,
        minWidth: 160,
        nowrap: false,
        headClassName: "whitespace-normal",
        cellClassName: "align-top",
        renderCell: (row) => (
          <div className="flex items-start justify-between gap-2">
            <span className="block break-words">{row.label}</span>
            {selectedOption?.supportsTransactions && row.key !== "overall" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leftIcon={<Layers className="h-4 w-4" />}
                onClick={(event) => {
                  event.stopPropagation();
                  setDrillDownTransactionKey(row.key);
                }}
                title="Compare per-generator details for this scenario"
              >
                Details
              </Button>
            ) : null}
          </div>
        ),
      },
    ];

    runs.forEach((r, index) => {
      const runLabel = `#${index + 1} ${r.name}`;
      const headerLabel = projectId ? (
        <div className="space-y-0.5 break-all text-right normal-case">
          <Link
            to={`/projects/${projectId}/performance/${r.id}`}
            className="inline-flex items-center gap-1 text-[var(--highlight-foreground)] hover:underline"
          >
            <span>{runLabel}</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
          <p className="opacity-80">{r.tool}</p>
        </div>
      ) : (
        <div className="space-y-0.5 break-all text-right normal-case">
          <p>{runLabel}</p>
          <p className="opacity-80">{r.tool}</p>
        </div>
      );
      cols.push({
        id: `run:${r.id}`,
        label: headerLabel,
        menuLabel: runLabel,
        defaultWidth: 200,
        minWidth: 176,
        nowrap: false,
        headClassName: "whitespace-normal py-2 align-top text-right",
        cellClassName: "align-top text-right",
        renderCell: (row) => {
          const value = row.values[index];
          const baseValue = row.values[0];
          const prevValue = index > 0 ? row.values[index - 1] : null;
          const deltaVsBase =
            index > 0 && value != null && baseValue != null && selectedOption
              ? buildRunMetricDelta(value, baseValue, selectedOption)
              : null;
          const deltaVsPrev =
            index > 1 && value != null && prevValue != null && selectedOption
              ? buildRunMetricDelta(value, prevValue, selectedOption)
              : null;

          let formattedMetric: string;
          if (selectedOption?.supportsTransactions) {
            formattedMetric = formatTransactionMetricValue(metricKey, value);
          } else if (value == null) {
            formattedMetric = "n/a";
          } else {
            formattedMetric = formatRunMetricValue(metricKey, value);
          }

          return (
            <div className="space-y-1 break-words text-right">
              <p className="text-sm text-[var(--foreground)]">{formattedMetric}</p>
              {deltaVsBase ? (
                <p className={`text-xs font-medium ${getMetricDeltaColor(deltaVsBase.impact)}`}>
                  Δ vs #1: {deltaVsBase.label}
                </p>
              ) : null}
              {deltaVsPrev ? (
                <p className={`text-xs font-medium ${getMetricDeltaColor(deltaVsPrev.impact)}`}>
                  Δ vs #{index}: {deltaVsPrev.label}
                </p>
              ) : null}
            </div>
          );
        },
      });
    });

    return cols;
  }, [runs, metricKey, selectedOption, projectId]);

  if (runs.length === 0) {
    return null;
  }

  const metricSelect = onMetricKeyChange ? (
    <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)]">
      <span className="uppercase tracking-wide">Compare by</span>
      <select
        className="h-9 min-w-[180px] rounded-md border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--highlight-border)]"
        value={metricKey}
        onChange={(event) => onMetricKeyChange(event.target.value as CompareMetricKey)}
        disabled={metricOptions.length === 0}
      >
        {metricOptions.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
            {m.supportsTransactions ? "" : " (run summary)"}
          </option>
        ))}
      </select>
    </label>
  ) : (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)]">
      <span className="uppercase tracking-wide">Compare by</span>
      <span className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-2 py-1 text-sm text-[var(--foreground)]">
        {selectedOption?.label ?? metricKey}
      </span>
    </span>
  );

  return (
    <div className="space-y-3">
      <UnderlineTabs value={section} onChange={setSection} items={SECTION_TABS} />

      {section === "metrics" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
            {metricSelect}
            {toolbar}
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            Reference run: <span className="font-medium text-[var(--foreground)]">#1 {runs[0].name}</span>. Each next column
            shows value and Δ vs reference; from the third column it also shows Δ vs the previous run.
          </p>
          <div className="space-y-3">
            {groupBlocks.map((block) => (
              <PerfGroupedTableSection key={block.group ?? "run-summary"} groupTitle={block.group}>
                <UnifiedTable<ComparisonPivotRow, string>
                  className="min-h-0 p-0 flex-none"
                  tableName={block.group ?? "Run summary"}
                  tableCardFlushTop={block.group != null}
                  sectionCollapsible={block.group != null}
                  items={block.rows}
                  columns={tableColumns}
                  getRowId={(row) => row.key}
                  rowClassName="cursor-default hover:bg-transparent"
                  pagination={{ enabled: false }}
                  tableClassName="min-w-[1040px]"
                />
              </PerfGroupedTableSection>
            ))}
          </div>
        </>
      ) : (
        <EnvironmentComparisonTable runs={runs} projectId={projectId} />
      )}

      <TransactionDetailsCompareModal
        isOpen={Boolean(drillDownTransactionKey)}
        onClose={() => setDrillDownTransactionKey(null)}
        transactionKey={drillDownTransactionKey}
        runs={runs}
      />
    </div>
  );
}

type EnvFieldRow = {
  key: string;
  label: string;
  values: (string | number | boolean | null | undefined)[];
};

function formatEnvValue(value: string | number | boolean | null | undefined): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return value.toString();
  return value;
}

function valuesAllAgree(values: EnvFieldRow["values"]): boolean {
  const normalized = values.map((v) => (v == null || v === "" ? null : v));
  const nonNullValues = normalized.filter((v): v is string | number | boolean => v != null);
  if (nonNullValues.length <= 1) return true;
  const [first, ...rest] = nonNullValues;
  return rest.every((value) => value === first);
}

function EnvironmentComparisonTable({
  runs,
  projectId,
}: Readonly<{ runs: PerfRun[]; projectId?: string }>) {
  const fieldRows = useMemo<EnvFieldRow[]>(() => {
    const snapshots = runs.map((r) => getRunEnvironmentSnapshot(r));
    const baseFields: { key: keyof typeof snapshots[number]; label: string }[] = [
      { key: "region", label: "Region" },
      { key: "cluster", label: "Cluster" },
      { key: "namespace", label: "Namespace" },
      { key: "instanceType", label: "Instance type" },
      { key: "cpuCores", label: "CPU cores" },
      { key: "memoryGb", label: "Memory (GB)" },
      { key: "cpuModel", label: "CPU model" },
      { key: "architecture", label: "Architecture" },
      { key: "osSystem", label: "OS" },
      { key: "osRelease", label: "OS release" },
      { key: "pythonVersion", label: "Python version" },
      { key: "pythonImplementation", label: "Python impl." },
      { key: "benchmarkFrameworkVersion", label: "Benchmark framework" },
      { key: "warmupEnabled", label: "Warmup enabled" },
      { key: "roundsTotal", label: "Rounds total" },
      { key: "iterationsTotal", label: "Iterations total" },
    ];
    return baseFields
      .map((field) => ({
        key: String(field.key),
        label: field.label,
        values: snapshots.map((snap) => snap[field.key]),
      }))
      .filter((row) => row.values.some((value) => value != null && value !== ""));
  }, [runs]);

  const columns = useMemo<UnifiedTableColumn<EnvFieldRow, string>[]>(() => {
    const cols: UnifiedTableColumn<EnvFieldRow, string>[] = [
      {
        id: "field",
        label: "Field",
        menuLabel: "Field",
        defaultWidth: 220,
        minWidth: 160,
        nowrap: false,
        cellClassName: "align-top",
        renderCell: (row) => <span className="block break-words font-medium">{row.label}</span>,
      },
    ];
    runs.forEach((r, index) => {
      const runLabel = `#${index + 1} ${r.name}`;
      cols.push({
        id: `run:${r.id}`,
        label: (
          <div className="space-y-0.5 break-all text-left normal-case">
            {projectId ? (
              <Link
                to={`/projects/${projectId}/performance/${r.id}`}
                className="inline-flex items-center gap-1 text-[var(--highlight-foreground)] hover:underline"
              >
                <span>{runLabel}</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            ) : (
              <p>{runLabel}</p>
            )}
            <p className="opacity-80">{r.env}</p>
          </div>
        ),
        menuLabel: runLabel,
        defaultWidth: 200,
        minWidth: 160,
        nowrap: false,
        headClassName: "whitespace-normal py-2 align-top",
        cellClassName: "align-top",
        renderCell: (row) => {
          const value = row.values[index];
          const allMatch = valuesAllAgree(row.values);
          return (
            <span className={allMatch ? "text-[var(--foreground)]" : "font-medium text-[var(--tone-warning-text)]"}>
              {formatEnvValue(value)}
            </span>
          );
        },
      });
    });
    return cols;
  }, [runs, projectId]);

  if (fieldRows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-6 py-8 text-center text-sm text-[var(--muted-foreground)]">
        No environment metadata recorded for these runs.
      </div>
    );
  }

  return (
    <PerfGroupedTableSection groupTitle={null}>
      <UnifiedTable<EnvFieldRow, string>
        className="min-h-0 p-0 flex-none"
        tableName="Environment"
        items={fieldRows}
        columns={columns}
        getRowId={(row) => row.key}
        rowClassName="cursor-default hover:bg-transparent"
        pagination={{ enabled: false }}
        tableClassName="min-w-[1040px]"
      />
    </PerfGroupedTableSection>
  );
}
