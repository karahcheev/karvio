from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.test_cases.models import TestCaseStep


async def list_by_test_case(db: AsyncSession, test_case_id: str) -> list[TestCaseStep]:
    result = await db.scalars(
        select(TestCaseStep)
        .where(TestCaseStep.test_case_id == test_case_id)
        .order_by(TestCaseStep.position)
    )
    return list(result.all())


async def list_ids_by_test_case(db: AsyncSession, test_case_id: str) -> list[str]:
    result = await db.scalars(select(TestCaseStep.id).where(TestCaseStep.test_case_id == test_case_id))
    return list(result.all())


async def get_by_id(db: AsyncSession, *, test_case_id: str, step_id: str) -> TestCaseStep | None:
    return await db.scalar(
        select(TestCaseStep).where(
            TestCaseStep.id == step_id,
            TestCaseStep.test_case_id == test_case_id,
        )
    )


async def get_by_step_id(db: AsyncSession, step_id: str) -> TestCaseStep | None:
    return await db.scalar(select(TestCaseStep).where(TestCaseStep.id == step_id))


async def delete_by_test_case(db: AsyncSession, test_case_id: str) -> None:
    await db.execute(delete(TestCaseStep).where(TestCaseStep.test_case_id == test_case_id))
