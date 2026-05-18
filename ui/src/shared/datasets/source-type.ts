import type { TestDatasetDto } from "@/shared/api";

export const DATASET_SOURCE_TYPE_OPTIONS: ReadonlyArray<TestDatasetDto["source_type"]> = [
  "manual",
  "pytest_parametrize",
  "imported",
];

export function formatDatasetSourceTypeLabel(value: TestDatasetDto["source_type"]): string {
  if (value === "pytest_parametrize") return "Pytest Parametrize";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
