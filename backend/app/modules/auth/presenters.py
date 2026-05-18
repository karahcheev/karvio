from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.projects.models import User
from app.modules.projects.repositories import users as user_repo
from app.modules.projects.schemas.user import UserProjectMembershipRead, UserRead


async def user_to_read_with_memberships(db: AsyncSession, user: User) -> UserRead:
    memberships_by_user_id = await user_repo.list_project_memberships_by_user_ids(db, user_ids=[user.id])
    memberships = [
        UserProjectMembershipRead(
            project_id=item.project_id,
            project_name=item.project_name,
            role=item.role,
        )
        for item in memberships_by_user_id.get(user.id, [])
    ]
    return UserRead.model_validate(user).model_copy(update={"project_memberships": memberships})
