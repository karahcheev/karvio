"""Add external authentication providers and user external identities.

Revision ID: 0002_auth_providers
Revises: 0001_init
Create Date: 2026-05-19 12:00:00

Note: ``0001_init`` is a baseline that runs ``Base.metadata.create_all`` over the
*entire* current metadata, so on a fresh database the auth-provider tables are
already present by the time this revision runs. This migration is therefore
idempotent (``checkfirst=True``): it creates the tables/enum only when an older
database upgraded before this feature existed.
"""

from alembic import op

import app.models  # noqa: F401  registers all models on Base.metadata
from app.db.base import Base
from app.modules.auth.models import AuthProvider, UserExternalIdentity

# revision identifiers, used by Alembic.
revision = "0002_auth_providers"
down_revision = "0001_init"
branch_labels = None
depends_on = None

_TABLES = [AuthProvider.__table__, UserExternalIdentity.__table__]


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, tables=_TABLES, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(
        bind=bind,
        tables=[UserExternalIdentity.__table__, AuthProvider.__table__],
        checkfirst=True,
    )
    op.execute("DROP TYPE IF EXISTS auth_provider_type")
