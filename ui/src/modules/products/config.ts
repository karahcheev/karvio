import type {
  ComponentFormState,
  ComponentRiskLevel,
  ProductFormState,
  RiskFieldOption,
} from "@/modules/products/components/FormModals";

export type { ComponentRiskLevel } from "@/modules/products/components/FormModals";

export type ProductColumn =
  | "name"
  | "owner_id"
  | "tags"
  | "status"
  | "total_components"
  | "adequately_covered_components"
  | "uncovered_components"
  | "high_risk_uncovered_components"
  | "mandatory_release_cases"
  | "updated_at";
export type ComponentColumn = "name" | "owner_id" | "tags" | "risk" | "status" | "updated_at";
export type ProductStatus = "active" | "archived";

export const DEFAULT_PRODUCT_FORM: ProductFormState = {
  name: "",
  key: "",
  description: "",
};

export const DEFAULT_COMPONENT_FORM: ComponentFormState = {
  name: "",
  key: "",
  description: "",
  business_criticality: 0,
  change_frequency: 0,
  integration_complexity: 0,
  defect_density: 0,
  production_incident_score: 0,
  automation_confidence: 5,
};

export const RISK_VALUES = [0, 1, 2, 3, 4, 5];

export const COMPONENT_RISK_PRESETS: Record<ComponentRiskLevel, Pick<ComponentFormState,
  | "business_criticality"
  | "change_frequency"
  | "integration_complexity"
  | "defect_density"
  | "production_incident_score"
  | "automation_confidence"
>> = {
  low: {
    business_criticality: 1,
    change_frequency: 1,
    integration_complexity: 1,
    defect_density: 1,
    production_incident_score: 1,
    automation_confidence: 5,
  },
  medium: {
    business_criticality: 3,
    change_frequency: 3,
    integration_complexity: 2,
    defect_density: 2,
    production_incident_score: 2,
    automation_confidence: 3,
  },
  high: {
    business_criticality: 4,
    change_frequency: 4,
    integration_complexity: 4,
    defect_density: 3,
    production_incident_score: 4,
    automation_confidence: 2,
  },
  critical: {
    business_criticality: 5,
    change_frequency: 5,
    integration_complexity: 5,
    defect_density: 4,
    production_incident_score: 5,
    automation_confidence: 1,
  },
};

export const PRODUCT_STATUS_OPTIONS: ProductStatus[] = ["active", "archived"];
export const COMPONENT_RISK_LEVEL_OPTIONS: ComponentRiskLevel[] = ["critical", "high", "medium", "low"];

export const DEFAULT_PRODUCT_COLUMNS: ProductColumn[] = [
  "name",
  "status",
  "total_components",
  "uncovered_components",
  "high_risk_uncovered_components",
  "mandatory_release_cases",
  "updated_at",
];
export const DEFAULT_COMPONENT_COLUMNS: ComponentColumn[] = ["name", "risk", "status", "updated_at"];

export const RISK_FIELDS: RiskFieldOption[] = [
  {
    key: "business_criticality",
    label: "Business criticality",
    tooltip: "How severe release impact is if this area fails in production.",
  },
  {
    key: "change_frequency",
    label: "Change frequency",
    tooltip: "How often this area changes. Higher values raise regression risk.",
  },
  {
    key: "integration_complexity",
    label: "Integration complexity",
    tooltip: "How many external/internal integrations make this area fragile.",
  },
  {
    key: "defect_density",
    label: "Defect density",
    tooltip: "Historical bug concentration for this component.",
  },
  {
    key: "production_incident_score",
    label: "Production incidents",
    tooltip: "Observed operational incident pressure in production.",
  },
  {
    key: "automation_confidence",
    label: "Automation confidence",
    tooltip: "Confidence in automated checks. Lower values increase computed risk.",
  },
];

export function getStatusTone(status: ProductStatus) {
  return status === "active" ? "success" : "muted";
}

export function getTotalPages(
  totalItems: number | undefined,
  pageSize: number,
  currentPage: number,
  hasNext: boolean | undefined,
) {
  if (typeof totalItems === "number") {
    return Math.max(1, Math.ceil(totalItems / pageSize));
  }
  return Math.max(1, currentPage + (hasNext ? 1 : 0));
}
