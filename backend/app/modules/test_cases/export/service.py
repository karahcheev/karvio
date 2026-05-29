from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.models.enums import ProjectMemberRole
from app.modules.projects.models import User
from app.modules.attachments.services.storage import get_test_case_or_404
from app.modules.test_cases.export.adapters.csv_format import serialize_csv
from app.modules.test_cases.export.adapters.junit_xml import serialize_junit_xml
from app.modules.test_cases.export.adapters.native_json import serialize_native_json
from app.modules.test_cases.export.adapters.testlink_xml import serialize_testlink_xml
from app.modules.test_cases.export.adapters.xray_json import serialize_xray_json
from app.modules.test_cases.export.formats import TestCaseExportFormat
from app.modules.test_cases.export.payload import build_export_cases
from app.modules.test_cases.repositories import cases as test_case_repo
from app.modules.test_cases.schemas.case import TestCaseListQuery
from app.services.access import ensure_project_role

_MAX_BULK_CASES = 10_000

_SERIALIZERS = {
    TestCaseExportFormat.csv: serialize_csv,
    TestCaseExportFormat.testlink_xml: serialize_testlink_xml,
    TestCaseExportFormat.xray_json: serialize_xray_json,
    TestCaseExportFormat.native_json: serialize_native_json,
    TestCaseExportFormat.junit_xml: serialize_junit_xml,
}


@dataclass(frozen=True, slots=True)
class TestCaseExportResult:
    content: bytes
    media_type: str
    filename: str


def _serialize(cases, *, export_format: TestCaseExportFormat) -> tuple[bytes, str, str]:
    return _SERIALIZERS[export_format](cases)


async def export_single(
    db: AsyncSession,
    *,
    test_case_id: str,
    export_format: TestCaseExportFormat,
    current_user: User,
) -> TestCaseExportResult:
    test_case = await get_test_case_or_404(db, test_case_id)
    await ensure_project_role(db, current_user, test_case.project_id, ProjectMemberRole.viewer)
    reloaded = await test_case_repo.get_by_id(db, test_case_id) or test_case
    exported = await build_export_cases(db, [reloaded])
    content, media_type, extension = _serialize(exported, export_format=export_format)
    filename = f"{reloaded.key}.{extension}"
    return TestCaseExportResult(content=content, media_type=media_type, filename=filename)


async def _collect_filtered_cases(
    db: AsyncSession, *, project_id: str, query: TestCaseListQuery
) -> list:
    collected: list = []
    page = 1
    while True:
        result = await test_case_repo.list_by_project(
            db,
            project_id=project_id,
            page=page,
            page_size=200,
            search=query.search,
            status_filters=query.status,
            priority_filters=query.priority,
            suite_ids=query.suite_id,
            tags=query.tag,
            owner_id=query.owner_id,
            test_case_types=query.test_case_type,
            product_ids=query.product_id,
            component_ids=query.component_id,
            minimum_component_risk_level=query.minimum_component_risk_level,
            exclude_test_case_ids=query.exclude_test_case_id or [],
            sort_by=query.sort_by,
            sort_direction=query.sort_order,
        )
        collected.extend(result.items)
        if not result.has_next or len(collected) >= _MAX_BULK_CASES:
            break
        page += 1
    return collected[:_MAX_BULK_CASES]


async def export_bulk(
    db: AsyncSession,
    *,
    project_id: str,
    query: TestCaseListQuery,
    test_case_ids: list[str] | None,
    export_format: TestCaseExportFormat,
    current_user: User,
) -> TestCaseExportResult:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)

    if test_case_ids:
        rows = await test_case_repo.list_by_ids(db, test_case_ids)
        test_cases = [tc for tc in rows if tc.project_id == project_id]
        if not test_cases:
            raise not_found("test_case")
    else:
        test_cases = await _collect_filtered_cases(db, project_id=project_id, query=query)

    exported = await build_export_cases(db, test_cases)
    content, media_type, extension = _serialize(exported, export_format=export_format)
    filename = f"test-cases-{project_id}.{extension}"
    return TestCaseExportResult(content=content, media_type=media_type, filename=filename)
