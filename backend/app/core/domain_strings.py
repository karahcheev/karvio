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
ACTION_AUTH_PROVIDER_CREATE = "auth.provider.create"
ACTION_AUTH_PROVIDER_UPDATE = "auth.provider.update"
ACTION_AUTH_PROVIDER_DELETE = "auth.provider.delete"
ACTION_AUTH_PROVIDER_TEST = "auth.provider.test"
ACTION_AUTH_EXTERNAL_LOGIN = "auth.external_login"
ACTION_AUTH_PROVISION_USER = "auth.provision_user"
ACTION_AUTH_IDENTITY_LINK = "auth.identity_link"
EVENT_USE_CASE_AUTH_PROVIDER = "use_case.auth.provider"
EVENT_USE_CASE_AUTH_EXTERNAL_LOGIN = "use_case.auth.external_login"

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
