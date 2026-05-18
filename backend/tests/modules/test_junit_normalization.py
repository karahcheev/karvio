from __future__ import annotations

from app.modules.report_import.normalization import normalize_case_name, normalize_suite_path


async def test_normalize_case_name_collapses_separators_and_test_keyword() -> None:
    assert normalize_case_name("testFooBar_baz-qux") == "foo bar baz qux"


async def test_normalize_suite_path_drops_empty_parts() -> None:
    assert normalize_suite_path(("  A  ", "", "B")) == ("a", "b")
