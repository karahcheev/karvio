from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.db.session import get_db
from app.models.enums import ExternalIssueOwnerType
from app.modules.integrations.jira.clients.api import JiraApiClient
from app.modules.integrations.jira.schemas.integration import (
    ExternalIssueLinkRead,
    ExternalIssueLinksList,
    JiraConnectCallbackResponse,
    JiraConnectionList,
    JiraConnectionPatch,
    JiraConnectionRead,
    JiraIssueCreateFromRunCaseRequest,
    JiraIssueCreateFromRunCasesRequest,
    JiraIssueLinkRequest,
    JiraIssueLinkRunCasesRequest,
    JiraIssueResolveResponse,
    JiraProjectMappingCreate,
    JiraProjectMappingList,
    JiraProjectMappingPatch,
    JiraProjectMappingRead,
    JiraSystemSettingsRead,
    JiraSystemSettingsUpdate,
    JiraSyncRefreshRequest,
    JiraSyncRefreshResponse,
)
from app.modules.integrations.jira.services import integration
from app.modules.projects.models import User

router = APIRouter(prefix="/integrations/jira", tags=["integrations-jira"])


async def get_jira_client(db: Annotated[AsyncSession, Depends(get_db)]) -> JiraApiClient:
    runtime_settings = await integration.get_runtime_client_settings(db)
    return JiraApiClient(runtime_settings=runtime_settings)


@router.get("/settings")
async def get_jira_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> JiraSystemSettingsRead:
    return await integration.get_system_settings(db, current_user=current_user)


@router.put("/settings")
async def upsert_jira_settings(
    payload: JiraSystemSettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> JiraSystemSettingsRead:
    return await integration.upsert_system_settings(db, current_user=current_user, payload=payload)


@router.post("/connect/api-token")
async def connect_api_token(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    client: Annotated[JiraApiClient, Depends(get_jira_client)],
) -> JiraConnectCallbackResponse:
    return await integration.connect_with_api_token(db, current_user=current_user, client=client)


@router.get("/connections")
async def list_connections(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> JiraConnectionList:
    return await integration.list_connections(db, _current_user=current_user)


@router.delete("/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    connection_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await integration.disconnect_connection(db, current_user=current_user, connection_id=connection_id)


@router.patch("/connections/{connection_id}")
async def patch_connection(
    connection_id: Annotated[str, Path(...)],
    payload: JiraConnectionPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> JiraConnectionRead:
    return await integration.patch_connection(
        db,
        current_user=current_user,
        connection_id=connection_id,
        payload=payload,
    )


@router.get("/mappings")
async def list_mappings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    project_id: Annotated[str | None, Query()] = None,
) -> JiraProjectMappingList:
    return await integration.list_mappings(db, current_user=current_user, project_id=project_id)


@router.post("/mappings", status_code=status.HTTP_201_CREATED)
async def create_mapping(
    payload: JiraProjectMappingCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    client: Annotated[JiraApiClient, Depends(get_jira_client)],
) -> JiraProjectMappingRead:
    return await integration.create_mapping(db, current_user=current_user, payload=payload, client=client)


@router.patch("/mappings/{mapping_id}")
async def patch_mapping(
    mapping_id: Annotated[str, Path(...)],
    payload: JiraProjectMappingPatch,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    client: Annotated[JiraApiClient, Depends(get_jira_client)],
) -> JiraProjectMappingRead:
    return await integration.patch_mapping(
        db,
        current_user=current_user,
        mapping_id=mapping_id,
        payload=payload,
        client=client,
    )


@router.delete("/mappings/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mapping(
    mapping_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await integration.delete_mapping(db, current_user=current_user, mapping_id=mapping_id)


@router.get("/issues/resolve")
async def resolve_issue(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    client: Annotated[JiraApiClient, Depends(get_jira_client)],
    key: Annotated[str, Query(min_length=2)],
    project_id: Annotated[str | None, Query()] = None,
) -> JiraIssueResolveResponse:
    return await integration.resolve_issue(
        db,
        current_user=current_user,
        key=key,
        project_id=project_id,
        client=client,
    )


@router.get("/issues/links")
async def list_issue_links(
    owner_type: Annotated[ExternalIssueOwnerType, Query()],
    owner_id: Annotated[str, Query()],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ExternalIssueLinksList:
    return await integration.list_owner_links(
        db,
        current_user=current_user,
        owner_type=owner_type,
        owner_id=owner_id,
    )


@router.post("/issues/link", status_code=status.HTTP_201_CREATED)
async def link_issue(
    payload: JiraIssueLinkRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    client: Annotated[JiraApiClient, Depends(get_jira_client)],
) -> ExternalIssueLinkRead:
    return await integration.link_issue(db, current_user=current_user, payload=payload, client=client)


@router.post("/issues/create-from-run-case", status_code=status.HTTP_201_CREATED)
async def create_issue_from_run_case(
    payload: JiraIssueCreateFromRunCaseRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    client: Annotated[JiraApiClient, Depends(get_jira_client)],
) -> ExternalIssueLinkRead:
    return await integration.create_issue_from_run_case(
        db,
        current_user=current_user,
        payload=payload,
        client=client,
    )


@router.post("/issues/create-from-run-cases", status_code=status.HTTP_201_CREATED)
async def create_issue_from_run_cases(
    payload: JiraIssueCreateFromRunCasesRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    client: Annotated[JiraApiClient, Depends(get_jira_client)],
) -> ExternalIssueLinksList:
    return await integration.create_issue_from_run_cases(
        db,
        current_user=current_user,
        payload=payload,
        client=client,
    )


@router.post("/issues/link-run-cases", status_code=status.HTTP_201_CREATED)
async def link_issue_to_run_cases(
    payload: JiraIssueLinkRunCasesRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    client: Annotated[JiraApiClient, Depends(get_jira_client)],
) -> ExternalIssueLinksList:
    return await integration.link_issue_to_run_cases(
        db,
        current_user=current_user,
        payload=payload,
        client=client,
    )


@router.delete("/issues/link/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_issue(
    link_id: Annotated[str, Path(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await integration.unlink_issue(db, current_user=current_user, link_id=link_id)


@router.post("/sync/refresh")
async def refresh_sync(
    payload: JiraSyncRefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    client: Annotated[JiraApiClient, Depends(get_jira_client)],
) -> JiraSyncRefreshResponse:
    return await integration.refresh_sync(db, current_user=current_user, payload=payload, client=client)
