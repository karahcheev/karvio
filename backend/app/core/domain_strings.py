"""Shared literals for DomainError titles, audit actions, and common DB/HTTP strings (Sonar S1192)."""

# Problem / DomainError titles
TITLE_VALIDATION_ERROR = "Validation error"
TITLE_BAD_GATEWAY = "Bad gateway"
TITLE_BAD_REQUEST = "Bad request"
TITLE_UNAUTHORIZED = "Unauthorized"
TITLE_FORBIDDEN = "Forbidden"
TITLE_INVALID_REQUEST = "Invalid request"

# Display / export labels
LABEL_UNKNOWN_USER = "Unknown user"
TITLE_WEBHOOK_DELIVERY_FAILED = "Webhook delivery failed"
MSG_VALIDATION_MUST_NOT_BE_EMPTY = "must not be empty"

# Audit actions / log event keys
ACTION_AUTH_LOGIN = "auth.login"
EVENT_USE_CASE_AUTH_LOGIN = "use_case.auth.login"
EVENT_USE_CASE_AUTH_CHANGE_PASSWORD = "use_case.auth.change_password"
ACTION_AUTH_CHANGE_PASSWORD = "auth.change_password"
ACTION_PROJECT_ACCESS = "project.access"
ACTION_AUTH_AUTHENTICATE = "auth.authenticate"
ACTION_AUTH_AUTHENTICATE_API_KEY = "auth.authenticate_api_key"

# SQLAlchemy / ORM
ON_DELETE_SET_NULL = "SET NULL"
ON_DELETE_CASCADE = "CASCADE"
FK_USERS_ID = "users.id"
FK_RUN_ITEMS_ID = "run_items.id"
FK_RUN_CASE_ROWS_ID = "run_case_rows.id"
FK_PERFORMANCE_RUNS_ID = "performance_runs.id"
FK_ENVIRONMENT_REVISIONS_ID = "environment_revisions.id"
FK_ENVIRONMENTS_ID = "environments.id"
FK_SUITES_ID = "suites.id"
RELATIONSHIP_CASCADE_DELETE_ORPHAN = "all, delete-orphan"
