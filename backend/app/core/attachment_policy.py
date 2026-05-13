"""Attachment upload policy: whitelist MIME/extensions, type-specific limits."""

from __future__ import annotations

# Whitelist: MIME -> allowed extensions. Excludes HTML/SVG/XHTML (XSS vectors).
ALLOWED_MIME_EXTENSIONS: dict[str, frozenset[str]] = {
    # Images (safe for preview)
    "image/png": frozenset({".png"}),
    "image/jpeg": frozenset({".jpg", ".jpeg"}),
    "image/gif": frozenset({".gif"}),
    "image/webp": frozenset({".webp"}),
    "image/bmp": frozenset({".bmp"}),
    "image/tiff": frozenset({".tiff", ".tif"}),
    # Documents
    "application/pdf": frozenset({".pdf"}),
    "text/plain": frozenset({".txt", ".log", ".md", ".csv"}),
    # Office (optional, for evidence)
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": frozenset({".xlsx"}),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": frozenset({".docx"}),
}

# Explicitly forbidden (inline render / XSS risks)
FORBIDDEN_MIME_TYPES: frozenset[str] = frozenset({
    "text/html",
    "application/xhtml+xml",
    "image/svg+xml",
    "text/xml",
    "application/xml",
})

# Max size per MIME category (bytes). Overrides owner-level max when smaller.
MAX_SIZE_BY_CATEGORY: dict[str, int] = {
    "image": 10 * 1024 * 1024,   # 10 MB for images
    "document": 50 * 1024 * 1024,  # 50 MB for PDF/Office
    "text": 1 * 1024 * 1024,     # 1 MB for text
}


def _mime_category(mime: str) -> str:
    if mime.startswith("image/"):
        return "image"
    if mime in (
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ):
        return "document"
    if mime.startswith("text/"):
        return "text"
    return "other"


def get_max_size_for_mime(mime: str, owner_max: int) -> int:
    """Effective max size: min of owner limit and type-specific limit."""
    cat = _mime_category(mime)
    type_max = MAX_SIZE_BY_CATEGORY.get(cat)
    if type_max is None:
        return owner_max
    return min(owner_max, type_max)


def validate_attachment(
    *,
    filename: str,
    content_type: str | None,
    extension_override: str | None = None,
) -> tuple[str, str]:
    """
    Validate filename and content_type against whitelist.
    Returns (normalized_content_type, extension).
    Raises DomainError on rejection.
    """
    from app.core.errors import DomainError

    mime = (content_type or "application/octet-stream").strip().lower()
    if ";" in mime:
        mime = mime.split(";", 1)[0].strip()

    if mime in FORBIDDEN_MIME_TYPES:
        raise DomainError(
            status_code=415,
            code="attachment_type_forbidden",
            title="Unsupported media type",
            detail=f"File type {mime!r} is not allowed for security reasons",
        )

    allowed_extensions = ALLOWED_MIME_EXTENSIONS.get(mime)
    if not allowed_extensions:
        raise DomainError(
            status_code=415,
            code="attachment_type_not_allowed",
            title="Unsupported media type",
            detail=f"File type {mime!r} is not in the allowed whitelist",
        )

    ext = (extension_override or "").lower().strip()
    if not ext:
        if "." not in filename:
            raise DomainError(
                status_code=415,
                code="attachment_no_extension",
                title="Missing extension",
                detail="Filename must have an extension that matches the content type",
            )
        ext = "." + filename.rsplit(".", 1)[-1].lower()
    elif not ext.startswith("."):
        ext = "." + ext

    if ext not in allowed_extensions:
        raise DomainError(
            status_code=415,
            code="attachment_extension_mismatch",
            title="Extension mismatch",
            detail=f"Extension {ext!r} does not match content type {mime!r}",
        )

    return mime, ext
