export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    me: ["auth", "me"] as const,
  },
  apiKeys: {
    all: ["api-keys"] as const,
    me: ["api-keys", "me"] as const,
  },
  version: {
    current: ["version"] as const,
  },
  settings: {
    smtp: ["settings", "smtp"] as const,
    smtpEnabled: ["settings", "smtp", "enabled"] as const,
    notifications: (projectId: string) => ["settings", "notifications", projectId] as const,
    jiraSystem: ["settings", "jira", "system"] as const,
    jiraConnections: ["settings", "jira", "connections"] as const,
    jiraMappingsAll: ["settings", "jira", "mappings"] as const,
    jiraMappings: (projectId: string) => ["settings", "jira", "mappings", projectId] as const,
    jiraHealth: (projectId?: string) => ["settings", "jira", "health", projectId ?? "all"] as const,
    aiOverview: ["settings", "ai", "overview"] as const,
    aiGlobal: ["settings", "ai", "global"] as const,
    ai: (projectId: string) => ["settings", "ai", projectId] as const,
  },
  projects: {
    all: ["projects"] as const,
    list: (sortBy: string, sortDirection: string) => ["projects", "list", sortBy, sortDirection] as const,
    detail: (projectId: string) => ["projects", projectId] as const,
    members: (projectId: string) => ["projects", projectId, "members"] as const,
    overview: (projectId: string, filters?: Record<string, unknown>) => ["projects", projectId, "overview", filters ?? {}] as const,
  },
  users: {
    all: ["users"] as const,
    list: (sortBy: string, sortDirection: string) => ["users", "list", sortBy, sortDirection] as const,
    search: (q: string, params?: Record<string, unknown>) => ["users", "search", q, params ?? {}] as const,
    detail: (userId: string) => ["users", userId] as const,
  },
  suites: {
    byProject: (projectId: string) => ["projects", projectId, "suites"] as const,
    search: (projectId: string, q: string, params?: Record<string, unknown>) =>
      ["projects", projectId, "suites", "search", q, params ?? {}] as const,
  },
  testCases: {
    all: ["test-cases"] as const,
    byProject: (projectId: string) => ["projects", projectId, "test-cases"] as const,
    list: (projectId: string, sortBy: string, sortDirection: string) =>
      ["projects", projectId, "test-cases", "list", sortBy, sortDirection] as const,
    page: (projectId: string, params?: Record<string, unknown>) =>
      ["projects", projectId, "test-cases", "page", params ?? {}] as const,
    search: (projectId: string, q: string, params?: Record<string, unknown>) =>
      ["projects", projectId, "test-cases", "search", q, params ?? {}] as const,
    detail: (testCaseId: string) => ["test-cases", testCaseId] as const,
    detailFull: (projectId: string, testCaseId: string) => ["test-cases", testCaseId, "detail-full", projectId] as const,
    steps: (testCaseId: string) => ["test-cases", testCaseId, "steps"] as const,
    attachments: (testCaseId: string) => ["test-cases", testCaseId, "attachments"] as const,
    resultsHistory: (projectId: string, testCaseId: string, params?: Record<string, unknown>) =>
      ["projects", projectId, "test-cases", testCaseId, "results-history", params ?? {}] as const,
    stepAttachments: (testCaseId: string, stepId: string) =>
      ["test-cases", testCaseId, "steps", stepId, "attachments"] as const,
  },
  ai: {
    testCaseStatus: (projectId?: string) => ["ai", "test-cases", "status", projectId ?? "global"] as const,
    testCaseReview: (testCaseId: string) => ["ai", "test-cases", testCaseId, "review"] as const,
  },
  testRuns: {
    all: ["test-runs"] as const,
    /** Invalidate all list queries for a project (paginated list, sidebar badge, etc.). */
    projectScope: (projectId: string) => ["projects", projectId, "test-runs"] as const,
    byProject: (projectId: string, params?: Record<string, unknown>) => ["projects", projectId, "test-runs", params ?? {}] as const,
    inProgressBadge: (projectId: string) => ["projects", projectId, "test-runs", "in-progress-badge"] as const,
    detail: (testRunId: string) => ["test-runs", testRunId] as const,
    runCases: (testRunId: string, params?: Record<string, unknown>) => ["test-runs", testRunId, "run-cases", params ?? {}] as const,
    runCasesPage: (testRunId: string, params?: Record<string, unknown>) =>
      ["test-runs", testRunId, "run-cases", "page", params ?? {}] as const,
    runCase: (runCaseId: string) => ["run-cases", runCaseId] as const,
  },
  externalIssues: {
    owner: (ownerType: string, ownerId: string) => ["external-issues", ownerType, ownerId] as const,
  },
  auditLogs: {
    list: (params?: Record<string, unknown>) => ["audit-logs", "list", params ?? {}] as const,
  },
  testPlans: {
    projectScope: (projectId: string) => ["projects", projectId, "test-plans"] as const,
    tagValues: (projectId: string) => ["projects", projectId, "test-plans", "tags"] as const,
    byProject: (projectId: string, params?: Record<string, unknown>) =>
      ["projects", projectId, "test-plans", params ?? {}] as const,
    detail: (testPlanId: string) => ["test-plans", testPlanId] as const,
  },
  milestones: {
    projectScope: (projectId: string) => ["projects", projectId, "milestones"] as const,
    byProject: (projectId: string, params?: Record<string, unknown>) =>
      ["projects", projectId, "milestones", params ?? {}] as const,
    detail: (milestoneId: string) => ["milestones", milestoneId] as const,
    summary: (milestoneId: string) => ["milestones", milestoneId, "summary"] as const,
  },
  products: {
    all: ["products"] as const,
    projectScope: (projectId: string) => ["projects", projectId, "products"] as const,
    byProject: (projectId: string, params?: Record<string, unknown>) =>
      ["projects", projectId, "products", params ?? {}] as const,
    allForProject: (projectId: string) => ["projects", projectId, "products", "all"] as const,
    detail: (productId: string) => ["products", productId] as const,
    summary: (productId: string) => ["products", productId, "summary"] as const,
    components: (productId: string) => ["products", productId, "components"] as const,
  },
  components: {
    all: ["components"] as const,
    projectScope: (projectId: string) => ["projects", projectId, "components"] as const,
    byProject: (projectId: string, params?: Record<string, unknown>) =>
      ["projects", projectId, "components", params ?? {}] as const,
    allForProject: (projectId: string) => ["projects", projectId, "components", "all"] as const,
    detail: (componentId: string) => ["components", componentId] as const,
    dependencies: (componentId: string) => ["components", componentId, "dependencies"] as const,
    graph: (projectId: string) => ["projects", projectId, "components", "graph"] as const,
  },
  datasets: {
    projectScope: (projectId: string) => ["projects", projectId, "datasets"] as const,
    byProject: (projectId: string, params?: Record<string, unknown>) =>
      ["projects", projectId, "datasets", params ?? {}] as const,
    detail: (datasetId: string) => ["datasets", datasetId] as const,
    byTestCase: (projectId: string, testCaseId: string, params?: Record<string, unknown>) =>
      ["projects", projectId, "test-cases", testCaseId, "datasets", params ?? {}] as const,
    bindingsByTestCase: (testCaseId: string) => ["test-cases", testCaseId, "dataset-bindings"] as const,
  },
  environments: {
    projectScope: (projectId: string) => ["projects", projectId, "environments"] as const,
    useCaseValues: (projectId: string, params?: Record<string, unknown>) =>
      ["projects", projectId, "environments", "use-cases", params ?? {}] as const,
    byProject: (projectId: string, params?: Record<string, unknown>) =>
      ["projects", projectId, "environments", params ?? {}] as const,
    detail: (environmentId: string) => ["environments", environmentId] as const,
    revisions: (environmentId: string, params?: Record<string, unknown>) =>
      ["environments", environmentId, "revisions", params ?? {}] as const,
  },
};
