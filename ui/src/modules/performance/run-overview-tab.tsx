import { useEffect, useMemo, useState } from "react";
import { UnifiedTable, type UnifiedTableColumn } from "@/shared/ui/Table";
import { formatNumber, formatPercent, groupTransactions } from "./perf-utils";
import { PerfGroupedTableSection, ValueWithBaselineDelta } from "./perf-ui";
import { PerformanceResultDetailsPanel } from "./run-result-details-panel";
import type { PerfRun, PerfTransaction } from "./types";

type OverviewTableColumn = "test" | "throughput" | "p95" | "errorRate";

const OVERVIEW_TABLE_COLUMNS: UnifiedTableColumn<PerfTransaction, OverviewTableColumn>[] = [
  {
    id: "test",
    label: "Test",
    menuLabel: "Test",
    defaultWidth: 220,
    minWidth: 160,
    nowrap: false,
    headClassName: "whitespace-normal",
    cellClassName: "align-top",
    renderCell: (transaction) => <span className="block break-words">{transaction.label}</span>,
  },
  {
    id: "throughput",
    label: "Throughput",
    menuLabel: "Throughput",
    defaultWidth: 140,
    minWidth: 120,
    nowrap: false,
    headClassName: "text-right whitespace-normal",
    cellClassName: "align-top text-right",
    renderCell: (transaction) => (
      <ValueWithBaselineDelta
        primary={<>{formatNumber(transaction.throughputRps)} rps</>}
        metric="throughput"
        deltaPct={transaction.deltaThroughputPct}
        deltaPp={null}
      />
    ),
  },
  {
    id: "p95",
    label: "P95",
    menuLabel: "P95",
    defaultWidth: 120,
    minWidth: 100,
    nowrap: false,
    headClassName: "text-right whitespace-normal",
    cellClassName: "align-top text-right",
    renderCell: (transaction) => (
      <ValueWithBaselineDelta
        primary={<>{transaction.p95Ms} ms</>}
        metric="p95"
        deltaPct={transaction.deltaP95Pct}
        deltaPp={null}
      />
    ),
  },
  {
    id: "errorRate",
    label: "Error Rate",
    menuLabel: "Error Rate",
    defaultWidth: 140,
    minWidth: 120,
    nowrap: false,
    headClassName: "text-right whitespace-normal",
    cellClassName: "align-top text-right",
    renderCell: (transaction) => (
      <ValueWithBaselineDelta
        primary={<>{formatPercent(transaction.errorRatePct, 2)}</>}
        metric="error_rate"
        deltaPct={null}
        deltaPp={transaction.deltaErrorRatePp}
      />
    ),
  },
];

export function PerformanceRunOverviewTab({ run }: Readonly<{ run: PerfRun }>) {
  const groupedTransactions = groupTransactions(run.transactions);
  const [selectedTransactionKey, setSelectedTransactionKey] = useState<string | null>(null);
  const selectedTransaction = useMemo(
    () => run.transactions.find((item) => item.key === selectedTransactionKey) ?? null,
    [run.transactions, selectedTransactionKey]
  );

  useEffect(() => {
    if (!selectedTransaction) {
      setSelectedTransactionKey(null);
    }
  }, [selectedTransaction]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Run Results</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Rows always show aggregated values from all load generators. One group renders as one table.
        </p>
        <div className="mt-3 space-y-3">
          {groupedTransactions.map((group) => (
            <PerfGroupedTableSection key={group.group} groupTitle={group.group}>
              <UnifiedTable<PerfTransaction, OverviewTableColumn>
                className="min-h-0 p-0 flex-none"
                tableName={group.group}
                tableCardFlushTop
                sectionCollapsible
                items={group.items}
                columns={OVERVIEW_TABLE_COLUMNS}
                getRowId={(transaction) => transaction.key}
                onRowClick={(transaction) => setSelectedTransactionKey(transaction.key)}
                pagination={{ enabled: false }}
              />
            </PerfGroupedTableSection>
          ))}
        </div>
      </div>

      {selectedTransaction ? (
        <PerformanceResultDetailsPanel
          run={run}
          transaction={selectedTransaction}
          onClose={() => setSelectedTransactionKey(null)}
        />
      ) : null}
    </div>
  );
}
