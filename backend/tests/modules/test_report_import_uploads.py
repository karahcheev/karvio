from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pytest
from fastapi import UploadFile

from app.core.errors import DomainError
from app.modules.report_import.services import uploads as upload_service


class _FailingUpload:
    def __init__(self) -> None:
        self._reads = 0
        self.closed = False

    async def read(self, _chunk_size: int) -> bytes:
        self._reads += 1
        if self._reads == 1:
            return b"abc"
        raise RuntimeError("boom")

    async def close(self) -> None:
        self.closed = True


async def test_read_report_upload_to_temp_streams_non_empty_upload(tmp_path, monkeypatch):
    original_mkstemp = upload_service.tempfile.mkstemp

    def _mkstemp(*args, **kwargs):
        return original_mkstemp(dir=tmp_path, prefix="report-upload-", suffix=".bin")

    monkeypatch.setattr(upload_service.tempfile, "mkstemp", _mkstemp)
    upload = UploadFile(file=BytesIO(b"<testsuite/>"), filename="report.xml")

    out_path = await upload_service.read_report_upload_to_temp(upload)

    try:
        assert out_path.exists()
        assert out_path.read_bytes() == b"<testsuite/>"
    finally:
        out_path.unlink(missing_ok=True)


async def test_read_report_upload_to_temp_rejects_empty_upload(tmp_path, monkeypatch):
    original_mkstemp = upload_service.tempfile.mkstemp

    def _mkstemp(*args, **kwargs):
        return original_mkstemp(dir=tmp_path, prefix="report-upload-", suffix=".bin")

    monkeypatch.setattr(upload_service.tempfile, "mkstemp", _mkstemp)
    upload = UploadFile(file=BytesIO(b""), filename="empty.xml")

    with pytest.raises(DomainError) as exc:
        await upload_service.read_report_upload_to_temp(upload)

    assert exc.value.status_code == 422
    assert exc.value.code == "empty_upload"
    assert list(tmp_path.iterdir()) == []


async def test_read_report_upload_to_temp_removes_temp_file_on_exception(tmp_path, monkeypatch):
    original_mkstemp = upload_service.tempfile.mkstemp
    created_path: Path | None = None

    def _mkstemp(*args, **kwargs):
        nonlocal created_path
        fd, raw = original_mkstemp(dir=tmp_path, prefix="report-upload-", suffix=".bin")
        created_path = Path(raw)
        return fd, raw

    monkeypatch.setattr(upload_service.tempfile, "mkstemp", _mkstemp)
    upload = _FailingUpload()

    with pytest.raises(RuntimeError, match="boom"):
        await upload_service.read_report_upload_to_temp(upload)  # type: ignore[arg-type]

    assert created_path is not None
    assert not created_path.exists()
    assert upload.closed
