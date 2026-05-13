from pydantic import BaseModel, Field

from app.modules.attachments.schemas.attachment import AttachmentRead


class TestStepWrite(BaseModel):
    position: int
    action: str
    expected_result: str
    client_id: str | None = None

    model_config = {"extra": "forbid"}


class TestStepsReplaceRequest(BaseModel):
    steps: list[TestStepWrite] = Field(default_factory=list)

    model_config = {"extra": "forbid"}


class TestStepRead(BaseModel):
    id: str
    position: int
    action: str
    expected_result: str

    model_config = {"from_attributes": True}


class TestStepsResponse(BaseModel):
    test_case_id: str
    steps: list[TestStepRead]
    step_attachments: dict[str, list[AttachmentRead]] = Field(default_factory=dict)
