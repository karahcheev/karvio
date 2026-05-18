"""Init baseline schema.

Revision ID: 0001_init
Revises:
Create Date: 2026-04-17 12:00:00
"""

from alembic import op
from procrastinate.schema import SchemaManager

from app.db.base import Base
import app.models  # noqa: F401

# revision identifiers, used by Alembic.
revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, checkfirst=True)
    op.execute(SchemaManager.get_schema())


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind, checkfirst=True)
    op.execute(
        """
        DROP TABLE IF EXISTS procrastinate_periodic_defers CASCADE;
        DROP TABLE IF EXISTS procrastinate_events CASCADE;
        DROP TABLE IF EXISTS procrastinate_jobs CASCADE;
        DROP TABLE IF EXISTS procrastinate_workers CASCADE;
        DROP FUNCTION IF EXISTS procrastinate_defer_job_v1(text, text, integer, jsonb, text, text, timestamptz);
        DROP FUNCTION IF EXISTS procrastinate_defer_periodic_job_v1(text, text, integer, jsonb, text, text, bigint, timestamptz);
        DROP FUNCTION IF EXISTS procrastinate_fetch_job_v2(text[]);
        DROP FUNCTION IF EXISTS procrastinate_finish_job_v1(integer, procrastinate_job_status, timestamptz, boolean);
        DROP FUNCTION IF EXISTS procrastinate_cancel_job_v1(integer, boolean, boolean);
        DROP FUNCTION IF EXISTS procrastinate_retry_job_v1(integer, timestamptz, integer, jsonb);
        DROP FUNCTION IF EXISTS procrastinate_register_worker_v1(text);
        DROP FUNCTION IF EXISTS procrastinate_unregister_worker_v1(uuid);
        DROP FUNCTION IF EXISTS procrastinate_notify_queue();
        DROP FUNCTION IF EXISTS procrastinate_trigger_status_events_procedure_insert();
        DROP FUNCTION IF EXISTS procrastinate_trigger_status_events_procedure_update();
        DROP FUNCTION IF EXISTS procrastinate_trigger_scheduled_events_procedure();
        DROP TYPE IF EXISTS procrastinate_job_event_type CASCADE;
        DROP TYPE IF EXISTS procrastinate_job_status CASCADE;
        """
    )
