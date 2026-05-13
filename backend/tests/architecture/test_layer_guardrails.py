"""Architecture guardrails: compare current imports against legacy baselines."""

from __future__ import annotations

import ast
from collections import Counter
from pathlib import Path

from tests.architecture.import_analysis import (
    collect_api_deps_imports,
    collect_fastapi_in_services,
    collect_fastapi_starlette_imports,
    collect_private_cross_module_imports,
    collect_private_cross_service_imports,
    collect_router_imports,
    collect_schema_imports,
    iter_module_models_files,
    iter_module_repository_files,
    iter_module_service_like_files,
    iter_py_files,
)
from tests.architecture.legacy_violations_baseline import (
    LEGACY_FASTAPI_IMPORTS_IN_SERVICES_COUNTER,
    LEGACY_PRIVATE_CROSS_SERVICE_IMPORTS,
    LEGACY_SCHEMA_IMPORTS_IN_SERVICES_COUNTER,
    MODULE_FASTAPI_IMPORTS_IN_SERVICES_COUNTER,
    MODULE_PRIVATE_CROSS_MODULE_IMPORTS,
)

BACKEND_ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = BACKEND_ROOT / "app"
MODULES_ROOT = APP_ROOT / "modules"


def _counter_extra_message(current: Counter, allowed: Counter, rule: str) -> str:
    if current <= allowed:
        return ""
    extra = current - allowed
    sample = sorted(extra.items())[:20]
    more = len(extra) - len(sample)
    tail = f" … (+{more} more)" if more > 0 else ""
    return f"\n[{rule}] new violations (not covered by allowlist): {sample}{tail}"


def test_services_schema_imports_not_worse_than_baseline() -> None:
    current: Counter[tuple[str, str, frozenset[str]]] = Counter()
    for path in iter_py_files(APP_ROOT / "services"):
        rel = str(path.relative_to(APP_ROOT))
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for v in collect_schema_imports(rel, tree):
            current[(v.rel_path, v.schema_module, v.imported_names)] += 1
    assert current <= LEGACY_SCHEMA_IMPORTS_IN_SERVICES_COUNTER, _counter_extra_message(
        current, LEGACY_SCHEMA_IMPORTS_IN_SERVICES_COUNTER, "schemas in services"
    )


def test_repositories_have_no_schema_imports() -> None:
    current: Counter[tuple[str, str, frozenset[str]]] = Counter()
    for path in iter_py_files(APP_ROOT / "repositories"):
        rel = str(path.relative_to(APP_ROOT))
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for v in collect_schema_imports(rel, tree):
            current[(v.rel_path, v.schema_module, v.imported_names)] += 1
    assert not current, f"\n[schemas in repositories] forbidden: {sorted(current.items())}"


def test_models_have_no_schema_imports() -> None:
    current: Counter[tuple[str, str, frozenset[str]]] = Counter()
    for path in iter_py_files(APP_ROOT / "models"):
        rel = str(path.relative_to(APP_ROOT))
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for v in collect_schema_imports(rel, tree):
            current[(v.rel_path, v.schema_module, v.imported_names)] += 1
    assert not current, f"\n[schemas in models] forbidden: {sorted(current.items())}"


def test_services_fastapi_imports_not_worse_than_baseline() -> None:
    current: Counter[tuple[str, str, frozenset[str]]] = Counter()
    for path in iter_py_files(APP_ROOT / "services"):
        rel = str(path.relative_to(APP_ROOT))
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for v in collect_fastapi_in_services(rel, tree):
            current[(v.rel_path, v.vendor_module, v.imported_names)] += 1
    assert current <= LEGACY_FASTAPI_IMPORTS_IN_SERVICES_COUNTER, _counter_extra_message(
        current, LEGACY_FASTAPI_IMPORTS_IN_SERVICES_COUNTER, "fastapi/starlette in services"
    )


def test_no_new_private_cross_service_imports() -> None:
    current: set[tuple[str, str, str]] = set()
    for path in iter_py_files(APP_ROOT / "services"):
        rel = str(path.relative_to(APP_ROOT))
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for v in collect_private_cross_service_imports(rel, tree):
            current.add((v.importer_rel_path, v.source_module, v.imported_name))
    assert current.issubset(LEGACY_PRIVATE_CROSS_SERVICE_IMPORTS), (
        f"\n[private imports across app.services] new: {sorted(current - LEGACY_PRIVATE_CROSS_SERVICE_IMPORTS)}"
    )


def test_module_services_fastapi_imports_not_worse_than_baseline() -> None:
    current: Counter[tuple[str, str, frozenset[str]]] = Counter()
    for path in iter_module_service_like_files(MODULES_ROOT):
        rel = str(path.relative_to(APP_ROOT))
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for v in collect_fastapi_starlette_imports(rel, tree):
            current[(v.rel_path, v.vendor_module, v.imported_names)] += 1
    assert current <= MODULE_FASTAPI_IMPORTS_IN_SERVICES_COUNTER, _counter_extra_message(
        current, MODULE_FASTAPI_IMPORTS_IN_SERVICES_COUNTER, "fastapi/starlette in modules/*service*"
    )


def test_no_new_private_cross_module_imports() -> None:
    current: set[tuple[str, str, str]] = set()
    for path in iter_py_files(MODULES_ROOT):
        rel = str(path.relative_to(APP_ROOT))
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for v in collect_private_cross_module_imports(rel, tree):
            current.add((v.importer_rel_path, v.source_module, v.imported_name))
    assert current.issubset(MODULE_PRIVATE_CROSS_MODULE_IMPORTS), (
        f"\n[private imports in app.modules] new: {sorted(current - MODULE_PRIVATE_CROSS_MODULE_IMPORTS)}"
    )


def test_module_repositories_have_no_router_imports() -> None:
    current: Counter[tuple[str, str, frozenset[str]]] = Counter()
    for path in iter_module_repository_files(MODULES_ROOT):
        rel = str(path.relative_to(APP_ROOT))
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for v in collect_router_imports(rel, tree):
            current[(v.rel_path, v.source_module, v.imported_names)] += 1
    assert not current, f"\n[router in module repositories] forbidden: {sorted(current.items())}"


def test_module_models_have_no_router_or_api_deps_imports() -> None:
    current_router: Counter[tuple[str, str, frozenset[str]]] = Counter()
    current_deps: Counter[tuple[str, str, frozenset[str]]] = Counter()
    for path in iter_module_models_files(MODULES_ROOT):
        rel = str(path.relative_to(APP_ROOT))
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for v in collect_router_imports(rel, tree):
            current_router[(v.rel_path, v.source_module, v.imported_names)] += 1
        for v in collect_api_deps_imports(rel, tree):
            current_deps[(v.rel_path, v.source_module, v.imported_names)] += 1
    assert not current_router, f"\n[router in module models] forbidden: {sorted(current_router.items())}"
    assert not current_deps, f"\n[app.api.deps in module models] forbidden: {sorted(current_deps.items())}"
