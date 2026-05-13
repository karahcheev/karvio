from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Path, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.modules.projects.models import User
from app.modules.report_import.schemas.imports import JunitImportRead, JunitXmlUpload
from app.modules.report_import.services import junit_import as junit_import_service
from app.modules.report_import.services.uploads import read_report_upload_to_temp

router = APIRouter(tags=["report-import"])


@router.post("/projects/{project_id}/imports/junit", status_code=status.HTTP_201_CREATED)
async def import_project_junit_xml(
    project_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    file: Annotated[UploadFile, File(...)],
    create_missing_cases: Annotated[bool, Query()] = False,
) -> JunitImportRead:
    tmp_path = await read_report_upload_to_temp(file)
    try:
        body = JunitXmlUpload(
            path=tmp_path,
            filename=file.filename,
            content_type=file.content_type,
        )
        return await junit_import_service.import_junit_xml_for_project(
            db,
            project_id=project_id,
            upload=body,
            create_missing_cases=create_missing_cases,
            current_user=current_user,
        )
    finally:
        tmp_path.unlink(missing_ok=True)
