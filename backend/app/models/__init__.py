"""Registers all SQLAlchemy models on Base.metadata (canonical tables live in app.modules.*.models)."""

from app.modules.attachments import models as _attachments_models  # noqa: F401
from app.modules.audit import models as _audit_models  # noqa: F401
from app.modules.environments import models as _environments_models  # noqa: F401
from app.modules.auth import models as _auth_models  # noqa: F401
from app.modules.ai import models as _ai_models  # noqa: F401
from app.modules.integrations import models as _integrations_models  # noqa: F401
from app.modules.milestones import models as _milestones_models  # noqa: F401
from app.modules.notifications import models as _notification_models  # noqa: F401
from app.modules.performance import models as _performance_models  # noqa: F401
from app.modules.projects import models as _projects_models  # noqa: F401
from app.modules.products import models as _products_models  # noqa: F401
from app.modules.test_cases import models as _test_cases_models  # noqa: F401
from app.modules.test_plans import models as _test_plans_models  # noqa: F401
from app.modules.test_runs import models as _test_runs_models  # noqa: F401

__all__: list[str] = []
