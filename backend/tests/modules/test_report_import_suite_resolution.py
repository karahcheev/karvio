from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.errors import DomainError
from app.modules.report_import import suite_resolution as service


class _ScalarsResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


@pytest.mark.asyncio
async def test_build_suite_paths_by_id_resolves_hierarchy_and_missing_parent() -> None:
    db = AsyncMock()
    suites = [
        SimpleNamespace(id="s1", parent_id=None, name="Root"),
        SimpleNamespace(id="s2", parent_id="s1", name="Child"),
        SimpleNamespace(id="s3", parent_id="missing", name="Orphan"),
    ]
    db.scalars.return_value = _ScalarsResult(suites)

    out = await service.build_suite_paths_by_id(db, project_id="p1")

    assert out["s1"] == ("Root",)
    assert out["s2"] == ("Root", "Child")
    assert out["s3"] == ("Orphan",)


@pytest.mark.asyncio
async def test_get_suite_depth_by_parent_counts_existing_chain() -> None:
    db = AsyncMock()
    with patch(
        "app.modules.report_import.suite_resolution.suite_repo.get_by_id",
        new_callable=AsyncMock,
        side_effect=[
            SimpleNamespace(parent_id="p2"),
            SimpleNamespace(parent_id=None),
        ],
    ):
        depth = await service.get_suite_depth_by_parent(db, "p1")
    assert depth == 2


@pytest.mark.asyncio
async def test_get_suite_depth_by_parent_stops_when_parent_missing() -> None:
    db = AsyncMock()
    with patch(
        "app.modules.report_import.suite_resolution.suite_repo.get_by_id",
        new_callable=AsyncMock,
        return_value=None,
    ):
        depth = await service.get_suite_depth_by_parent(db, "missing")
    assert depth == 0


@pytest.mark.asyncio
async def test_ensure_suite_path_reuses_existing_and_creates_missing() -> None:
    db = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    current_user = SimpleNamespace(id="u1")

    existing_root = SimpleNamespace(id="s1")
    created_child = SimpleNamespace(id="s2")

    async def _refresh(obj) -> None:
        obj.id = "s2"

    with (
        patch(
            "app.modules.report_import.suite_resolution.suite_repo.get_by_project_parent_and_name",
            new_callable=AsyncMock,
            side_effect=[existing_root, None],
        ),
        patch(
            "app.modules.report_import.suite_resolution.get_suite_depth_by_parent",
            new_callable=AsyncMock,
            return_value=1,
        ),
        patch(
            "app.modules.report_import.suite_resolution.audit_service.queue_create_event",
            new_callable=AsyncMock,
        ) as queue_create,
    ):
        db.refresh.side_effect = _refresh
        out = await service.ensure_suite_path(
            db,
            project_id="p1",
            suite_path=("Root", "Child"),
            _current_user=current_user,
        )

    assert out == "s2"
    db.add.assert_called_once()
    queue_create.assert_awaited_once()


@pytest.mark.asyncio
async def test_ensure_suite_path_depth_limit_exceeded() -> None:
    db = AsyncMock()
    current_user = SimpleNamespace(id="u1")

    with (
        patch(
            "app.modules.report_import.suite_resolution.suite_repo.get_by_project_parent_and_name",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "app.modules.report_import.suite_resolution.get_suite_depth_by_parent",
            new_callable=AsyncMock,
            return_value=4,
        ),
    ):
        with pytest.raises(DomainError) as exc:
            await service.ensure_suite_path(
                db,
                project_id="p1",
                suite_path=("A",),
                _current_user=current_user,
            )

    assert exc.value.code == "suite_depth_limit_exceeded"


@pytest.mark.asyncio
async def test_ensure_suite_path_empty_returns_none() -> None:
    out = await service.ensure_suite_path(
        AsyncMock(),
        project_id="p1",
        suite_path=(),
        _current_user=SimpleNamespace(id="u1"),
    )
    assert out is None
