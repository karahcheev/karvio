import type { ReactNode } from "react";

type Props = Readonly<{
  title: string;
  children: ReactNode;
}>;

export function OverviewChartCard({ title, children }: Props) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
      <h3 className="mb-3 font-semibold text-[var(--foreground)]">{title}</h3>
      {children}
    </div>
  );
}
