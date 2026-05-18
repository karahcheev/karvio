import enum


class TestCaseStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    archived = "archived"


class TestCasePriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class TestCaseType(str, enum.Enum):
    manual = "manual"
    automated = "automated"


class TestCaseTemplateType(str, enum.Enum):
    text = "text"
    steps = "steps"
    automated = "automated"


class DatasetSourceType(str, enum.Enum):
    manual = "manual"
    pytest_parametrize = "pytest_parametrize"
    imported = "imported"


class TestCaseDatasetBindingType(str, enum.Enum):
    explicit = "explicit"
    auto_discovered = "auto_discovered"


class DatasetStatus(str, enum.Enum):
    active = "active"
    archived = "archived"


class DatasetBindingMode(str, enum.Enum):
    follow_latest = "follow_latest"
    pin_revision = "pin_revision"


class DatasetRowSelectionType(str, enum.Enum):
    all = "all"
    subset = "subset"


class TestRunStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"
    archived = "archived"


class MilestoneStatus(str, enum.Enum):
    planned = "planned"
    active = "active"
    completed = "completed"
    archived = "archived"


class ProductStatus(str, enum.Enum):
    active = "active"
    archived = "archived"


class ComponentRiskLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class ComponentDependencyType(str, enum.Enum):
    depends_on = "depends_on"


class CoverageType(str, enum.Enum):
    direct = "direct"
    indirect = "indirect"
    integration = "integration"
    e2e = "e2e"


class CoverageStrength(str, enum.Enum):
    smoke = "smoke"
    regression = "regression"
    deep = "deep"


class PlanGenerationMode(str, enum.Enum):
    smoke = "smoke"
    regression = "regression"
    full = "full"


class TestPlanGenerationSource(str, enum.Enum):
    manual = "manual"
    product_generated = "product_generated"


class RunItemStatus(str, enum.Enum):
    untested = "untested"
    in_progress = "in_progress"
    passed = "passed"
    error = "error"
    failure = "failure"
    blocked = "blocked"
    skipped = "skipped"
    xfailed = "xfailed"
    xpassed = "xpassed"


class ProjectMemberRole(str, enum.Enum):
    viewer = "viewer"
    tester = "tester"
    lead = "lead"
    manager = "manager"


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class AuditActorType(str, enum.Enum):
    user = "user"
    system = "system"


class AuditResult(str, enum.Enum):
    success = "success"
    fail = "fail"


class AuditQueueStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    processed = "processed"
    dead = "dead"


class AttachmentOwnerType(str, enum.Enum):
    test_case = "test_case"
    step = "step"
    draft_step = "draft_step"
    run_case = "run_case"


class ExternalIssueProvider(str, enum.Enum):
    jira = "jira"


class ExternalIssueOwnerType(str, enum.Enum):
    run_case = "run_case"
    test_case = "test_case"
    test_run = "test_run"


class NotificationChannel(str, enum.Enum):
    email = "email"
    slack = "slack"
    mattermost = "mattermost"


class NotificationEventType(str, enum.Enum):
    test_run_report = "test_run_report"
    alerting = "alerting"


class NotificationQueueStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    sent = "sent"
    dead = "dead"
