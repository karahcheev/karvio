from __future__ import annotations

import os
import tempfile
from pathlib import Path

import aiofiles
from fastapi import UploadFile

from app.core.errors import DomainError


async def read_report_upload_to_temp(
    file: UploadFile,
    *,
    chunk_size: int = 1024 * 1024,
) -> Path:
    """Stream request body to a temp file. Caller must unlink the path after successful use."""
    fd, raw = tempfile.mkstemp(prefix="report-upload-", suffix=".bin")
    os.close(fd)
    path = Path(raw)
    try:
        written = 0
        async with aiofiles.open(path, "wb") as out:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                written += len(chunk)
                await out.write(chunk)
    except Exception:
        path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    if written == 0:
        path.unlink(missing_ok=True)
        raise DomainError(
            status_code=422,
            code="empty_upload",
            title="Validation error",
            detail="Uploaded report file is empty",
            errors={"file": ["empty file"]},
        )
    return path
