from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.enums import DatasetBindingMode, DatasetRowSelectionType, DatasetSourceType, DatasetStatus


class DatasetColumnInput(BaseModel):
    column_key: str = Field(min_length=1, max_length=128)
    display_name: str = Field(min_length=1, max_length=255)
    data_type: str = Field(default="string", min_length=1, max_length=32)
    required: bool = False
    default_value: str | None = None
    is_scenario_label: bool = False

    model_config = {"extra": "forbid"}

    @field_validator("column_key")
    @classmethod
    def _normalize_key(cls, value: str) -> str:
        return value.strip()

    @field_validator("display_name")
    @classmethod
    def _normalize_name(cls, value: str) -> str:
        return value.strip()


class DatasetRowInput(BaseModel):
    row_key: str = Field(min_length=1, max_length=128)
    scenario_label: str | None = Field(default=None, max_length=255)
    values: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True

    model_config = {"extra": "forbid"}

    @field_validator("row_key")
    @classmethod
    def _normalize_key(cls, value: str) -> str:
        return value.strip()

    @field_validator("scenario_label")
    @classmethod
    def _normalize_label(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class TestDatasetCreate(BaseModel):
    project_id: str
    name: str
    description: str | None = None
    source_type: DatasetSourceType = DatasetSourceType.manual
    source_ref: str | None = None
    columns: list[DatasetColumnInput] = Field(default_factory=list)
    rows: list[DatasetRowInput] = Field(default_factory=list)
    change_summary: str | None = None

    model_config = {"extra": "forbid"}


class TestDatasetPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    source_type: DatasetSourceType | None = None
    source_ref: str | None = None
    status: DatasetStatus | None = None
    columns: list[DatasetColumnInput] | None = None
    rows: list[DatasetRowInput] | None = None
    change_summary: str | None = None

    model_config = {"extra": "forbid"}


class DatasetColumnRead(BaseModel):
    id: str
    column_key: str
    display_name: str
    data_type: str
    required: bool
    default_value: str | None = None
    order_index: int
    is_scenario_label: bool

    model_config = {"from_attributes": True}


class DatasetRowRead(BaseModel):
    id: str
    row_key: str
    scenario_label: str | None = None
    order_index: int
    values: dict[str, Any] = Field(default_factory=dict, validation_alias="values_json")
    is_active: bool

    model_config = {"from_attributes": True, "populate_by_name": True}


class DatasetRevisionRead(BaseModel):
    id: str
    dataset_id: str
    revision_number: int
    rows_count: int
    change_summary: str | None = None
    created_by: str | None = None
    created_at: datetime
    columns: list[DatasetColumnRead] = Field(default_factory=list)
    rows: list[DatasetRowRead] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class TestDatasetRead(BaseModel):
    id: str
    project_id: str
    name: str
    description: str | None = None
    status: DatasetStatus
    source_type: DatasetSourceType
    source_ref: str | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None = None
    current_revision_number: int = 0
    current_revision_id: str | None = None
    current_revision: DatasetRevisionRead | None = None
    test_case_ids: list[str] = Field(default_factory=list)
    test_cases_count: int = 0

    model_config = {"from_attributes": True}


class TestDatasetsList(BaseModel):
    items: list[TestDatasetRead] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_next: bool = False
    total: int = 0


class DatasetRevisionsList(BaseModel):
    items: list[DatasetRevisionRead] = Field(default_factory=list)
    page: int = 1
    page_size: int = 50
    has_next: bool = False
    total: int = 0


class DatasetBulkAction(str, Enum):
    delete = "delete"


class DatasetBulkOperation(BaseModel):
    project_id: str
    dataset_ids: list[str] = Field(min_length=1)
    action: DatasetBulkAction

    model_config = {"extra": "forbid"}


class DatasetBulkOperationResult(BaseModel):
    affected_count: int


class TestCaseDatasetBindingCreate(BaseModel):
    dataset_id: str
    dataset_alias: str = Field(min_length=1, max_length=128)
    mode: DatasetBindingMode = DatasetBindingMode.follow_latest
    pinned_revision_number: int | None = Field(default=None, ge=1)
    row_selection_type: DatasetRowSelectionType = DatasetRowSelectionType.all
    selected_row_keys: list[str] = Field(default_factory=list)
    sort_order: int = 0

    model_config = {"extra": "forbid"}

    @field_validator("dataset_alias")
    @classmethod
    def _normalize_alias(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def _validate_mode(self):
        if self.mode == DatasetBindingMode.pin_revision and self.pinned_revision_number is None:
            raise ValueError("pinned_revision_number is required when mode=pin_revision")
        if self.row_selection_type == DatasetRowSelectionType.subset and not self.selected_row_keys:
            raise ValueError("selected_row_keys is required when row_selection_type=subset")
        return self


class TestCaseDatasetBindingPatch(BaseModel):
    dataset_alias: str | None = Field(default=None, min_length=1, max_length=128)
    mode: DatasetBindingMode | None = None
    pinned_revision_number: int | None = Field(default=None, ge=1)
    row_selection_type: DatasetRowSelectionType | None = None
    selected_row_keys: list[str] | None = None
    sort_order: int | None = None

    model_config = {"extra": "forbid"}

    @field_validator("dataset_alias")
    @classmethod
    def _normalize_alias(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()


class TestCaseDatasetBindingRead(BaseModel):
    id: str
    test_case_id: str
    dataset_id: str
    dataset_alias: str
    mode: DatasetBindingMode
    pinned_revision_number: int | None = None
    row_selection_type: DatasetRowSelectionType
    selected_row_keys: list[str] = Field(default_factory=list)
    sort_order: int
    is_default: bool
    created_at: datetime
    updated_at: datetime
    dataset_name: str | None = None

    model_config = {"from_attributes": True}


class TestCaseDatasetBindingsList(BaseModel):
    items: list[TestCaseDatasetBindingRead] = Field(default_factory=list)

