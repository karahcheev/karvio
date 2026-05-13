import type { ComponentDto, ProductDto } from "@/shared/api";
import {
  DateTimeCell,
  OverflowTagList,
  PrimarySecondaryCell,
  StatusBadge,
  type UnifiedTableColumn,
} from "@/shared/ui";
import { getStatusTone, type ComponentColumn, type ProductColumn } from "./config";

export function buildProductColumns(): UnifiedTableColumn<ProductDto, ProductColumn>[] {
  return [
    {
      id: "name",
      label: "Name",
      menuLabel: "Name",
      defaultWidth: 280,
      minWidth: 170,
      locked: true,
      renderCell: (product) => (
        <PrimarySecondaryCell
          primary={product.name}
          secondary={product.description || product.id}
        />
      ),
    },
    {
      id: "status",
      label: "Status",
      menuLabel: "Status",
      defaultWidth: 120,
      minWidth: 100,
      renderCell: (product) => (
        <StatusBadge tone={getStatusTone(product.status)} withBorder>
          {product.status}
        </StatusBadge>
      ),
    },
    {
      id: "owner_id",
      label: "Owner",
      menuLabel: "Owner",
      defaultWidth: 170,
      minWidth: 130,
      renderCell: (product) => <span className="text-sm text-[var(--foreground)]">{product.owner_id ?? "-"}</span>,
    },
    {
      id: "tags",
      label: "Tags",
      menuLabel: "Tags",
      defaultWidth: 220,
      minWidth: 150,
      renderCell: (product) => (
        <OverflowTagList
          tags={product.tags ?? []}
          mode="count"
          maxVisible={2}
          chipVariant="outline"
          emptyContent={<span className="text-sm text-[var(--muted-foreground)]">-</span>}
        />
      ),
    },
    {
      id: "total_components",
      label: "Components",
      menuLabel: "Components",
      defaultWidth: 130,
      minWidth: 110,
      renderCell: (product) => (
        <span className="text-sm text-[var(--foreground)]">
          {product.summary_snapshot?.total_components ?? 0}
        </span>
      ),
    },
    {
      id: "adequately_covered_components",
      label: "Covered",
      menuLabel: "Covered",
      defaultWidth: 120,
      minWidth: 100,
      renderCell: (product) => (
        <span className="text-sm text-[var(--foreground)]">
          {product.summary_snapshot?.adequately_covered_components ?? 0}
        </span>
      ),
    },
    {
      id: "uncovered_components",
      label: "Uncovered",
      menuLabel: "Uncovered",
      defaultWidth: 130,
      minWidth: 110,
      renderCell: (product) => (
        <span className="text-sm text-[var(--foreground)]">
          {product.summary_snapshot?.uncovered_components ?? 0}
        </span>
      ),
    },
    {
      id: "high_risk_uncovered_components",
      label: "High-Risk Uncovered",
      menuLabel: "High-Risk Uncovered",
      defaultWidth: 190,
      minWidth: 150,
      renderCell: (product) => (
        <span className="text-sm text-[var(--destructive)]">
          {product.summary_snapshot?.high_risk_uncovered_components ?? 0}
        </span>
      ),
    },
    {
      id: "mandatory_release_cases",
      label: "Mandatory Cases",
      menuLabel: "Mandatory Cases",
      defaultWidth: 160,
      minWidth: 130,
      renderCell: (product) => (
        <span className="text-sm text-[var(--foreground)]">
          {product.summary_snapshot?.mandatory_release_cases ?? 0}
        </span>
      ),
    },
    {
      id: "updated_at",
      label: "Updated",
      menuLabel: "Updated",
      defaultWidth: 180,
      minWidth: 150,
      renderCell: (product) => <DateTimeCell value={product.updated_at} truncate={false} />,
    },
  ];
}

export function buildComponentColumns(): UnifiedTableColumn<ComponentDto, ComponentColumn>[] {
  return [
    {
      id: "name",
      label: "Name",
      menuLabel: "Name",
      defaultWidth: 280,
      minWidth: 170,
      locked: true,
      renderCell: (component) => (
        <PrimarySecondaryCell
          primary={component.name}
          secondary={component.description || component.id}
        />
      ),
    },
    {
      id: "risk",
      label: "Risk",
      menuLabel: "Risk",
      defaultWidth: 170,
      minWidth: 130,
      renderCell: (component) => (
        <span className="text-sm text-[var(--foreground)]">
          {component.risk_level} ({component.risk_score})
        </span>
      ),
    },
    {
      id: "status",
      label: "Status",
      menuLabel: "Status",
      defaultWidth: 120,
      minWidth: 100,
      renderCell: (component) => (
        <StatusBadge tone={getStatusTone(component.status)} withBorder>
          {component.status}
        </StatusBadge>
      ),
    },
    {
      id: "owner_id",
      label: "Owner",
      menuLabel: "Owner",
      defaultWidth: 170,
      minWidth: 130,
      renderCell: (component) => <span className="text-sm text-[var(--foreground)]">{component.owner_id ?? "-"}</span>,
    },
    {
      id: "tags",
      label: "Tags",
      menuLabel: "Tags",
      defaultWidth: 220,
      minWidth: 150,
      renderCell: (component) => (
        <OverflowTagList
          tags={component.tags ?? []}
          mode="count"
          maxVisible={2}
          chipVariant="outline"
          emptyContent={<span className="text-sm text-[var(--muted-foreground)]">-</span>}
        />
      ),
    },
    {
      id: "updated_at",
      label: "Updated",
      menuLabel: "Updated",
      defaultWidth: 180,
      minWidth: 150,
      renderCell: (component) => <DateTimeCell value={component.updated_at} truncate={false} />,
    },
  ];
}
