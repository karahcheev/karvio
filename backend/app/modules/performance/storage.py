from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

from app.core.errors import DomainError

_DEFAULT_UPLOAD_FILENAME = "artifact.bin"
_JSON_EXT = ".json"
_HTML_EXT = ".html"


def _extension_from_upload_filename(filename: str | None) -> str:
    name = Path(filename or _DEFAULT_UPLOAD_FILENAME).name or _DEFAULT_UPLOAD_FILENAME
    if "." not in name:
        return ""
    return "." + name.rsplit(".", 1)[-1].lower()


ALLOWED_MIME_EXTENSIONS: dict[str, frozenset[str]] = {
    "application/zip": frozenset({".zip"}),
    "application/x-zip-compressed": frozenset({".zip"}),
    "application/json": frozenset({_JSON_EXT}),
    "text/csv": frozenset({".csv"}),
    "text/plain": frozenset({".txt", ".log"}),
    "text/html": frozenset({_HTML_EXT, ".htm"}),
    "application/octet-stream": frozenset({".zip", _JSON_EXT, ".csv", ".txt", _HTML_EXT, ".log"}),
}

MAX_SIZE_BY_EXTENSION: dict[str, int] = {
    ".zip": 250 * 1024 * 1024,
    _JSON_EXT: 50 * 1024 * 1024,
    ".csv": 100 * 1024 * 1024,
    _HTML_EXT: 20 * 1024 * 1024,
    ".htm": 20 * 1024 * 1024,
    ".txt": 20 * 1024 * 1024,
    ".log": 20 * 1024 * 1024,
}

# Preflight only needs enough bytes to detect format and surface parse metadata; keep well below full import caps.
PREFLIGHT_MAX_SIZE_BY_EXTENSION: dict[str, int] = {
    ".zip": 32 * 1024 * 1024,
    _JSON_EXT: 8 * 1024 * 1024,
    ".csv": 16 * 1024 * 1024,
    _HTML_EXT: 4 * 1024 * 1024,
    ".htm": 4 * 1024 * 1024,
    ".txt": 4 * 1024 * 1024,
    ".log": 4 * 1024 * 1024,
}


def max_full_performance_upload_bytes(filename: str | None) -> int:
    ext = _extension_from_upload_filename(filename)
    return MAX_SIZE_BY_EXTENSION.get(ext, 20 * 1024 * 1024)


def max_preflight_performance_upload_bytes(filename: str | None) -> int:
    ext = _extension_from_upload_filename(filename)
    return PREFLIGHT_MAX_SIZE_BY_EXTENSION.get(ext, 8 * 1024 * 1024)


@dataclass(slots=True)
class StoredPerformanceArtifact:
    storage_backend: str
    storage_key: str
    size: int
    content_type: str
    filename: str
    checksum_sha256: str


@dataclass(slots=True)
class PerformanceArtifactDownload:
    stream: BinaryIO
    content_type: str
    filename: str


class PerformanceArtifactStorage:
    driver_name = "local_performance"

    def __init__(self, root: str) -> None:
        self.root = Path(root).expanduser().resolve()

    def save_bytes(
        self,
        content: bytes,
        *,
        filename: str,
        content_type: str | None,
        entity_type: str,
        entity_id: str,
    ) -> StoredPerformanceArtifact:
        safe_name = Path(filename or _DEFAULT_UPLOAD_FILENAME).name or _DEFAULT_UPLOAD_FILENAME
        extension = self._extract_extension(safe_name)
        mime = self._normalize_mime(content_type)
        self._validate_type(mime, extension)

        max_size = MAX_SIZE_BY_EXTENSION.get(extension, 20 * 1024 * 1024)
        if len(content) > max_size:
            raise DomainError(
                status_code=413,
                code="performance_artifact_too_large",
                title="Payload too large",
                detail=f"File exceeds maximum allowed size of {max_size} bytes",
            )

        storage_key = str(Path(entity_type) / entity_id / f"{uuid.uuid4().hex}{extension}")
        destination = self.root / storage_key
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)

        return StoredPerformanceArtifact(
            storage_backend=self.driver_name,
            storage_key=storage_key,
            size=len(content),
            content_type=mime,
            filename=safe_name,
            checksum_sha256=hashlib.sha256(content).hexdigest(),
        )

    def save_path(
        self,
        source_path: Path,
        *,
        filename: str,
        content_type: str | None,
        entity_type: str,
        entity_id: str,
    ) -> StoredPerformanceArtifact:
        safe_name = Path(filename or _DEFAULT_UPLOAD_FILENAME).name or _DEFAULT_UPLOAD_FILENAME
        extension = self._extract_extension(safe_name)
        mime = self._normalize_mime(content_type)
        self._validate_type(mime, extension)

        max_size = MAX_SIZE_BY_EXTENSION.get(extension, 20 * 1024 * 1024)
        try:
            size = source_path.stat().st_size
        except OSError as exc:
            raise DomainError(
                status_code=400,
                code="performance_artifact_read_failed",
                title="Bad request",
                detail="Could not read uploaded performance file",
            ) from exc
        if size == 0:
            raise DomainError(
                status_code=422,
                code="empty_upload",
                title="Validation error",
                detail="Uploaded performance file is empty",
                errors={"file": ["empty file"]},
            )
        if size > max_size:
            raise DomainError(
                status_code=413,
                code="performance_artifact_too_large",
                title="Payload too large",
                detail=f"File exceeds maximum allowed size of {max_size} bytes",
            )

        storage_key = str(Path(entity_type) / entity_id / f"{uuid.uuid4().hex}{extension}")
        destination = self.root / storage_key
        destination.parent.mkdir(parents=True, exist_ok=True)

        hasher = hashlib.sha256()
        try:
            with source_path.open("rb") as src, destination.open("wb") as dst:
                while True:
                    chunk = src.read(1024 * 1024)
                    if not chunk:
                        break
                    hasher.update(chunk)
                    dst.write(chunk)
        except OSError as exc:
            destination.unlink(missing_ok=True)
            raise DomainError(
                status_code=400,
                code="performance_artifact_read_failed",
                title="Bad request",
                detail="Could not read uploaded performance file",
            ) from exc

        return StoredPerformanceArtifact(
            storage_backend=self.driver_name,
            storage_key=storage_key,
            size=size,
            content_type=mime,
            filename=safe_name,
            checksum_sha256=hasher.hexdigest(),
        )

    def open(self, *, storage_key: str, filename: str, content_type: str) -> PerformanceArtifactDownload:
        path = self.root / storage_key
        if not path.is_file():
            raise DomainError(
                status_code=404,
                code="performance_artifact_not_found",
                title="Not found",
                detail="Performance artifact file is missing in storage",
            )
        return PerformanceArtifactDownload(
            stream=path.open("rb"),
            content_type=content_type,
            filename=filename,
        )

    def delete(self, *, storage_key: str) -> None:
        path = self.root / storage_key
        path.unlink(missing_ok=True)

    @staticmethod
    def _normalize_mime(content_type: str | None) -> str:
        mime = (content_type or "application/octet-stream").strip().lower()
        if ";" in mime:
            mime = mime.split(";", 1)[0].strip()
        return mime

    @staticmethod
    def _extract_extension(filename: str) -> str:
        if "." not in filename:
            raise DomainError(
                status_code=415,
                code="performance_artifact_no_extension",
                title="Missing extension",
                detail="Filename must have one of allowed extensions: zip/json/csv/html/txt/log",
            )
        return "." + filename.rsplit(".", 1)[-1].lower()

    @staticmethod
    def _validate_type(mime: str, extension: str) -> None:
        allowed = ALLOWED_MIME_EXTENSIONS.get(mime)
        if not allowed:
            raise DomainError(
                status_code=415,
                code="performance_artifact_type_not_allowed",
                title="Unsupported media type",
                detail=f"File type {mime!r} is not allowed",
            )
        if extension not in allowed:
            raise DomainError(
                status_code=415,
                code="performance_artifact_extension_mismatch",
                title="Extension mismatch",
                detail=f"Extension {extension!r} does not match content type {mime!r}",
            )
