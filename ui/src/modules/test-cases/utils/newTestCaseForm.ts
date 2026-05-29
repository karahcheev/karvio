import type { NewTestCaseForm } from "./types";

export function isNewTestCaseFormDirty(form: NewTestCaseForm, defaultOwnerId = "unassigned"): boolean {
  const defaults = createDefaultNewTestCaseForm(defaultOwnerId);
  const anyTextFilled = [
    form.title,
    form.automationId,
    form.preconditions,
    form.stepsText,
    form.expected,
    form.rawTest,
    form.time,
    form.tagInput,
  ].some((value) => value.trim().length > 0);
  if (anyTextFilled) return true;
  if (form.ownerId !== defaults.ownerId) return true;
  if (form.primaryProductId !== defaults.primaryProductId) return true;
  if (form.tags.length > 0) return true;
  if (form.componentCoverages.length > 0) return true;
  if (form.steps.length > 0) return true;
  if (form.steps.some((step) => step.action.trim() || step.expectedResult.trim())) return true;
  return (
    form.templateType !== defaults.templateType ||
    form.priority !== defaults.priority ||
    form.testCaseType !== defaults.testCaseType ||
    form.rawTestLanguage !== defaults.rawTestLanguage ||
    form.status !== defaults.status
  );
}

export function createDefaultNewTestCaseForm(ownerId = "unassigned"): NewTestCaseForm {
  return {
    title: "",
    templateType: "steps",
    automationId: "",
    preconditions: "",
    stepsText: "",
    expected: "",
    rawTest: "",
    rawTestLanguage: "python",
    status: "draft",
    time: "",
    priority: "medium",
    testCaseType: "manual",
    ownerId,
    primaryProductId: "none",
    tags: [],
    tagInput: "",
    steps: [],
    componentCoverages: [],
  };
}
