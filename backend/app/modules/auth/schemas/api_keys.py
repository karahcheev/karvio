from datetime import datetime

from pydantic import BaseModel, Field


class UserApiKeyLoginRead(BaseModel):
    authenticated_at: datetime
    ip: str | None = None
    user_agent: str | None = None
    request_path: str | None = None


class UserApiKeyRead(BaseModel):
    id: str
    name: str
    description: str | None = None
    key_prefix: str
    key_hint: str
    created_at: datetime
    rotated_at: datetime | None = None
    last_used_at: datetime | None = None
    last_used_ip: str | None = None
    last_used_user_agent: str | None = None
    recent_logins: list[UserApiKeyLoginRead] = Field(default_factory=list)


class UserApiKeysList(BaseModel):
    items: list[UserApiKeyRead] = Field(default_factory=list)


class UserApiKeyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)

    model_config = {"extra": "forbid"}


class UserApiKeyPatchRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)

    model_config = {"extra": "forbid"}


class UserApiKeySecretResponse(BaseModel):
    api_key: str
    key: UserApiKeyRead
