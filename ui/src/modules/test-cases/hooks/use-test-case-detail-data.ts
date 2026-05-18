import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { useAllComponentsQuery, useAllProductsQuery, useProjectMembersQuery, useSuitesQuery, useTestCaseDetailQuery } from "@/shared/api";
import { getSessionUser } from "@/shared/auth";
import { notifyError } from "@/shared/lib/notifications";
import { cloneSnapshot, mapApiCoverage, mapApiStep, normalizeStepsForSave } from "@/modules/test-cases/utils/testCaseEditorUtils";
import type { EditableCoverage, EditableStep, EditorSnapshot, OwnerOption, ProjectRole } from "@/modules/test-cases/utils/testCaseEditorTypes";
import type { AttachmentDto, ExternalIssueLinkDto } from "@/shared/api";
import type { TestCasePriority } from "@/shared/domain/priority";
import type { TestCaseTemplateType } from "@/shared/domain/testCaseTemplateType";
import type { TestCaseType } from "@/shared/domain/testCaseType";

export interface TestCaseDetailDataState {
  key: string;
  createdAt: string | null;
  updatedAt: string | null;
  title: string;
  templateType: TestCaseTemplateType;
  automationId: string | null;
  preconditions: string | null;
  stepsText: string | null;
  expected: string | null;
  rawTest: string | null;
  rawTestLanguage: string | null;
  time: string | null;
  priority: TestCasePriority;
  status: "draft" | "active" | "archived";
  testCaseType: TestCaseType;
  persistedStatus: "draft" | "active" | "archived";
  currentProjectRole: ProjectRole;
  datasetsCount: number;
  ownerId: string;
  primaryProductId: string;
  suiteId: string;
  tags: string[];
  componentCoverages: EditableCoverage[];
  steps: EditableStep[];
  initialStepSignature: string;
  owners: OwnerOption[];
  products: Array<{ id: string; name: string }>;
  components: Array<{ id: string; name: string }>;
  suites: Array<{ id: string; name: string }>;
  testCaseAttachments: AttachmentDto[];
  stepAttachments: Record<string, AttachmentDto[]>;
  externalIssues: ExternalIssueLinkDto[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface TestCaseDetailDataSetters {
  setTitle: (v: string | ((prev: string) => string)) => void;
  setTemplateType: (v: TestCaseTemplateType | ((prev: TestCaseTemplateType) => TestCaseTemplateType)) => void;
  setAutomationId: (v: string | null | ((prev: string | null) => string | null)) => void;
  setTime: (v: string | null | ((prev: string | null) => string | null)) => void;
  setPriority: (v: TestCasePriority | ((prev: TestCasePriority) => TestCasePriority)) => void;
  setStatus: (v: "draft" | "active" | "archived" | ((prev: "draft" | "active" | "archived") => "draft" | "active" | "archived")) => void;
  setTestCaseType: (v: TestCaseType | ((prev: TestCaseType) => TestCaseType)) => void;
  setPersistedStatus: (v: "draft" | "active" | "archived" | ((prev: "draft" | "active" | "archived") => "draft" | "active" | "archived")) => void;
  setOwnerId: (v: string | ((prev: string) => string)) => void;
  setPrimaryProductId: (v: string | ((prev: string) => string)) => void;
  setSuiteId: (v: string | ((prev: string) => string)) => void;
  setTags: (v: string[] | ((prev: string[]) => string[])) => void;
  setComponentCoverages: (v: EditableCoverage[] | ((prev: EditableCoverage[]) => EditableCoverage[])) => void;
  setSteps: (v: EditableStep[] | ((prev: EditableStep[]) => EditableStep[])) => void;
  setInitialStepSignature: (v: string | ((prev: string) => string)) => void;
  setTestCaseAttachments: (v: AttachmentDto[] | ((prev: AttachmentDto[]) => AttachmentDto[])) => void;
  setStepAttachments: (v: Record<string, AttachmentDto[]> | ((prev: Record<string, AttachmentDto[]>) => Record<string, AttachmentDto[]>)) => void;
  setExternalIssues: (v: ExternalIssueLinkDto[] | ((prev: ExternalIssueLinkDto[]) => ExternalIssueLinkDto[])) => void;
  setUpdatedAt: (v: string | null | ((prev: string | null) => string | null)) => void;
  setPreconditions: (v: string | null | ((prev: string | null) => string | null)) => void;
  setStepsText: (v: string | null | ((prev: string | null) => string | null)) => void;
  setExpected: (v: string | null | ((prev: string | null) => string | null)) => void;
  setRawTest: (v: string | null | ((prev: string | null) => string | null)) => void;
  setRawTestLanguage: (v: string | null | ((prev: string | null) => string | null)) => void;
}

type DataApi = TestCaseDetailDataState &
  TestCaseDetailDataSetters & { ownerLabel: string; productLabel: string; suiteLabel: string; initialSnapshot: EditorSnapshot | null };

function syncQueryToState(
  data: NonNullable<ReturnType<typeof useTestCaseDetailQuery>["data"]>,
  setters: {
    setKey: (v: string) => void;
    setCreatedAt: (v: string | null) => void;
    setUpdatedAt: (v: string | null) => void;
    setTitle: (v: string) => void;
    setTemplateType: (v: TestCaseTemplateType) => void;
    setAutomationId: (v: string | null) => void;
    setTime: (v: string | null) => void;
    setPreconditions: (v: string | null) => void;
    setStepsText: (v: string | null) => void;
    setExpected: (v: string | null) => void;
    setRawTest: (v: string | null) => void;
    setRawTestLanguage: (v: string | null) => void;
    setPriority: (v: TestCasePriority) => void;
    setStatus: (v: "draft" | "active" | "archived") => void;
    setTestCaseType: (v: TestCaseType) => void;
    setPersistedStatus: (v: "draft" | "active" | "archived") => void;
    setDatasetsCount: (v: number) => void;
    setOwnerId: (v: string) => void;
    setPrimaryProductId: (v: string) => void;
    setSuiteId: (v: string) => void;
    setTags: (v: string[]) => void;
    setComponentCoverages: (v: EditableCoverage[]) => void;
    setSteps: (v: EditableStep[]) => void;
    setInitialStepSignature: (v: string) => void;
    setTestCaseAttachments: (v: AttachmentDto[]) => void;
    setStepAttachments: (v: Record<string, AttachmentDto[]>) => void;
    setExternalIssues: (v: ExternalIssueLinkDto[]) => void;
    setOwners: (v: OwnerOption[]) => void;
    setCurrentProjectRole: (v: ProjectRole) => void;
  },
) {
  const { testCase, stepItems, caseFiles, stepAttachments } = data;
  const sessionUser = getSessionUser();
  const nextProjectRole =
    sessionUser?.role === "admin"
      ? "manager"
      : sessionUser?.project_memberships.find((membership) => membership.project_id === testCase.project_id)?.role ?? null;
  const editableSteps = stepItems.map(mapApiStep);

  setters.setKey(testCase.key);
  setters.setCreatedAt(testCase.created_at);
  setters.setUpdatedAt(testCase.updated_at);
  setters.setTitle(testCase.title);
  setters.setTemplateType(testCase.template_type ?? "steps");
  setters.setAutomationId(testCase.automation_id ?? null);
  setters.setTime(testCase.time ?? null);
  setters.setPreconditions(testCase.preconditions ?? null);
  setters.setStepsText(testCase.steps_text ?? null);
  setters.setExpected(testCase.expected ?? null);
  setters.setRawTest(testCase.raw_test ?? null);
  setters.setRawTestLanguage(testCase.raw_test_language ?? null);
  setters.setPriority(testCase.priority ?? "medium");
  setters.setStatus(testCase.status);
  setters.setTestCaseType(testCase.test_case_type ?? "manual");
  setters.setPersistedStatus(testCase.status);
  setters.setCurrentProjectRole(nextProjectRole);
  setters.setDatasetsCount(testCase.dataset_bindings?.length ?? 0);
  setters.setOwnerId(testCase.owner_id ?? "unassigned");
  setters.setPrimaryProductId(testCase.primary_product_id ?? "none");
  setters.setSuiteId(testCase.suite_id ?? "unsorted");
  setters.setTags(testCase.tags);
  setters.setComponentCoverages((testCase.component_coverages ?? []).map(mapApiCoverage));
  setters.setExternalIssues(testCase.external_issues ?? []);
  setters.setSteps(editableSteps);
  setters.setInitialStepSignature(JSON.stringify(normalizeStepsForSave(editableSteps)));
  setters.setTestCaseAttachments(caseFiles);
  setters.setStepAttachments(stepAttachments);
}

export function useTestCaseDetailData(loadSuites = false, loadProjectMembers = false): DataApi {
  const { projectId, testCaseId } = useParams();
  const query = useTestCaseDetailQuery(projectId, testCaseId);
  const suitesQuery = useSuitesQuery(projectId, loadSuites);
  const projectMembersQuery = useProjectMembersQuery(projectId, loadProjectMembers);
  const productsQuery = useAllProductsQuery(projectId);
  const componentsQuery = useAllComponentsQuery(projectId);

  const [key, setKey] = useState("");
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [templateType, setTemplateType] = useState<TestCaseTemplateType>("steps");
  const [automationId, setAutomationId] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [preconditions, setPreconditions] = useState<string | null>(null);
  const [stepsText, setStepsText] = useState<string | null>(null);
  const [expected, setExpected] = useState<string | null>(null);
  const [rawTest, setRawTest] = useState<string | null>(null);
  const [rawTestLanguage, setRawTestLanguage] = useState<string | null>(null);
  const [priority, setPriority] = useState<TestCasePriority>("medium");
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [testCaseType, setTestCaseType] = useState<TestCaseType>("manual");
  const [persistedStatus, setPersistedStatus] = useState<"draft" | "active" | "archived">("draft");
  const [currentProjectRole, setCurrentProjectRole] = useState<ProjectRole>(null);
  const [datasetsCount, setDatasetsCount] = useState(0);
  const [ownerId, setOwnerId] = useState("unassigned");
  const [primaryProductId, setPrimaryProductId] = useState("none");
  const [suiteId, setSuiteId] = useState("unsorted");
  const [tags, setTags] = useState<string[]>([]);
  const [componentCoverages, setComponentCoverages] = useState<EditableCoverage[]>([]);
  const [steps, setSteps] = useState<EditableStep[]>([]);
  const [initialStepSignature, setInitialStepSignature] = useState("[]");
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [suites, setSuites] = useState<Array<{ id: string; name: string }>>([]);
  const [testCaseAttachments, setTestCaseAttachments] = useState<AttachmentDto[]>([]);
  const [stepAttachments, setStepAttachments] = useState<Record<string, AttachmentDto[]>>({});
  const [externalIssues, setExternalIssues] = useState<ExternalIssueLinkDto[]>([]);

  useEffect(() => {
    if (query.data) {
      syncQueryToState(query.data, {
        setKey,
        setCreatedAt,
        setUpdatedAt,
        setTitle,
        setTemplateType,
        setAutomationId,
        setTime,
        setPreconditions,
        setStepsText,
        setExpected,
        setRawTest,
        setRawTestLanguage,
        setPriority,
        setStatus,
        setTestCaseType,
        setPersistedStatus,
        setDatasetsCount,
        setOwnerId,
        setPrimaryProductId,
        setSuiteId,
        setTags,
        setComponentCoverages,
        setSteps,
        setInitialStepSignature,
        setTestCaseAttachments,
        setStepAttachments,
        setExternalIssues,
        setOwners,
        setCurrentProjectRole,
      });
    }
  }, [query.data]);

  useEffect(() => {
    if (suitesQuery.data) {
      setSuites(suitesQuery.data.map((suite) => ({ id: suite.id, name: suite.name })));
    }
  }, [suitesQuery.data]);

  useEffect(() => {
    if (projectMembersQuery.data) {
      setOwners(
        projectMembersQuery.data
          .map((member) => ({ id: member.user_id, username: member.username ?? "Unknown user" }))
          .sort((left, right) => left.username.localeCompare(right.username)),
      );
    }
  }, [projectMembersQuery.data]);

  useEffect(() => {
    if (query.isError) {
      notifyError(query.error, "Failed to load test case.");
    }
  }, [query.isError, query.error]);

  const isLoading = query.isLoading;
  const error = query.isError ? (query.error instanceof Error ? query.error.message : "Failed to load test case.") : null;

  const initialSnapshot = useMemo<EditorSnapshot | null>(() => {
    if (isLoading) return null;
    return cloneSnapshot({
      title,
      templateType,
      automationId,
      stepsText,
      expected,
      rawTest,
      rawTestLanguage,
      time,
      priority,
      status,
      testCaseType,
      ownerId,
      primaryProductId,
      suiteId,
      tags,
      componentCoverages,
      steps,
      preconditions,
      testCaseAttachments,
      stepAttachments,
    });
  }, [
    isLoading,
    title,
    templateType,
    automationId,
    stepsText,
    expected,
    rawTest,
    rawTestLanguage,
    time,
    priority,
    status,
    testCaseType,
    ownerId,
    primaryProductId,
    suiteId,
    tags,
    componentCoverages,
    steps,
    preconditions,
    testCaseAttachments,
    stepAttachments,
  ]);

  const ownerLabel = useMemo(
    () => owners.find((owner) => owner.id === ownerId)?.username ?? query.data?.testCase.owner_name ?? "Unassigned",
    [ownerId, owners, query.data?.testCase.owner_name],
  );
  const products = useMemo(
    () =>
      (productsQuery.data ?? [])
        .map((product) => ({ id: product.id, name: product.name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [productsQuery.data],
  );
  const components = useMemo(
    () =>
      (componentsQuery.data ?? [])
        .map((component) => ({ id: component.id, name: component.name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [componentsQuery.data],
  );
  const productLabel = useMemo(() => {
    if (primaryProductId === "none") return "None";
    return products.find((product) => product.id === primaryProductId)?.name ?? primaryProductId;
  }, [primaryProductId, products]);
  const suiteLabel = useMemo(
    () => suites.find((suite) => suite.id === suiteId)?.name ?? query.data?.testCase.suite_name ?? "Unsorted",
    [suiteId, suites, query.data?.testCase.suite_name],
  );

  return {
    key,
    createdAt,
    updatedAt,
    setUpdatedAt,
    title,
    templateType,
    automationId,
    time,
    preconditions,
    stepsText,
    expected,
    rawTest,
    rawTestLanguage,
    priority,
    status,
    testCaseType,
    persistedStatus,
    currentProjectRole,
    datasetsCount,
    ownerId,
    primaryProductId,
    suiteId,
    tags,
    componentCoverages,
    steps,
    initialStepSignature,
    owners,
    products,
    components,
    suites,
    testCaseAttachments,
    stepAttachments,
    externalIssues,
    isLoading,
    error,
    refetch: () => {
      void query.refetch();
    },
    initialSnapshot,
    ownerLabel,
    productLabel,
    suiteLabel,
    setTitle,
    setTemplateType,
    setAutomationId,
    setTime,
    setPriority,
    setStatus,
    setTestCaseType,
    setPersistedStatus,
    setOwnerId,
    setPrimaryProductId,
    setSuiteId,
    setTags,
    setComponentCoverages,
    setSteps,
    setInitialStepSignature,
    setTestCaseAttachments,
    setStepAttachments,
    setExternalIssues,
    setPreconditions,
    setStepsText,
    setExpected,
    setRawTest,
    setRawTestLanguage,
  } as DataApi;
}
