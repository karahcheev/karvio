"""Allowlist of known legacy architecture violations.

Domain code lives under app/modules; app/services retains access/bootstrap only.
The baseline for schemas/fastapi in app/services is empty — new violations there are not allowed.

Known violations under app/modules may be listed separately (e.g. FastAPI in *service*.py until
refactored; cross-feature private imports until replaced with public APIs).

Import keys use (path, module, frozenset(names)) so the baseline does not break when line numbers shift.

---- HOW TO USE THIS FILE ----
Each baseline is a frozen allowlist. The tests enforce:
  current_violations <= baseline_violations   (no regressions)

To retire a violation: remove its entry here and fix the underlying import.
To add a NEW violation: don't — fix the code instead. Only add to a baseline if you are
explicitly grandfathering unavoidable legacy code after a team discussion.

---- CURRENT STATE ----
All baselines are empty: there are no known grandfathered violations at this time.
If a test starts failing with "new violations", DO NOT add to the baseline — fix the import.
"""

from __future__ import annotations

from collections import Counter

# Schemas imported directly in app/services/ layer.
# Rule: app/services/ must not import app/modules/*/schemas — use domain models instead.
# Status: clean — no grandfathered violations.
LEGACY_SCHEMA_IMPORTS_IN_SERVICES: tuple[tuple[str, str, frozenset[str]], ...] = ()

LEGACY_SCHEMA_IMPORTS_IN_SERVICES_COUNTER: Counter[tuple[str, str, frozenset[str]]] = Counter(
    LEGACY_SCHEMA_IMPORTS_IN_SERVICES
)

# FastAPI / Starlette imported in app/services/ layer.
# Rule: transport layer (FastAPI) must not leak into application services.
# Status: clean — no grandfathered violations.
LEGACY_FASTAPI_IMPORTS_IN_SERVICES: tuple[tuple[str, str, frozenset[str]], ...] = ()

LEGACY_FASTAPI_IMPORTS_IN_SERVICES_COUNTER: Counter[tuple[str, str, frozenset[str]]] = Counter(
    LEGACY_FASTAPI_IMPORTS_IN_SERVICES
)

# Private cross-service imports in app/services/ (import _private_name from sibling service).
# Rule: app/services/* must not access private symbols from each other.
# Status: clean — no grandfathered violations.
LEGACY_PRIVATE_CROSS_SERVICE_IMPORTS: frozenset[tuple[str, str, str]] = frozenset()

# FastAPI / Starlette imported in app/modules/*/services*.py files.
# Rule: module services must not depend on transport-layer objects.
# Status: clean — no grandfathered violations.
MODULE_FASTAPI_IMPORTS_IN_SERVICES: tuple[tuple[str, str, frozenset[str]], ...] = ()

MODULE_FASTAPI_IMPORTS_IN_SERVICES_COUNTER: Counter[tuple[str, str, frozenset[str]]] = Counter(
    MODULE_FASTAPI_IMPORTS_IN_SERVICES
)

# Private cross-module imports in app/modules/ (import _private_name from another module).
# Rule: modules must communicate through public APIs only (no _private cross-module access).
# Status: clean — no grandfathered violations.
MODULE_PRIVATE_CROSS_MODULE_IMPORTS: frozenset[tuple[str, str, str]] = frozenset()
