import { useMemo } from "react";
import {
  SidePanel,
  SidePanelCard,
  SidePanelMetaRow,
  SidePanelSection,
  SidePanelStat,
  SidePanelStatGrid,
  StatusBadge,
} from "@/shared/ui";
import { UnifiedTable, type UnifiedTableColumn } from "@/shared/ui/Table";
import {
  buildGeneratorBreakdown,
  buildResultArtifacts,
  buildResultLogs,
  buildSystemLoadSeries,
  formatNumber,
  formatPercent,
  getLoadKindLabel,
  getLoadKindTone,
  getRunLoadKind,
  getTransactionDescription,
  getTransactionRunCommand,
} from "./perf-utils";
import { ValueWithBaselineDelta } from "./perf-ui";
import type {
  PerfRun,
  PerfSystemLoadSample,
  PerfTransaction,
  PerfTransactionGeneratorResult,
} from "./types";

type PerfGeneratorColumnId =
  | "generator"
  | "requests"
  | "failures"
  | "throughput"
  | "p95"
  | "error_rate";

const PERF_GENERATOR_TABLE_COLUMNS: UnifiedTableColumn<PerfTransactionGeneratorResult, PerfGeneratorColumnId>[] = [
  {
    id: "generator",
    label: "Generator",
    menuLabel: "Generator",
    defaultWidth: 160,
    minWidth: 120,
    locked: true,
    renderCell: (item) => item.generator,
  },
  {
    id: "requests",
    label: "Requests",
    menuLabel: "Requests",
    headClassName: "text-right",
    cellClassName: "text-right",
    defaultWidth: 104,
    minWidth: 80,
    renderCell: (item) => formatNumber(item.requests),
  },
  {
    id: "failures",
    label: "Failures",
    menuLabel: "Failures",
    headClassName: "text-right",
    cellClassName: "text-right",
    defaultWidth: 96,
    minWidth: 72,
    renderCell: (item) => formatNumber(item.failures),
  },
  {
    id: "throughput",
    label: "Throughput",
    menuLabel: "Throughput",
    headClassName: "text-right",
    cellClassName: "text-right",
    defaultWidth: 120,
    minWidth: 96,
    renderCell: (item) => <>{formatNumber(item.throughputRps)} rps</>,
  },
  {
    id: "p95",
    label: "P95",
    menuLabel: "P95",
    headClassName: "text-right",
    cellClassName: "text-right",
    defaultWidth: 88,
    minWidth: 72,
    renderCell: (item) => <>{item.p95Ms} ms</>,
  },
  {
    id: "error_rate",
    label: "Error Rate",
    menuLabel: "Error rate",
    headClassName: "text-right",
    cellClassName: "text-right",
    defaultWidth: 112,
    minWidth: 88,
    renderCell: (item) => formatPercent(item.errorRatePct, 2),
  },
];

type PerfSystemLoadColumnId = "time" | "cpu" | "memory" | "disk_io";

const PERF_SYSTEM_LOAD_TABLE_COLUMNS: UnifiedTableColumn<PerfSystemLoadSample, PerfSystemLoadColumnId>[] = [
  {
    id: "time",
    label: "Time",
    menuLabel: "Time",
    defaultWidth: 200,
    minWidth: 140,
    locked: true,
    renderCell: (item) => item.timestamp,
  },
  {
    id: "cpu",
    label: "CPU",
    menuLabel: "CPU",
    headClassName: "text-right",
    cellClassName: "text-right",
    defaultWidth: 88,
    minWidth: 72,
    renderCell: (item) => formatPercent(item.cpuPct, 0),
  },
  {
    id: "memory",
    label: "Memory",
    menuLabel: "Memory",
    headClassName: "text-right",
    cellClassName: "text-right",
    defaultWidth: 104,
    minWidth: 80,
    renderCell: (item) => formatPercent(item.memoryPct, 0),
  },
  {
    id: "disk_io",
    label: "Disk IO",
    menuLabel: "Disk IO",
    headClassName: "text-right",
    cellClassName: "text-right",
    defaultWidth: 112,
    minWidth: 88,
    renderCell: (item) => <>{item.diskIoMBps} MB/s</>,
  },
];

export function PerformanceResultDetailsPanel({
  run,
  transaction,
  onClose,
}: Readonly<{
  run: PerfRun;
  transaction: PerfTransaction;
  onClose: () => void;
}>) {
  const generatorResults = useMemo(() => buildGeneratorBreakdown(transaction), [transaction]);
  const systemLoad = useMemo(() => buildSystemLoadSeries(run, transaction), [run, transaction]);
  const logs = useMemo(() => buildResultLogs(run, transaction), [run, transaction]);
  const artifacts = useMemo(() => buildResultArtifacts(run, transaction), [run, transaction]);
  const description = useMemo(() => getTransactionDescription(run, transaction), [run, transaction]);
  const runCommand = useMemo(() => getTransactionRunCommand(run, transaction), [run, transaction]);

  const totalRequests = generatorResults.reduce((sum, item) => sum + item.requests, 0);
  const totalFailures = generatorResults.reduce((sum, item) => sum + item.failures, 0);
  const aggregatedErrorRate = totalRequests > 0 ? (totalFailures / totalRequests) * 100 : transaction.errorRatePct;

  return (
    <SidePanel
      title={transaction.label}
      subtitle={
        <p className="text-sm text-[var(--muted-foreground)]">
          Aggregated across all active generators for run <span className="font-mono">{run.id}</span>
        </p>
      }
      eyebrow={
        <>
          <StatusBadge tone={getLoadKindTone(getRunLoadKind(run))} withBorder>
            {getLoadKindLabel(getRunLoadKind(run))}
          </StatusBadge>
          <StatusBadge tone="neutral" withBorder>
            Group: {transaction.group}
          </StatusBadge>
        </>
      }
      onClose={onClose}
    >
      <div className="space-y-5">
        <SidePanelSection title="Aggregated Data">
          <SidePanelStatGrid className="grid-cols-2">
            <SidePanelStat
              label="Throughput"
              value={
                <ValueWithBaselineDelta
                  primary={<>{formatNumber(transaction.throughputRps)} rps</>}
                  metric="throughput"
                  deltaPct={transaction.deltaThroughputPct}
                  deltaPp={null}
                />
              }
            />
            <SidePanelStat
              label="P95"
              value={
                <ValueWithBaselineDelta
                  primary={<>{transaction.p95Ms} ms</>}
                  metric="p95"
                  deltaPct={transaction.deltaP95Pct}
                  deltaPp={null}
                />
              }
            />
            <SidePanelStat
              label="Error Rate"
              value={
                <ValueWithBaselineDelta
                  primary={<>{formatPercent(aggregatedErrorRate, 2)}</>}
                  metric="error_rate"
                  deltaPct={null}
                  deltaPp={transaction.deltaErrorRatePp}
                />
              }
            />
          </SidePanelStatGrid>
        </SidePanelSection>

        <SidePanelSection title="Run Metadata">
          <SidePanelCard>
            <SidePanelMetaRow label="Description" value={description} alignTop />
            <SidePanelMetaRow
              label="Run Command"
              value={<code className="break-all text-xs text-[var(--foreground)]">{runCommand}</code>}
              alignTop
            />
            <SidePanelMetaRow label="Scenario" value={run.scenario} />
            <SidePanelMetaRow label="Load Profile" value={run.loadProfile} />
            <SidePanelMetaRow label="Environment" value={run.env} />
            <SidePanelMetaRow label="Tool" value={run.tool} />
          </SidePanelCard>
        </SidePanelSection>

        <SidePanelSection title="Results by Generators" description="Per-generator contribution under the aggregated result.">
          <UnifiedTable
            className="bg-transparent p-0"
            tableName="Results by generator"
            items={generatorResults}
            columns={PERF_GENERATOR_TABLE_COLUMNS}
            getRowId={(item) => item.generator}
            pagination={{ enabled: false }}
            stickyFirstColumn
            rowClassName="cursor-default hover:bg-transparent"
          />
        </SidePanelSection>

        {systemLoad && systemLoad.length > 0 ? (
          <SidePanelSection title="System Load During Test">
            <UnifiedTable
              className="bg-transparent p-0"
              tableName="System load during test"
              items={systemLoad}
              columns={PERF_SYSTEM_LOAD_TABLE_COLUMNS}
              getRowId={(item) => item.timestamp}
              pagination={{ enabled: false }}
              stickyFirstColumn
              rowClassName="cursor-default hover:bg-transparent"
            />
          </SidePanelSection>
        ) : null}

        <SidePanelSection title="Logs">
          <SidePanelCard>
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[var(--popover)] p-3 text-xs text-[var(--foreground)]">
              {logs.join("\n")}
            </pre>
          </SidePanelCard>
        </SidePanelSection>

        <SidePanelSection title="Artifacts">
          <SidePanelCard className="space-y-2">
            {artifacts.map((artifact) => (
              <a
                key={artifact.href}
                href={artifact.href}
                className="block text-sm text-[var(--highlight-foreground)] hover:text-[var(--highlight-foreground)] hover:underline"
              >
                {artifact.label}
              </a>
            ))}
          </SidePanelCard>
        </SidePanelSection>
      </div>
    </SidePanel>
  );
}
