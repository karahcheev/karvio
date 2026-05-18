from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.enums import NotificationChannel, NotificationEventType


class ChannelRecipients(BaseModel):
    enabled: bool = False
    recipients: list[EmailStr] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class ChannelWebhook(BaseModel):
    enabled: bool = False
    webhook_url: str | None = None
    channel_name: str | None = Field(default=None, max_length=255)

    model_config = ConfigDict(extra="forbid")

    @field_validator("channel_name")
    @classmethod
    def validate_channel_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class ProjectNotificationRuleSettings(BaseModel):
    enabled: bool = False
    email: ChannelRecipients = Field(default_factory=ChannelRecipients)
    slack: ChannelWebhook = Field(default_factory=ChannelWebhook)
    mattermost: ChannelWebhook = Field(default_factory=ChannelWebhook)

    model_config = ConfigDict(extra="forbid")


class ProjectNotificationSettingsBase(BaseModel):
    project_id: str
    test_run_report: ProjectNotificationRuleSettings = Field(default_factory=ProjectNotificationRuleSettings)
    alerting: ProjectNotificationRuleSettings = Field(default_factory=ProjectNotificationRuleSettings)

    model_config = ConfigDict(extra="forbid")


class ProjectNotificationSettingsCreate(ProjectNotificationSettingsBase):
    pass


class ProjectNotificationSettingsUpdate(ProjectNotificationSettingsBase):
    pass


class ProjectNotificationSettingsRead(ProjectNotificationSettingsBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SmtpSettingsBase(BaseModel):
    enabled: bool = False
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(default=587, ge=1, le=65535)
    username: str | None = Field(default=None, max_length=255)
    password: str | None = None
    from_email: EmailStr
    from_name: str | None = Field(default=None, max_length=255)
    reply_to: EmailStr | None = None
    use_tls: bool = False
    use_starttls: bool = True
    timeout_seconds: int = Field(default=30, ge=1, le=300)

    model_config = ConfigDict(extra="forbid")

    @field_validator("host")
    @classmethod
    def validate_host(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Host is required")
        return normalized

    @model_validator(mode="after")
    def validate_tls_flags(self) -> "SmtpSettingsBase":
        if self.use_tls and self.use_starttls:
            raise ValueError("TLS and STARTTLS cannot be enabled at the same time")
        return self


class SmtpSettingsCreate(SmtpSettingsBase):
    pass


class SmtpSettingsUpdate(SmtpSettingsBase):
    pass


class SmtpSettingsRead(BaseModel):
    enabled: bool
    host: str
    port: int
    username: str | None = None
    password_configured: bool = False
    from_email: EmailStr
    from_name: str | None = None
    reply_to: EmailStr | None = None
    use_tls: bool
    use_starttls: bool
    timeout_seconds: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SmtpEnabledRead(BaseModel):
    enabled: bool


class SmtpTestRequest(BaseModel):
    recipient_email: EmailStr
    smtp: SmtpSettingsCreate | None = None

    model_config = ConfigDict(extra="forbid")


class NotificationSettingsTestRequest(BaseModel):
    project_id: str
    rule: NotificationEventType
    channel: NotificationChannel
    recipient_email: EmailStr | None = None

    model_config = ConfigDict(extra="forbid")


class NotificationTestResult(BaseModel):
    message: str
