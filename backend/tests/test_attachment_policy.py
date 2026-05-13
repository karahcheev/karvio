"""Tests for attachment policy (whitelist, limits)."""

import pytest

from app.core.attachment_policy import get_max_size_for_mime, validate_attachment
from app.core.errors import DomainError


async def test_validate_allowed_image_png():
    mime, ext = validate_attachment(filename="screenshot.png", content_type="image/png")
    assert mime == "image/png"
    assert ext == ".png"


async def test_validate_allowed_text_plain():
    mime, ext = validate_attachment(filename="log.txt", content_type="text/plain")
    assert mime == "text/plain"
    assert ext == ".txt"


async def test_validate_allowed_pdf():
    mime, ext = validate_attachment(filename="report.pdf", content_type="application/pdf")
    assert mime == "application/pdf"
    assert ext == ".pdf"


async def test_validate_forbidden_svg():
    with pytest.raises(DomainError) as exc_info:
        validate_attachment(filename="x.svg", content_type="image/svg+xml")
    assert exc_info.value.code == "attachment_type_forbidden"
    assert exc_info.value.status_code == 415


async def test_validate_forbidden_html():
    with pytest.raises(DomainError) as exc_info:
        validate_attachment(filename="page.html", content_type="text/html")
    assert exc_info.value.code == "attachment_type_forbidden"


async def test_validate_extension_mismatch():
    with pytest.raises(DomainError) as exc_info:
        validate_attachment(filename="fake.png", content_type="application/pdf")
    assert exc_info.value.code == "attachment_extension_mismatch"


async def test_validate_no_extension():
    with pytest.raises(DomainError) as exc_info:
        validate_attachment(filename="noext", content_type="text/plain")
    assert exc_info.value.code == "attachment_no_extension"


async def test_validate_unknown_mime():
    with pytest.raises(DomainError) as exc_info:
        validate_attachment(filename="x.exe", content_type="application/x-msdownload")
    assert exc_info.value.code == "attachment_type_not_allowed"


async def test_get_max_size_image():
    assert get_max_size_for_mime("image/png", 100 * 1024 * 1024) == 10 * 1024 * 1024


async def test_get_max_size_document():
    assert get_max_size_for_mime("application/pdf", 100 * 1024 * 1024) == 50 * 1024 * 1024


async def test_get_max_size_text():
    assert get_max_size_for_mime("text/plain", 100 * 1024 * 1024) == 1 * 1024 * 1024


async def test_get_max_size_owner_limit_is_smaller():
    assert get_max_size_for_mime("image/png", 5 * 1024 * 1024) == 5 * 1024 * 1024
