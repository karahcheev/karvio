from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.security import validate_password_strength
from app.models.enums import ProjectMemberRole, UserRole


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=10, max_length=128)
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=255)
    team: str | None = Field(default=None, max_length=255)

    model_config = {"extra": "forbid"}

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)


class UserPatch(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=64)
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=255)
    team: str | None = Field(default=None, max_length=255)
    is_enabled: bool | None = None

    model_config = {"extra": "forbid"}


class UserPasswordChangeRequest(BaseModel):
    """Payload for self password change (PUT /users/me/password)."""

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)

    model_config = {"extra": "forbid"}

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_strength(value)


class UserPasswordSetRequest(BaseModel):
    """Payload for admin password reset/set (PUT /users/{user_id}/password)."""

    new_password: str = Field(min_length=10, max_length=128)

    model_config = {"extra": "forbid"}

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_strength(value)


class UserProjectMembershipRead(BaseModel):
    project_id: str
    project_name: str
    role: ProjectMemberRole


class UserRead(BaseModel):
    id: str
    username: str
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    team: str | None = None
    is_enabled: bool
    role: UserRole
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    project_memberships: list[UserProjectMembershipRead] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class UsersList(BaseModel):
    items: list[UserRead] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_next: bool = False
