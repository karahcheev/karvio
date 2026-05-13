from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.enums import UserRole
from app.modules.projects.models import Project, User
from app.modules.projects.repositories import projects as project_repo
from app.modules.projects.repositories import users as user_repo

DEFAULT_PROJECT_NAME = "default"
ADMIN_USERNAME = "admin"


async def ensure_default_data(db: AsyncSession) -> None:
    settings = get_settings()

    project = await project_repo.get_by_name(db, DEFAULT_PROJECT_NAME)
    if project is None:
        db.add(Project(name=DEFAULT_PROJECT_NAME))

    admin_user = await user_repo.get_by_username(db, ADMIN_USERNAME)
    if admin_user is None:
        db.add(User(username=ADMIN_USERNAME, password_hash=hash_password(settings.admin_password), role=UserRole.admin))

    await db.commit()
