from pydantic import BaseModel, Field

from app.modules.projects.schemas.user import UserRead


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class LoginResponse(BaseModel):
    """Response for cookie-based login. Token is set via httpOnly cookie."""

    user: UserRead
