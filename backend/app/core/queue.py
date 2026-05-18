from __future__ import annotations

from procrastinate import App, PsycopgConnector
from procrastinate.testing import InMemoryConnector

from app.core.config import get_settings

settings = get_settings()

TASK_IMPORT_PATHS = [
    "app.modules.audit.tasks",
    "app.modules.notifications.tasks",
    "app.modules.performance.tasks",
    "app.modules.integrations.jira.tasks",
]


def _database_url_to_conninfo(url: str) -> str:
    if url.startswith("postgresql+psycopg://"):
        return url.replace("postgresql+psycopg://", "postgresql://", 1)
    if url.startswith("postgresql+psycopg_async://"):
        return url.replace("postgresql+psycopg_async://", "postgresql://", 1)
    return url


def _build_connector():
    if settings.procrastinate_in_memory:
        return InMemoryConnector()
    return PsycopgConnector(conninfo=_database_url_to_conninfo(settings.database_url))


queue_app = App(connector=_build_connector(), import_paths=TASK_IMPORT_PATHS)
