import { useMemo } from "react";
import { Button } from "@/shared/ui";
import { Modal, StandardModalLayout } from "@/shared/ui/Modal";
import { UnifiedTable, type UnifiedTableColumn } from "@/shared/ui/Table";
import { PerfGroupedTableSection } from "./perf-ui";
import { buildGeneratorBreakdown, buildSystemLoadSeries, formatNumber, formatPercent } from "./perf-utils";
import type { PerfRun, PerfTransaction, PerfTransactionGeneratorResult, PerfSystemLoadSample } from "./types";

type GeneratorRow = {
  key: string;
  label: string;
  /** Per-run set of generator results (null when this run lacks the transaction or generator). */
  values: (PerfTransactionGeneratorResult | null)[];
};

type SystemLoadRow = {
  key: string;
  label: string;
  /** Per-run sample at the same timestamp slot (null when missing). */
  values: (PerfSystemLoadSample | null)[];
};

function findTransaction(run: PerfRun, transactionKey: string): PerfTransaction | undefined {
  return run.transactions.find((tx) => tx.key === transactionKey);
}

/**
 * Drill-down for a single scenario across multiple runs:
 *   - per-generator throughput / p95 / error rate
 *   - aligned system-load samples (when available)
 *
 * Designed for visual side-by-side, not for cross-run delta highlighting.
 */
export function TransactionDetailsCompareModal({
  isOpen,
  onClose,
  transactionKey,
  runs,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  transactionKey: string | null;
  runs: PerfRun[];
}>) {
  const transactionByRun = useMemo(() => {
    if (!transactionKey) return [] as (PerfTransaction | undefined)[];
    return runs.map((r) => findTransaction(r, transactionKey));
  }, [runs, transactionKey]);

  const headerLabel = useMemo(() => {
    const found = transactionByRun.find((tx) => Boolean(tx));
    if (found) return found.label || found.key;
    return transactionKey ?? "";
  }, [transactionByRun, transactionKey]);

  const generatorRows = useMemo<GeneratorRow[]>(() => {
    if (!transactionKey) return [];

    const generatorMaps: Map<string, PerfTransactionGeneratorResult>[] = transactionByRun.map((tx) => {
      const map = new Map<string, PerfTransactionGeneratorResult>();
      if (!tx) return map;
      // Use the same fallback synthesis the run-result panel uses, so demo data also drills down sensibly.
      const generators = buildGeneratorBreakdown(tx);
      generators.forEach((g) => {
        if (!map.has(g.generator)) map.set(g.generator, g);
      });
      return map;
    });

    const orderedKeys: string[] = [];
    generatorMaps.forEach((map) => {
      map.forEach((_value, key) => {
        if (!orderedKeys.includes(key)) orderedKeys.push(key);
      });
    });

    return orderedKeys.map((key) => ({
      key,
      label: key,
      values: generatorMaps.map((map) => map.get(key) ?? null),
    }));
  }, [transactionByRun, transactionKey]);

  const systemLoadRows = useMemo<SystemLoadRow[]>(() => {
    if (!transactionKey) return [];

    const seriesByRun = transactionByRun.map((tx, index) => {
      if (!tx) return new Map<string, PerfSystemLoadSample>();
      const samples = buildSystemLoadSeries(runs[index], tx) ?? [];
      const map = new Map<string, PerfSystemLoadSample>();
      samples.forEach((sample) => {
        if (!map.has(sample.timestamp)) map.set(sample.timestamp, sample);
      });
      return map;
    });

    const orderedTimestamps: string[] = [];
    seriesByRun.forEach((map) => {
      map.forEach((_sample, ts) => {
        if (!orderedTimestamps.includes(ts)) orderedTimestamps.push(ts);
      });
    });

    return orderedTimestamps.map((ts) => ({
      key: ts,
      label: ts,
      values: seriesByRun.map((map) => map.get(ts) ?? null),
    }));
  }, [transactionByRun, runs, transactionKey]);

  const generatorColumns = useMemo<UnifiedTableColumn<GeneratorRow, string>[]>(() => {
    const cols: UnifiedTableColumn<GeneratorRow, string>[] = [
      {
        id: "generator",
        label: "Generator",
        menuLabel: "Generator",
        defaultWidth: 180,
        minWidth: 120,
        nowrap: false,
        cellClassName: "align-top",
        renderCell: (row) => <span className="block font-mono text-xs">{row.label}</span>,
      },
    ];
    runs.forEach((r, index) => {
      const runLabel = `#${index + 1} ${r.name}`;
      cols.push({
        id: `run:${r.id}`,
        label: (
          <div className="space-y-0.5 break-all text-right normal-case">
            <p>{runLabel}</p>
            <p className="opacity-80">{r.tool}</p>
          </div>
        ),
        menuLabel: runLabel,
        defaultWidth: 200,
        minWidth: 176,
        nowrap: false,
        headClassName: "whitespace-normal py-2 align-top text-right",
        cellClassName: "align-top text-right",
        renderCell: (row) => {
          const value = row.values[index];
          if (!value) return <span className="text-[var(--muted-foreground)]">n/a</span>;
          return (
            <div className="space-y-0.5 text-xs">
              <p className="text-sm text-[var(--foreground)]">{formatNumber(Math.round(value.throughputRps))} rps</p>
              <p className="text-[var(--muted-foreground)]">P95: {value.p95Ms} ms</p>
              <p className="text-[var(--muted-foreground)]">
                Errors: {formatPercent(value.errorRatePct, 2)} · {formatNumber(value.failures)} of{" "}
                {formatNumber(value.requests)}
              </p>
            </div>
          );
        },
      });
    });
    return cols;
  }, [runs]);

  const systemLoadColumns = useMemo<UnifiedTableColumn<SystemLoadRow, string>[]>(() => {
    const cols: UnifiedTableColumn<SystemLoadRow, string>[] = [
      {
        id: "time",
        label: "Time",
        menuLabel: "Time",
        defaultWidth: 140,
        minWidth: 100,
        cellClassName: "align-top",
        renderCell: (row) => <span className="font-mono text-xs">{row.label}</span>,
      },
    ];
    runs.forEach((r, index) => {
      const runLabel = `#${index + 1} ${r.name}`;
      cols.push({
        id: `run:${r.id}`,
        label: <div className="text-right normal-case">{runLabel}</div>,
        menuLabel: runLabel,
        defaultWidth: 200,
        minWidth: 160,
        nowrap: false,
        headClassName: "whitespace-normal py-2 text-right align-top",
        cellClassName: "align-top text-right",
        renderCell: (row) => {
          const value = row.values[index];
          if (!value) return <span className="text-[var(--muted-foreground)]">n/a</span>;
          return (
            <div className="space-y-0.5 text-xs">
              <p>CPU {formatPercent(value.cpuPct, 0)}</p>
              <p className="text-[var(--muted-foreground)]">Mem {formatPercent(value.memoryPct, 0)}</p>
              <p className="text-[var(--muted-foreground)]">Disk {Math.round(value.diskIoMBps)} MB/s</p>
            </div>
          );
        },
      });
    });
    return cols;
  }, [runs]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="flex max-h-[min(92vh,920px)] w-[min(96vw,1280px)] max-w-none flex-col overflow-hidden rounded-xl border border-[var(--border)] p-0 sm:max-w-none"
    >
      <StandardModalLayout
        title={headerLabel ? `Scenario details · ${headerLabel}` : "Scenario details"}
        description="Compare per-generator results and aligned system-load samples for this scenario across all selected runs."
        onClose={onClose}
        bodyClassName="space-y-4 px-4 py-3"
        footer={
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Close
          </Button>
        }
      >
        {generatorRows.length > 0 ? (
          <PerfGroupedTableSection groupTitle="Generators">
            <UnifiedTable<GeneratorRow, string>
              className="min-h-0 p-0 flex-none"
              tableName="Generators"
              tableCardFlushTop
              items={generatorRows}
              columns={generatorColumns}
              getRowId={(row) => row.key}
              rowClassName="cursor-default hover:bg-transparent"
              pagination={{ enabled: false }}
              tableClassName="min-w-[900px]"
            />
          </PerfGroupedTableSection>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-6 py-6 text-center text-sm text-[var(--muted-foreground)]">
            No per-generator breakdown is available for this scenario.
          </div>
        )}

        {systemLoadRows.length > 0 ? (
          <PerfGroupedTableSection groupTitle="System load">
            <UnifiedTable<SystemLoadRow, string>
              className="min-h-0 p-0 flex-none"
              tableName="System load"
              tableCardFlushTop
              items={systemLoadRows}
              columns={systemLoadColumns}
              getRowId={(row) => row.key}
              rowClassName="cursor-default hover:bg-transparent"
              pagination={{ enabled: false }}
              tableClassName="min-w-[900px]"
            />
          </PerfGroupedTableSection>
        ) : null}
      </StandardModalLayout>
    </Modal>
  );
}
