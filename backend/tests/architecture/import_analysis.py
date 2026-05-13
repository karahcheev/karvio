"""AST helpers for architecture tests (imports without executing code)."""

from __future__ import annotations

import ast
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class SchemaImportViolation:
    """Import of app.schemas from application/persistence/domain layers."""

    rel_path: str
    schema_module: str
    imported_names: frozenset[str]


@dataclass(frozen=True, slots=True)
class FastApiImportViolation:
    """Import of fastapi/starlette (transport-layer types)."""

    rel_path: str
    vendor_module: str
    imported_names: frozenset[str]


@dataclass(frozen=True, slots=True)
class PrivateModuleImportViolation:
    """Import of a leading-underscore name from another app.modules.* module."""

    importer_rel_path: str
    source_module: str
    imported_name: str


@dataclass(frozen=True, slots=True)
class RouterImportViolation:
    """Import of router (transport) code from persistence/domain layers."""

    rel_path: str
    source_module: str
    imported_names: frozenset[str]


@dataclass(frozen=True, slots=True)
class ApiDepsImportViolation:
    """Import of app.api.deps from layers outside HTTP/API."""

    rel_path: str
    source_module: str
    imported_names: frozenset[str]


def _import_from_names(node: ast.ImportFrom) -> frozenset[str]:
    names: list[str] = []
    for alias in node.names:
        if alias.name == "*":
            names.append("*")
        else:
            names.append(alias.name)
    return frozenset(names)


def collect_schema_imports(rel_path: str, tree: ast.AST) -> list[SchemaImportViolation]:
    out: list[SchemaImportViolation] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                name = alias.name
                if name == "app.schemas" or name.startswith("app.schemas."):
                    out.append(SchemaImportViolation(rel_path, name, frozenset({name})))
        elif isinstance(node, ast.ImportFrom) and node.module:
            mod = node.module
            if mod == "app.schemas" or mod.startswith("app.schemas."):
                out.append(SchemaImportViolation(rel_path, mod, _import_from_names(node)))
    return out


def collect_fastapi_starlette_imports(rel_path: str, tree: ast.AST) -> list[FastApiImportViolation]:
    out: list[FastApiImportViolation] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.ImportFrom) or not node.module:
            continue
        mod = node.module
        if mod == "fastapi" or mod.startswith("fastapi."):
            out.append(FastApiImportViolation(rel_path, mod, _import_from_names(node)))
        elif mod == "starlette" or mod.startswith("starlette."):
            out.append(FastApiImportViolation(rel_path, mod, _import_from_names(node)))
    return out


def collect_private_cross_service_imports(rel_path: str, tree: ast.AST) -> list[PrivateModuleImportViolation]:
    """Detect `from app.services.X import _foo` (source name starts with _)."""
    out: list[PrivateModuleImportViolation] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.ImportFrom) or not node.module:
            continue
        if not node.module.startswith("app.services."):
            continue
        for alias in node.names:
            if alias.name.startswith("_"):
                out.append(
                    PrivateModuleImportViolation(
                        importer_rel_path=rel_path,
                        source_module=node.module,
                        imported_name=alias.name,
                    )
                )
    return out


def collect_private_cross_module_imports(rel_path: str, tree: ast.AST) -> list[PrivateModuleImportViolation]:
    """Detect `from app.modules.... import _foo` (source symbol has a leading underscore)."""
    out: list[PrivateModuleImportViolation] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.ImportFrom) or not node.module:
            continue
        if not node.module.startswith("app.modules."):
            continue
        for alias in node.names:
            if alias.name != "*" and alias.name.startswith("_"):
                out.append(
                    PrivateModuleImportViolation(
                        importer_rel_path=rel_path,
                        source_module=node.module,
                        imported_name=alias.name,
                    )
                )
    return out


def _is_app_modules_router_module(module_path: str) -> bool:
    """True for app.modules.<pkg>.router or ...router_<suffix>."""
    if not module_path.startswith("app.modules."):
        return False
    parts = module_path.split(".")
    if len(parts) < 4:
        return False
    leaf = parts[-1]
    return leaf == "router" or leaf.startswith("router_")


def collect_router_imports(rel_path: str, tree: ast.AST) -> list[RouterImportViolation]:
    """Imports of router modules under app.modules (including `from app.modules.x import router`)."""
    out: list[RouterImportViolation] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                name = alias.name
                if _is_app_modules_router_module(name):
                    out.append(RouterImportViolation(rel_path, name, frozenset({name})))
        elif isinstance(node, ast.ImportFrom) and node.module:
            mod = node.module
            if _is_app_modules_router_module(mod):
                out.append(RouterImportViolation(rel_path, mod, _import_from_names(node)))
            elif mod.startswith("app.modules.") and len(mod.split(".")) == 3:
                for alias in node.names:
                    if alias.name == "*":
                        continue
                    if alias.name == "router" or alias.name.startswith("router_"):
                        full = f"{mod}.{alias.name}"
                        if _is_app_modules_router_module(full):
                            out.append(
                                RouterImportViolation(rel_path, full, frozenset({alias.name}))
                            )
    return out


def collect_api_deps_imports(rel_path: str, tree: ast.AST) -> list[ApiDepsImportViolation]:
    out: list[ApiDepsImportViolation] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                name = alias.name
                if name == "app.api.deps" or name.startswith("app.api.deps."):
                    out.append(ApiDepsImportViolation(rel_path, name, frozenset({name})))
        elif isinstance(node, ast.ImportFrom) and node.module:
            mod = node.module
            if mod == "app.api.deps" or mod.startswith("app.api.deps."):
                out.append(ApiDepsImportViolation(rel_path, mod, _import_from_names(node)))
    return out


def iter_py_files(root: Path) -> list[Path]:
    return sorted(p for p in root.rglob("*.py") if p.is_file())


def iter_module_service_like_files(modules_root: Path) -> list[Path]:
    """Module services / use cases: *service*.py or service.py."""
    out: list[Path] = []
    for path in iter_py_files(modules_root):
        if path.name == "__init__.py":
            continue
        name = path.name
        if name == "service.py" or "service" in name.lower():
            out.append(path)
    return out


def iter_module_repository_files(modules_root: Path) -> list[Path]:
    """repository.py, repositories/ package, or *_repository.py."""
    out: list[Path] = []
    for path in iter_py_files(modules_root):
        if path.name == "__init__.py":
            continue
        if path.name == "repository.py" or path.name.endswith("_repository.py"):
            out.append(path)
            continue
        if "repositories" in path.parts:
            out.append(path)
    return out


def iter_module_models_files(modules_root: Path) -> list[Path]:
    return [p for p in iter_py_files(modules_root) if p.name == "models.py"]


# Backwards-compatible names for existing tests
FastApiInServiceViolation = FastApiImportViolation


def collect_fastapi_in_services(rel_path: str, tree: ast.AST) -> list[FastApiImportViolation]:
    return collect_fastapi_starlette_imports(rel_path, tree)
