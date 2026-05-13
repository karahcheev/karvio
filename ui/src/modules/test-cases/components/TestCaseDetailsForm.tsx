import { TestCaseDetailsEditForm } from "./TestCaseDetailsEditForm";
import { TestCaseDetailsReadView } from "./TestCaseDetailsReadView";
import type { TestCaseDetailsFormProps } from "./TestCaseDetailsForm.types";

export function TestCaseDetailsForm({
  isEditing,
  templateType,
  testCaseType,
  ...props
}: TestCaseDetailsFormProps) {
  // Automated template always forces case type to automated; the type select is disabled.
  const effectiveTestCaseType = templateType === "automated" ? "automated" : testCaseType;
  const testCaseTypeLocked = templateType === "automated";

  const sharedProps = {
    ...props,
    isEditing,
    templateType,
    testCaseType,
    effectiveTestCaseType,
    testCaseTypeLocked,
  };

  return isEditing ? <TestCaseDetailsEditForm {...sharedProps} /> : <TestCaseDetailsReadView {...sharedProps} />;
}
