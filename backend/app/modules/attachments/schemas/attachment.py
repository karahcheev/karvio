from datetime import datetime

from pydantic import BaseModel, Field


class AttachmentTargetTestCase(BaseModel):
    type: str = Field(default="test_case", frozen=True)
    test_case_id: str


class AttachmentTargetStep(BaseModel):
    type: str = Field(default="step", frozen=True)
    step_id: str


class AttachmentTargetRunCase(BaseModel):
    type: str = Field(default="run_case", frozen=True)
    run_case_id: str


class AttachmentTargetDraftStep(BaseModel):
    type: str = Field(default="draft_step", frozen=True)
    test_case_id: str
    draft_step_client_id: str


AttachmentTarget = (
    AttachmentTargetTestCase
    | AttachmentTargetStep
    | AttachmentTargetRunCase
    | AttachmentTargetDraftStep
)


class AttachmentRead(BaseModel):
    id: str
    filename: str
    content_type: str
    size: int
    checksum_sha256: str | None = None
    created_at: datetime
    target: AttachmentTarget


class AttachmentListResponse(BaseModel):
    items: list[AttachmentRead] = Field(default_factory=list)
