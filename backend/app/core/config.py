from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("config", ".env"), env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Qarvio API"
    app_version: str = "1.0.0"
    api_prefix: str = "/api/v1"
    log_level: str = "INFO"
    log_json: bool = True
    metrics_enabled: bool = True
    metrics_path: str = "/metrics"
    status_queue_backlog_warn: int = 100
    status_queue_backlog_fail: int = 1000
    status_processing_stale_seconds: int = 300
    status_pending_stale_seconds: int = 300
    app_base_url: str = "http://localhost:5173"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/tms"
    cors_origins: str = "http://localhost:5173"
    admin_password: str = "admin"
    auth_secret: str = "dev-change-me"
    access_token_ttl_seconds: int = 60 * 60 * 8
    session_cookie_name: str = "tms_session"
    session_cookie_secure: bool = True
    session_cookie_same_site: str = "lax"
    attachment_storage_driver: str = "localstorage"
    attachment_local_root: str = "./data/attachments"
    performance_artifact_root: str = "./data/performance_artifacts"
    procrastinate_in_memory: bool = False
    audit_retention_days: int = 365
    audit_queue_max_attempts: int = 5
    audit_queue_retry_max_seconds: int = 300
    jira_api_base_url: str = "https://api.atlassian.com"
    jira_http_timeout_seconds: float = 20.0
    jira_http_max_retries: int = 4
    jira_sync_default_interval_seconds: int = 300
    jira_sync_cron: str = "*/5 * * * *"
    ai_test_case_assistant_enabled: bool = False
    ai_provider: str | None = None
    ai_model: str | None = None
    ai_api_key: str | None = None
    ai_timeout_ms: int = 30000
    ai_http_max_retries: int = 2
    ai_duplicate_high_threshold: float = 0.88
    ai_duplicate_medium_threshold: float = 0.72

    # Bootstrap: create default project + admin user on startup. Set False in prod; use scripts/bootstrap.py instead.
    bootstrap_enabled: bool = False

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()
