import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import {
  SidePanel,
  SidePanelCard,
  SidePanelMetaRow,
  SidePanelSection,
  type SidePanelProps,
} from "@/shared/ui/SidePanel";

type EntityDetailsPanelLayoutProps = Readonly<
  Omit<SidePanelProps, "children"> & {
    children: ReactNode;
    bodyClassName?: string;
  }
>;

type MetaInfoRow = Readonly<{
  key?: string;
  label: ReactNode;
  value: ReactNode;
  alignTop?: boolean;
  className?: string;
}>;

type MetaInfoCardProps = Readonly<{
  rows: MetaInfoRow[];
  className?: string;
}>;

export function EntityDetailsPanelLayout({
  children,
  bodyClassName,
  ...panelProps
}: EntityDetailsPanelLayoutProps) {
  return (
    <SidePanel {...panelProps}>
      <div className={cn("min-w-0 space-y-5", bodyClassName)}>{children}</div>
    </SidePanel>
  );
}

export function DetailsSection({
  title,
  description,
  className,
  children,
}: Readonly<{
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}>) {
  return (
    <SidePanelSection
      title={title}
      description={description}
      className={className}
    >
      {children}
    </SidePanelSection>
  );
}

export function EntitySummaryCard({
  className,
  children,
}: Readonly<{
  className?: string;
  children: ReactNode;
}>) {
  return <SidePanelCard className={className}>{children}</SidePanelCard>;
}

export function MetaInfoCard({ rows, className }: MetaInfoCardProps) {
  return (
    <EntitySummaryCard className={className}>
      {rows.map((row, index) => (
        <SidePanelMetaRow
          key={row.key ?? `meta-row-${index}`}
          label={row.label}
          value={row.value}
          alignTop={row.alignTop}
          className={row.className}
        />
      ))}
    </EntitySummaryCard>
  );
}
