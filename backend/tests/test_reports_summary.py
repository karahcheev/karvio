from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.models.enums import RunItemStatus, TestRunStatus as RunStatus
from app.modules.projects.models import Project
from app.modules.reports.repositories.queries import ProjectOverviewRunRow, fetch_project_runs
from app.modules.reports.services.summary import build_project_overview_payload
from app.modules.test_runs.models import TestRun as RunModel


@dataclass(slots=True)
class DummyRun:
    id: str
    name: str
    environment_name_snapshot: str | None
    environment_revision_number: int | None
    build: str | None
    created_at: datetime
    updated_at: datetime
    status: RunStatus


def test_build_project_overview_payload_applies_top_n_limits() -> None:
    base_time = datetime(2026, 3, 1, tzinfo=timezone.utc)
    builds = ["build-a", "build-a", "build-b", "build-c"]
    environments = ["staging", "staging", "prod", "staging"]
    runs = [
        DummyRun(
            id=f"run_{index}",
            name=f"Run {index}",
            environment_name_snapshot=environments[index],
            environment_revision_number=None,
            build=builds[index],
            created_at=base_time + timedelta(days=index),
            updated_at=base_time + timedelta(days=index),
            status=RunStatus.completed,
        )
        for index in range(4)
    ]

    status_by_run = {
        "run_0": {RunItemStatus.passed.value: 5, RunItemStatus.failure.value: 1},
        "run_1": {RunItemStatus.passed.value: 7, RunItemStatus.failure.value: 2},
        "run_2": {RunItemStatus.passed.value: 9, RunItemStatus.failure.value: 3},
        "run_3": {RunItemStatus.passed.value: 11, RunItemStatus.failure.value: 4},
    }

    payload = build_project_overview_payload(
        project_id="proj_1",
        created_from=None,
        created_to=None,
        top_n=2,
        runs=runs,
        status_by_run=status_by_run,
        assignee_rows=[("user_1", 6), ("user_2", 4), ("user_3", 2)],
        user_names_by_id={"user_1": "User 1", "user_2": "User 2", "user_3": "User 3"},
    )

    assert [item["run_id"] for item in payload["failures_by_run"]] == ["run_2", "run_3"]
    assert len(payload["execution_by_assignee"]) == 2
    assert [item["assignee_id"] for item in payload["execution_by_assignee"]] == ["user_1", "user_2"]
    assert payload["granularity"] == "day"
    assert len(payload["execution_trend"]) == 4
    assert len(payload["status_trend"]) == 4
    assert payload["runs_by_environment"] == [{"environment": "staging", "runs": 3}, {"environment": "prod", "runs": 1}]
    assert payload["runs_by_build"] == [{"build": "build-a", "runs": 2}, {"build": "build-b", "runs": 1}]


def test_build_project_overview_payload_aggregates_weekly_timesteps() -> None:
    base_time = datetime(2026, 3, 2, tzinfo=timezone.utc)  # Monday
    runs = [
        DummyRun(
            id="run_week_1",
            name="Run Week 1",
            environment_name_snapshot="staging",
            environment_revision_number=None,
            build="build-x",
            created_at=base_time,
            updated_at=base_time,
            status=RunStatus.completed,
        ),
        DummyRun(
            id="run_week_2",
            name="Run Week 2",
            environment_name_snapshot="staging",
            environment_revision_number=None,
            build="build-x",
            created_at=base_time + timedelta(days=2),
            updated_at=base_time + timedelta(days=2),
            status=RunStatus.completed,
        ),
    ]

    payload = build_project_overview_payload(
        project_id="proj_2",
        created_from=None,
        created_to=None,
        top_n=8,
        granularity="week",
        runs=runs,
        status_by_run={
            "run_week_1": {RunItemStatus.passed.value: 3, RunItemStatus.failure.value: 1},
            "run_week_2": {RunItemStatus.passed.value: 2, RunItemStatus.error.value: 2},
        },
        assignee_rows=[],
        user_names_by_id={},
    )

    assert payload["granularity"] == "week"
    assert len(payload["execution_trend"]) == 1
    assert payload["execution_trend"][0]["runs"] == 2
    assert payload["status_trend"][0]["failure"] == 1
    assert payload["status_trend"][0]["error"] == 2


async def test_fetch_project_runs_returns_lightweight_projection_rows(db_session) -> None:
    project = Project(id="proj_reports_projection", name="Reports Projection")
    run = RunModel(
        id="run_reports_projection",
        project_id=project.id,
        name="Projection run",
        build="build-42",
        status=RunStatus.in_progress,
        environment_name_snapshot="staging",
        environment_revision_number=7,
    )
    db_session.add_all([project, run])
    await db_session.commit()

    rows = await fetch_project_runs(
        db_session,
        project_id=project.id,
        created_from=None,
        created_to=None,
    )

    assert len(rows) == 1
    assert isinstance(rows[0], ProjectOverviewRunRow)
    assert rows[0].id == run.id
    assert rows[0].name == "Projection run"
    assert rows[0].build == "build-42"
    assert rows[0].status == RunStatus.in_progress
