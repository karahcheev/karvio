from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Protocol

from app.core.config import Settings, get_settings
from app.core.errors import DomainError

from app.core import attachment_policy


@dataclass(slots=True)
class StoredAttachment:
    storage_backend: str
    storage_key: str
    size: int
    content_type: str
    filename: str
    checksum_sha256: str


@dataclass(slots=True)
class AttachmentDownload:
    stream: BinaryIO
    content_type: str
    filename: str


class AttachmentUpload(Protocol):
    """Transport-agnostic async upload source (e.g. Starlette UploadFile in HTTP adapters)."""

    filename: str | None
    content_type: str | None

    async def read(self, size: int = -1) -> bytes: ...

    async def close(self) -> None: ...


class AttachmentStorage(Protocol):
    async def save(
        self,
        upload: AttachmentUpload,
        *,
        entity_type: str,
        entity_id: str,
        max_size_bytes: int,
    ) -> StoredAttachment: ...

    def open(self, *, storage_key: str, filename: str, content_type: str) -> AttachmentDownload: ...

    def delete(self, *, storage_key: str) -> None: ...


class LocalAttachmentStorage:
    driver_name = "localstorage"

    def __init__(self, root: str) -> None:
        self.root = Path(root).expanduser().resolve()

    async def save(
        self,
        upload: AttachmentUpload,
        *,
        entity_type: str,
        entity_id: str,
        max_size_bytes: int,
    ) -> StoredAttachment:
        filename = Path(upload.filename or "file").name or "file"
        content_type, ext = attachment_policy.validate_attachment(
            filename=filename,
            content_type=upload.content_type,
        )
        effective_max = attachment_policy.get_max_size_for_mime(content_type, max_size_bytes)

        storage_key = str(Path(entity_type) / entity_id / f"{uuid.uuid4().hex}{ext}")
        destination = self.root / storage_key
        destination.parent.mkdir(parents=True, exist_ok=True)

        hasher = hashlib.sha256()
        written = 0
        try:
            with destination.open("wb") as target:
                while True:
                    chunk = await upload.read(1024 * 1024)
                    if not chunk:
                        break
                    written += len(chunk)
                    if written > effective_max:
                        raise DomainError(
                            status_code=413,
                            code="attachment_too_large",
                            title="Payload too large",
                            detail=f"File exceeds maximum allowed size of {effective_max} bytes",
                        )
                    hasher.update(chunk)
                    target.write(chunk)
        except Exception:
            destination.unlink(missing_ok=True)
            raise
        finally:
            await upload.close()

        return StoredAttachment(
            storage_backend=self.driver_name,
            storage_key=storage_key,
            size=written,
            content_type=content_type,
            filename=filename,
            checksum_sha256=hasher.hexdigest(),
        )

    def open(self, *, storage_key: str, filename: str, content_type: str) -> AttachmentDownload:
        path = self.root / storage_key
        if not path.is_file():
            raise DomainError(
                status_code=404,
                code="attachment_blob_not_found",
                title="Not found",
                detail="Attachment file is missing in storage",
            )
        return AttachmentDownload(
            stream=path.open("rb"),
            content_type=content_type,
            filename=filename,
        )

    def delete(self, *, storage_key: str) -> None:
        path = self.root / storage_key
        try:
            path.unlink(missing_ok=True)
        except FileNotFoundError:
            return

        current = path.parent
        while current != self.root and current.exists():
            try:
                current.rmdir()
            except OSError:
                break
            current = current.parent


def build_attachment_storage(settings: Settings | None = None) -> AttachmentStorage:
    current_settings = settings or get_settings()
    if current_settings.attachment_storage_driver == LocalAttachmentStorage.driver_name:
        return LocalAttachmentStorage(current_settings.attachment_local_root)
    raise RuntimeError(
        f"Unsupported attachment storage driver: {current_settings.attachment_storage_driver}"
    )
