/** Domain enum for test case type. Must match backend TestCaseType. */
export type TestCaseType = "manual" | "automated";

export const TEST_CASE_TYPE_OPTIONS: readonly TestCaseType[] = ["manual", "automated"] as const;

const TYPE_LABELS: Record<TestCaseType, string> = {
  manual: "Manual",
  automated: "Automated",
};

export function formatTestCaseTypeLabel(type: TestCaseType | string | null | undefined): string {
  if (!type) return "—";
  const normalized = type.toLowerCase() as TestCaseType;
  return TYPE_LABELS[normalized] ?? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}
