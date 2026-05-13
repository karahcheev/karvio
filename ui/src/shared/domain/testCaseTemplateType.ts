export type TestCaseTemplateType = "text" | "steps" | "automated";

export const TEST_CASE_TEMPLATE_TYPE_OPTIONS: readonly TestCaseTemplateType[] = [
  "text",
  "steps",
  "automated",
] as const;

const TEMPLATE_LABELS: Record<TestCaseTemplateType, string> = {
  text: "Text",
  steps: "Steps",
  automated: "Automated",
};

export function formatTestCaseTemplateTypeLabel(value: TestCaseTemplateType | string | null | undefined): string {
  if (!value) return "Unknown";
  const normalized = value.toLowerCase() as TestCaseTemplateType;
  return TEMPLATE_LABELS[normalized] ?? value;
}
