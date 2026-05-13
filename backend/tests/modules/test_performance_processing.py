from app.models.enums import ProjectMemberRole
from app.modules.performance.services.import_worker import process_performance_import
from app.modules.performance.models import PerformanceImport, PerformanceRun
from app.modules.performance.storage import PerformanceArtifactStorage
from app.modules.projects.models import Project, ProjectMember, User


async def _seed_import_with_source(db_session, auth_user: User, storage: PerformanceArtifactStorage, source_bytes: bytes) -> str:
    project = Project(id="proj_perf_processing", name="Perf Processing")
    membership = ProjectMember(project_id=project.id, user_id=auth_user.id, role=ProjectMemberRole.tester)
    run = PerformanceRun(
        id="prf_proc_1",
        project_id=project.id,
        name="seed run",
        service="svc",
        env="stage",
        scenario="scenario",
        load_profile="profile",
        branch="main",
        commit="abc1234",
        build="bld-1",
        version="v1",
        tool="k6",
        status="running",
        verdict="yellow",
        load_kind="http",
    )
    stored = storage.save_bytes(
        source_bytes,
        filename="source.json",
        content_type="application/json",
        entity_type="performance-imports",
        entity_id=run.id,
    )
    perf_import = PerformanceImport(
        id="pimp_proc_1",
        project_id=project.id,
        run_id=run.id,
        status="pending",
        parse_status="partial",
        source_filename=stored.filename,
        source_content_type=stored.content_type,
        source_storage_backend=stored.storage_backend,
        source_storage_key=stored.storage_key,
        source_size_bytes=stored.size,
        created_by=auth_user.id,
    )
    db_session.add_all([project, membership, run, perf_import])
    await db_session.commit()
    return perf_import.id


async def test_process_performance_import_returns_false_for_missing_import(db_session, tmp_path) -> None:
    storage = PerformanceArtifactStorage(str(tmp_path / "performance-artifacts"))
    processed = await process_performance_import(db_session, import_id="missing_import_id", storage=storage)
    assert processed is False


async def test_process_performance_import_marks_failed_on_invalid_payload(db_session, auth_user: User, tmp_path) -> None:
    storage = PerformanceArtifactStorage(str(tmp_path / "performance-artifacts"))
    import_id = await _seed_import_with_source(db_session, auth_user, storage, b"plain text")

    processed = await process_performance_import(db_session, import_id=import_id, storage=storage)
    assert processed is False

    db_session.expire_all()
    failed_import = await db_session.get(PerformanceImport, import_id)
    assert failed_import is not None
    assert failed_import.status == "failed"
    assert failed_import.parse_status == "failed"
    assert failed_import.error_detail
