"""Test plans application logic."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.domain_strings import TITLE_VALIDATION_ERROR
from app.core.errors import not_found
from app.core.errors import DomainError
from app.models.enums import ProjectMemberRole, TestPlanGenerationSource, TestRunStatus
from app.modules.milestones.repositories import milestones as milestone_repo
from app.modules.milestones.services import milestones as milestones_service
from app.modules.products.schemas.plan import PlanGenerationConfig
from app.modules.products.services import facade as products_service
from app.modules.projects.models import User
from app.modules.test_plans.models import TestPlan, TestPlanCase, TestPlanSuite
from app.modules.test_plans.repositories import plans as test_plan_repo
from app.modules.test_plans.schemas.plan import (
    TestPlanCreate,
    TestPlanCreateRunPayload,
    TestPlanGeneratePreviewPayload,
    TestPlanGeneratePreviewResponse,
    TestPlanPatch,
    TestPlanRead,
    TestPlanTagsList,
    TestPlansList,
)
from app.modules.test_cases.repositories import suites as suite_repo
from app.modules.test_cases.repositories import cases as test_case_repo
from app.modules.test_runs.repositories import runs as test_run_repo
from app.modules.test_runs.schemas.runs import TestRunCreate, TestRunRead
from app.services.access import ensure_project_role
from app.core import application_events
from app.modules.test_runs.services import run_cases
from app.modules.test_runs.services import runs


async def _get_plan_or_404(db: AsyncSession, test_plan_id: str) -> TestPlan:
    plan = await test_plan_repo.get_by_id(db, test_plan_id)
    if not plan:
        raise not_found("test_plan")
    return plan


def _build_plan_read(
    plan: TestPlan,
    *,
    name_by_suite_id: dict[str, str],
    key_by_case_id: dict[str, str],
    name_by_milestone_id: dict[str, str],
) -> TestPlanRead:
    suite_ids = [tps.suite_id for tps in plan.suites]
    case_ids = [tpc.test_case_id for tpc in plan.cases]
    return TestPlanRead.model_validate(plan).model_copy(
        update={
            "suite_ids": suite_ids,
            "suite_names": [name_by_suite_id.get(sid, sid) for sid in suite_ids],
            "case_ids": case_ids,
            "case_keys": [key_by_case_id.get(cid, cid) for cid in case_ids],
            "milestone_name": (
                name_by_milestone_id.get(plan.milestone_id, plan.milestone_id)
                if plan.milestone_id
                else None
            ),
        }
    )


async def _enrich_plan_read(db: AsyncSession, plan: TestPlan) -> TestPlanRead:
    suite_ids = [tps.suite_id for tps in plan.suites]
    case_ids = [tpc.test_case_id for tpc in plan.cases]
    name_by_suite_id = await suite_repo.map_names_by_ids(db, suite_ids)
    key_by_case_id = await test_case_repo.map_keys_by_ids(db, case_ids)
    name_by_milestone_id = await milestone_repo.map_names_by_ids(db, [plan.milestone_id] if plan.milestone_id else [])
    return _build_plan_read(
        plan,
        name_by_suite_id=name_by_suite_id,
        key_by_case_id=key_by_case_id,
        name_by_milestone_id=name_by_milestone_id,
    )


async def _validate_suite_ids_for_plan(
    db: AsyncSession,
    *,
    project_id: str,
    suite_ids: list[str],
) -> None:
    seen: set[str] = set()
    for suite_id in suite_ids:
        if suite_id in seen:
            raise DomainError(
                status_code=422,
                code="duplicate_suite",
                title=TITLE_VALIDATION_ERROR,
                detail="Each suite can only be added once",
                errors={"suite_ids": [f"duplicate suite_id: {suite_id}"]},
            )
        seen.add(suite_id)

    for suite_id in suite_ids:
        suite = await suite_repo.get_by_id(db, suite_id)
        if not suite:
            raise not_found("suite")
        if suite.project_id != project_id:
            raise DomainError(
                status_code=422,
                code="suite_project_mismatch",
                title=TITLE_VALIDATION_ERROR,
                detail="All suites must belong to the project",
                errors={"suite_ids": [f"suite {suite_id} does not belong to project"]},
            )


async def _validate_case_ids_for_plan(
    db: AsyncSession,
    *,
    project_id: str,
    case_ids: list[str],
) -> None:
    case_seen: set[str] = set()
    for case_id in case_ids:
        if case_id in case_seen:
            raise DomainError(
                status_code=422,
                code="duplicate_case",
                title=TITLE_VALIDATION_ERROR,
                detail="Each test case can only be added once",
                errors={"case_ids": [f"duplicate case_id: {case_id}"]},
            )
        case_seen.add(case_id)
        tc = await test_case_repo.get_by_id(db, case_id)
        if not tc:
            raise not_found("test_case")
        if tc.project_id != project_id:
            raise DomainError(
                status_code=422,
                code="case_project_mismatch",
                title=TITLE_VALIDATION_ERROR,
                detail="All test cases must belong to the project",
                errors={"case_ids": [f"case {case_id} does not belong to project"]},
            )


async def _replace_plan_suites(
    db: AsyncSession,
    plan: TestPlan,
    suite_ids: list[str],
) -> None:
    seen: set[str] = set()
    for suite_id in suite_ids:
        if suite_id in seen:
            raise DomainError(
                status_code=422,
                code="duplicate_suite",
                title=TITLE_VALIDATION_ERROR,
                detail="Each suite can only be added once",
                errors={"suite_ids": [f"duplicate suite_id: {suite_id}"]},
            )
        seen.add(suite_id)

    for suite_id in suite_ids:
        suite = await suite_repo.get_by_id(db, suite_id)
        if not suite:
            raise not_found("suite")
        if suite.project_id != plan.project_id:
            raise DomainError(
                status_code=422,
                code="suite_project_mismatch",
                title=TITLE_VALIDATION_ERROR,
                detail="All suites must belong to the project",
                errors={"suite_ids": [f"suite {suite_id} does not belong to project"]},
            )

    for tps in list(plan.suites):
        await db.delete(tps)
    await db.flush()
    for suite_id in suite_ids:
        tps = TestPlanSuite(test_plan_id=plan.id, suite_id=suite_id)
        db.add(tps)


async def _replace_plan_cases(
    db: AsyncSession,
    plan: TestPlan,
    case_ids: list[str],
) -> None:
    case_seen: set[str] = set()
    for case_id in case_ids:
        if case_id in case_seen:
            raise DomainError(
                status_code=422,
                code="duplicate_case",
                title=TITLE_VALIDATION_ERROR,
                detail="Each test case can only be added once",
                errors={"case_ids": [f"duplicate case_id: {case_id}"]},
            )
        case_seen.add(case_id)
        tc = await test_case_repo.get_by_id(db, case_id)
        if not tc:
            raise not_found("test_case")
        if tc.project_id != plan.project_id:
            raise DomainError(
                status_code=422,
                code="case_project_mismatch",
                title=TITLE_VALIDATION_ERROR,
                detail="All test cases must belong to the project",
                errors={"case_ids": [f"case {case_id} does not belong to project"]},
            )
    for tpc in list(plan.cases):
        await db.delete(tpc)
    await db.flush()
    for case_id in case_ids:
        tpc = TestPlanCase(test_plan_id=plan.id, test_case_id=case_id)
        db.add(tpc)


async def _resolve_generated_case_ids(
    db: AsyncSession,
    *,
    project_id: str,
    generation_source: TestPlanGenerationSource,
    generation_config,
    current_user: User,
) -> tuple[list[str], dict]:
    if generation_source != TestPlanGenerationSource.product_generated:
        return [], {}
    if generation_config is None:
        raise DomainError(
            status_code=422,
            code="generation_config_required",
            title=TITLE_VALIDATION_ERROR,
            detail="generation_config is required for product_generated plans",
            errors={"generation_config": ["generation_config is required"]},
        )
    preview, reason_map = await products_service.build_plan_generation_preview(
        db,
        project_id=project_id,
        config=generation_config,
        current_user=current_user,
    )
    summary = preview.model_dump()
    summary["reason_map"] = reason_map
    return preview.resolved_case_ids, summary


async def _enrich_plans_read(db: AsyncSession, plans: list[TestPlan]) -> list[TestPlanRead]:
    """Enrich many plans with two bulk lookups (suite names + case keys), preserving per-plan order."""
    if not plans:
        return []
    all_suite_ids: list[str] = []
    all_case_ids: list[str] = []
    all_milestone_ids: list[str] = []
    for plan in plans:
        all_suite_ids.extend(tps.suite_id for tps in plan.suites)
        all_case_ids.extend(tpc.test_case_id for tpc in plan.cases)
        if plan.milestone_id:
            all_milestone_ids.append(plan.milestone_id)
    name_by_suite_id = await suite_repo.map_names_by_ids(db, all_suite_ids)
    key_by_case_id = await test_case_repo.map_keys_by_ids(db, all_case_ids)
    name_by_milestone_id = await milestone_repo.map_names_by_ids(db, all_milestone_ids)
    return [
        _build_plan_read(
            plan,
            name_by_suite_id=name_by_suite_id,
            key_by_case_id=key_by_case_id,
            name_by_milestone_id=name_by_milestone_id,
        )
        for plan in plans
    ]


async def list_test_plans(
    db: AsyncSession,
    *,
    project_id: str,
    search: str | None = None,
    tags: list[str] | None = None,
    milestone_ids: list[str] | None = None,
    page: int = 1,
    page_size: int = 50,
    current_user: User,
) -> TestPlansList:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    result = await test_plan_repo.list_by_project(
        db,
        project_id=project_id,
        search=search,
        tags=tags,
        milestone_ids=milestone_ids,
        page=page,
        page_size=page_size,
    )
    return TestPlansList(
        items=await _enrich_plans_read(db, result.items),
        page=result.page,
        page_size=result.page_size,
        has_next=result.has_next,
        total=result.total or 0,
    )


async def list_test_plan_tags(db: AsyncSession, *, project_id: str, current_user: User) -> TestPlanTagsList:
    await ensure_project_role(db, current_user, project_id, ProjectMemberRole.viewer)
    items = await test_plan_repo.distinct_tags_for_project(db, project_id=project_id)
    return TestPlanTagsList(items=items)


async def create_test_plan(db: AsyncSession, *, payload: TestPlanCreate, current_user: User) -> TestPlanRead:
    await ensure_project_role(db, current_user, payload.project_id, ProjectMemberRole.tester)

    await _validate_suite_ids_for_plan(db, project_id=payload.project_id, suite_ids=payload.suite_ids)
    generated_case_ids, generation_summary = await _resolve_generated_case_ids(
        db,
        project_id=payload.project_id,
        generation_source=payload.generation_source,
        generation_config=payload.generation_config,
        current_user=current_user,
    )
    effective_case_ids = generated_case_ids if payload.generation_source == TestPlanGenerationSource.product_generated else payload.case_ids
    await _validate_case_ids_for_plan(db, project_id=payload.project_id, case_ids=effective_case_ids)

    milestone_id = await milestones_service.ensure_milestone_belongs_to_project(
        db,
        project_id=payload.project_id,
        milestone_id=payload.milestone_id,
    )
    plan = TestPlan(
        project_id=payload.project_id,
        name=payload.name,
        description=payload.description,
        tags=payload.tags or [],
        generation_source=payload.generation_source,
        generation_config=(payload.generation_config.model_dump() if payload.generation_config else {}),
        generation_summary=generation_summary,
        milestone_id=milestone_id,
        created_by=current_user.id,
    )
    db.add(plan)
    await db.flush()
    for suite_id in payload.suite_ids:
        tps = TestPlanSuite(test_plan_id=plan.id, suite_id=suite_id)
        db.add(tps)
    for case_id in effective_case_ids:
        tpc = TestPlanCase(test_plan_id=plan.id, test_case_id=case_id)
        db.add(tpc)

    await application_events.publish(db, application_events.TestPlanCreated(entity=plan))
    await db.flush()
    reloaded = await test_plan_repo.get_by_id(db, plan.id)
    return await _enrich_plan_read(db, reloaded or plan)


async def get_test_plan(db: AsyncSession, *, test_plan_id: str, current_user: User) -> TestPlanRead:
    plan = await _get_plan_or_404(db, test_plan_id)
    await ensure_project_role(db, current_user, plan.project_id, ProjectMemberRole.viewer)
    return await _enrich_plan_read(db, plan)


async def patch_test_plan(
    db: AsyncSession,
    *,
    test_plan_id: str,
    payload: TestPlanPatch,
    current_user: User,
) -> TestPlanRead:
    plan = await _get_plan_or_404(db, test_plan_id)
    await ensure_project_role(db, current_user, plan.project_id, ProjectMemberRole.tester)
    before_state = application_events.snapshot_entity(plan)

    changes = payload.model_dump(exclude_unset=True)
    suite_ids = changes.pop("suite_ids", None)
    case_ids = changes.pop("case_ids", None)
    generation_config = payload.generation_config if "generation_config" in payload.model_fields_set else None
    generation_source = changes.get("generation_source", plan.generation_source)
    if generation_source == TestPlanGenerationSource.product_generated and generation_config is None:
        generation_config = PlanGenerationConfig.model_validate(plan.generation_config or {})
    if "milestone_id" in changes:
        changes["milestone_id"] = await milestones_service.ensure_milestone_belongs_to_project(
            db,
            project_id=plan.project_id,
            milestone_id=changes["milestone_id"],
        )
    generated_case_ids: list[str] | None = None
    generated_summary: dict | None = None
    if "generation_source" in changes or "generation_config" in changes:
        generated_case_ids, generated_summary = await _resolve_generated_case_ids(
            db,
            project_id=plan.project_id,
            generation_source=generation_source,
            generation_config=generation_config,
            current_user=current_user,
        )
        if generation_source == TestPlanGenerationSource.product_generated:
            case_ids = generated_case_ids
            changes["generation_summary"] = generated_summary or {}
        elif "generation_source" in changes:
            changes["generation_summary"] = {}

    for key, value in changes.items():
        if key == "generation_config":
            setattr(plan, key, generation_config.model_dump() if generation_config is not None else {})
            continue
        setattr(plan, key, value)

    if suite_ids is not None:
        await _replace_plan_suites(db, plan, suite_ids)

    if case_ids is not None:
        await _replace_plan_cases(db, plan, case_ids)

    await application_events.publish(db, application_events.TestPlanUpdated(entity=plan, before_state=before_state))
    await db.flush()
    reloaded = await test_plan_repo.get_by_id(db, plan.id)
    return await _enrich_plan_read(db, reloaded or plan)


async def delete_test_plan(db: AsyncSession, *, test_plan_id: str, current_user: User) -> None:
    plan = await _get_plan_or_404(db, test_plan_id)
    await ensure_project_role(db, current_user, plan.project_id, ProjectMemberRole.lead)
    before_state = application_events.snapshot_entity(plan)
    await application_events.publish(
        db,
        application_events.TestPlanDeleted(
            resource_id=plan.id,
            before_state=before_state,
            tenant_id=plan.project_id,
        ),
    )
    await db.delete(plan)


async def create_run_from_test_plan(
    db: AsyncSession,
    *,
    test_plan_id: str,
    payload: TestPlanCreateRunPayload,
    current_user: User,
) -> TestRunRead:
    plan = await _get_plan_or_404(db, test_plan_id)
    await ensure_project_role(db, current_user, plan.project_id, ProjectMemberRole.tester)

    all_suite_ids: list[str] = []
    for tps in plan.suites:
        all_suite_ids.extend(await suite_repo.collect_suite_ids_with_descendants(db, tps.suite_id))
    all_suite_ids = list(dict.fromkeys(all_suite_ids))

    case_ids_from_suites = await test_case_repo.list_active_ids_by_suite_ids(db, all_suite_ids)
    explicit_case_ids = [tpc.test_case_id for tpc in plan.cases]
    case_ids_from_explicit = await test_case_repo.list_active_ids_from_ids(db, explicit_case_ids)
    case_ids = list(dict.fromkeys(case_ids_from_suites + case_ids_from_explicit))

    if not case_ids:
        raise DomainError(
            status_code=422,
            code="no_active_cases",
            title=TITLE_VALIDATION_ERROR,
            detail="No active test cases found in plan suites or selected cases",
            errors={"test_plan_id": ["plan contains no active test cases"]},
        )

    run_payload = TestRunCreate(
        project_id=plan.project_id,
        name=payload.name,
        description=payload.description,
        environment_id=payload.environment_id,
        build=payload.build,
        assignee=payload.assignee,
        milestone_id=(
            payload.milestone_id
            if "milestone_id" in payload.model_fields_set
            else plan.milestone_id
        ),
    )
    run = await runs.create_test_run(db, payload=run_payload, current_user=current_user)

    entries: list[tuple[str, str | None]] = [(case_id, None) for case_id in case_ids]
    run_model = await test_run_repo.get_by_id(db, run.id)
    if not run_model:
        raise not_found("test_run")
    await run_cases.bulk_create_run_case_entries(db, run=run_model, entries=entries)

    if payload.start_immediately:
        from app.modules.test_runs.schemas.runs import TestRunPatch

        run = await runs.patch_test_run(
            db,
            test_run_id=run.id,
            payload=TestRunPatch(status=TestRunStatus.in_progress),
            current_user=current_user,
        )
    else:
        run = await runs.get_test_run(db, test_run_id=run.id, current_user=current_user)

    return run


async def generate_test_plan_preview(
    db: AsyncSession,
    *,
    payload: TestPlanGeneratePreviewPayload,
    current_user: User,
) -> TestPlanGeneratePreviewResponse:
    preview, _ = await products_service.build_plan_generation_preview(
        db,
        project_id=payload.project_id,
        config=payload.config,
        current_user=current_user,
    )
    return TestPlanGeneratePreviewResponse(preview=preview)
