from app.core.errors import forbid_field, not_found


def test_not_found_builder() -> None:
    err = not_found("project")

    assert err.status_code == 404
    assert err.code == "project_not_found"
    assert err.detail == "project not found"


def test_forbid_field_builder() -> None:
    err = forbid_field("name")

    assert err.status_code == 422
    assert err.code == "immutable_field"
    assert "name" in err.detail
