from __future__ import annotations

from sqlalchemy import Select, and_, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import DatasetSourceType
from app.modules.test_cases.models import (
    DatasetColumn,
    DatasetRevision,
    DatasetRow,
    TestCaseDatasetBinding,
    TestDataset,
)
from app.repositories.common import OffsetPage


def _base_dataset_stmt() -> Select[tuple[TestDataset]]:
    return select(TestDataset).options(
        selectinload(TestDataset.case_links),
        selectinload(TestDataset.revisions)
        .selectinload(DatasetRevision.columns),
        selectinload(TestDataset.revisions)
        .selectinload(DatasetRevision.rows),
    )


async def list_by_project(
    db: AsyncSession,
    *,
    project_id: str,
    test_case_id: str | None = None,
    exclude_test_case_id: str | None = None,
    search: str | None = None,
    source_types: list[DatasetSourceType] | None = None,
    page: int = 1,
    page_size: int = 50,
) -> OffsetPage[TestDataset]:
    conditions = [TestDataset.project_id == project_id]
    if test_case_id:
        conditions.append(
            exists(
                select(1).where(
                    TestCaseDatasetBinding.dataset_id == TestDataset.id,
                    TestCaseDatasetBinding.test_case_id == test_case_id,
                )
            )
        )
    if exclude_test_case_id:
        conditions.append(
            ~exists(
                select(1).where(
                    TestCaseDatasetBinding.dataset_id == TestDataset.id,
                    TestCaseDatasetBinding.test_case_id == exclude_test_case_id,
                )
            )
        )
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        conditions.append((TestDataset.name.ilike(pattern)) | (TestDataset.description.ilike(pattern)))
    if source_types:
        conditions.append(TestDataset.source_type.in_(source_types))

    stmt = _base_dataset_stmt().where(and_(*conditions))
    count_stmt = select(func.count()).select_from(TestDataset).where(and_(*conditions))

    total = await db.scalar(count_stmt) or 0
    stmt = stmt.order_by(TestDataset.updated_at.desc(), TestDataset.id.desc())
    offset = (page - 1) * page_size
    result = await db.scalars(stmt.limit(page_size + 1).offset(offset))
    rows = result.all()
    has_next = len(rows) > page_size
    return OffsetPage(
        items=list(rows[:page_size]),
        page=page,
        page_size=page_size,
        has_next=has_next,
        total=total,
    )


async def get_by_id(db: AsyncSession, dataset_id: str) -> TestDataset | None:
    return await db.scalar(_base_dataset_stmt().where(TestDataset.id == dataset_id))


async def list_by_ids(db: AsyncSession, dataset_ids: list[str]) -> list[TestDataset]:
    if not dataset_ids:
        return []
    result = await db.scalars(_base_dataset_stmt().where(TestDataset.id.in_(dataset_ids)))
    return list(result.all())


async def list_bindings_by_test_case(db: AsyncSession, test_case_id: str) -> list[TestCaseDatasetBinding]:
    result = await db.scalars(
        select(TestCaseDatasetBinding)
        .where(TestCaseDatasetBinding.test_case_id == test_case_id)
        .options(selectinload(TestCaseDatasetBinding.dataset))
        .order_by(TestCaseDatasetBinding.sort_order.asc(), TestCaseDatasetBinding.created_at.asc())
    )
    return list(result.all())


async def list_bindings_for_test_cases(db: AsyncSession, test_case_ids: list[str]) -> list[TestCaseDatasetBinding]:
    if not test_case_ids:
        return []
    result = await db.scalars(
        select(TestCaseDatasetBinding)
        .where(TestCaseDatasetBinding.test_case_id.in_(test_case_ids))
        .options(selectinload(TestCaseDatasetBinding.dataset))
        .order_by(TestCaseDatasetBinding.sort_order.asc(), TestCaseDatasetBinding.created_at.asc())
    )
    return list(result.all())


async def get_binding(db: AsyncSession, binding_id: str) -> TestCaseDatasetBinding | None:
    return await db.scalar(
        select(TestCaseDatasetBinding)
        .where(TestCaseDatasetBinding.id == binding_id)
        .options(selectinload(TestCaseDatasetBinding.dataset))
    )


async def get_binding_by_case_and_dataset(
    db: AsyncSession, *, test_case_id: str, dataset_id: str
) -> TestCaseDatasetBinding | None:
    return await db.scalar(
        select(TestCaseDatasetBinding).where(
            TestCaseDatasetBinding.test_case_id == test_case_id,
            TestCaseDatasetBinding.dataset_id == dataset_id,
        )
    )


async def get_binding_by_case_and_alias(
    db: AsyncSession, *, test_case_id: str, dataset_alias: str
) -> TestCaseDatasetBinding | None:
    return await db.scalar(
        select(TestCaseDatasetBinding).where(
            TestCaseDatasetBinding.test_case_id == test_case_id,
            TestCaseDatasetBinding.dataset_alias == dataset_alias,
        )
    )


async def list_dataset_ids_by_test_case_ids(db: AsyncSession, test_case_ids: list[str]) -> dict[str, list[str]]:
    links = await list_bindings_for_test_cases(db, test_case_ids)
    result: dict[str, list[str]] = {test_case_id: [] for test_case_id in test_case_ids}
    for link in links:
        result.setdefault(link.test_case_id, []).append(link.dataset_id)
    return result


async def get_current_revision(db: AsyncSession, dataset_id: str) -> DatasetRevision | None:
    dataset = await db.scalar(select(TestDataset).where(TestDataset.id == dataset_id))
    if not dataset or dataset.current_revision_number <= 0:
        return None
    return await get_revision_by_number(db, dataset_id=dataset_id, revision_number=dataset.current_revision_number)


async def get_revision_by_number(
    db: AsyncSession,
    *,
    dataset_id: str,
    revision_number: int,
) -> DatasetRevision | None:
    return await db.scalar(
        select(DatasetRevision)
        .where(
            DatasetRevision.dataset_id == dataset_id,
            DatasetRevision.revision_number == revision_number,
        )
        .options(
            selectinload(DatasetRevision.columns),
            selectinload(DatasetRevision.rows),
        )
    )


async def list_revisions(
    db: AsyncSession,
    *,
    dataset_id: str,
    page: int = 1,
    page_size: int = 50,
) -> OffsetPage[DatasetRevision]:
    base_stmt = (
        select(DatasetRevision)
        .where(DatasetRevision.dataset_id == dataset_id)
        .options(selectinload(DatasetRevision.columns), selectinload(DatasetRevision.rows))
        .order_by(DatasetRevision.revision_number.desc())
    )
    count_stmt = select(func.count()).select_from(DatasetRevision).where(DatasetRevision.dataset_id == dataset_id)
    total = await db.scalar(count_stmt) or 0
    offset = (page - 1) * page_size
    result = await db.scalars(base_stmt.limit(page_size + 1).offset(offset))
    rows = result.all()
    has_next = len(rows) > page_size
    return OffsetPage(
        items=list(rows[:page_size]),
        page=page,
        page_size=page_size,
        has_next=has_next,
        total=total,
    )


async def create_revision(
    db: AsyncSession,
    *,
    dataset: TestDataset,
    columns: list[dict],
    rows: list[dict],
    created_by: str | None,
    change_summary: str | None = None,
) -> DatasetRevision:
    next_revision_number = max(0, dataset.current_revision_number) + 1
    revision = DatasetRevision(
        dataset_id=dataset.id,
        revision_number=next_revision_number,
        rows_count=len(rows),
        change_summary=change_summary,
        created_by=created_by,
    )
    db.add(revision)
    await db.flush()

    for idx, column in enumerate(columns):
        db.add(
            DatasetColumn(
                dataset_revision_id=revision.id,
                column_key=column["column_key"],
                display_name=column["display_name"],
                data_type=column.get("data_type") or "string",
                required=bool(column.get("required", False)),
                default_value=column.get("default_value"),
                order_index=idx,
                is_scenario_label=bool(column.get("is_scenario_label", False)),
            )
        )
    for idx, row in enumerate(rows):
        db.add(
            DatasetRow(
                dataset_revision_id=revision.id,
                row_key=row["row_key"],
                scenario_label=row.get("scenario_label"),
                order_index=idx,
                values_json=dict(row.get("values") or {}),
                is_active=bool(row.get("is_active", True)),
            )
        )
    dataset.current_revision_number = next_revision_number
    dataset.current_revision_id = revision.id
    await db.flush()
    await db.refresh(revision, attribute_names=["columns", "rows"])
    return revision
