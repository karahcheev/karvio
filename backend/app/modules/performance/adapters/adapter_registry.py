from __future__ import annotations

from io import BytesIO
from pathlib import Path
from zipfile import BadZipFile, ZipFile, ZipInfo

from app.core.domain_strings import TITLE_VALIDATION_ERROR
from app.core.errors import DomainError
from app.modules.performance.adapters.k6_json import parse_k6_json
from app.modules.performance.adapters.locust_csv import parse_locust_csv
from app.modules.performance.adapters.pytest_benchmark_json import parse_pytest_benchmark_json
from app.modules.performance.adapters.types import ParsedPerformancePayload
from app.modules.performance.schemas.runs import PerformanceUpload
from app.modules.performance.storage import max_full_performance_upload_bytes

# Zip hardening: many tiny entries, huge uncompressed payloads, extreme compression ratios.
ZIP_MAX_NON_DIR_MEMBERS = 400
ZIP_MAX_UNCOMPRESSED_MEMBER_BYTES = 55 * 1024 * 1024
ZIP_MAX_COMPRESSION_RATIO = 100

_DETAIL_UPLOADED_PERFORMANCE_EMPTY = "Uploaded performance file is empty"
_ERR_FILE_EMPTY_LABEL = "empty file"
_EXT_JSON = ".json"

_ZIP_FATAL_CODES = frozenset(
    {
        "performance_zip_suspicious_compression",
        "performance_zip_too_many_members",
        "performance_invalid_zip",
        "performance_zip_decompressed_oversize",
    }
)


def _extension(filename: str | None) -> str:
    if not filename:
        return ""
    name = Path(filename).name
    if "." not in name:
        return ""
    return "." + name.rsplit(".", 1)[-1].lower()


def _zip_entry_name_safe(name: str) -> bool:
    normalized = name.replace("\\", "/").strip()
    if not normalized or normalized.endswith("/"):
        return False
    if normalized.startswith("/"):
        return False
    parts = [p for p in normalized.split("/") if p not in ("", ".")]
    return ".." not in parts


def _validate_zip_member_before_read(info: ZipInfo) -> None:
    if info.is_dir():
        return
    if info.file_size < 0:
        raise DomainError(
            status_code=422,
            code="performance_invalid_zip",
            title=TITLE_VALIDATION_ERROR,
            detail="Zip archive contains an invalid entry size",
            errors={"file": ["invalid zip entry"]},
        )
    if info.file_size > ZIP_MAX_UNCOMPRESSED_MEMBER_BYTES:
        raise DomainError(
            status_code=422,
            code="performance_zip_entry_declared_too_large",
            title=TITLE_VALIDATION_ERROR,
            detail=(
                f"Zip entry {info.filename!r} exceeds maximum uncompressed size "
                f"of {ZIP_MAX_UNCOMPRESSED_MEMBER_BYTES} bytes"
            ),
            errors={"file": ["zip entry too large"]},
        )
    cs = info.compress_size
    if cs > 0 and info.file_size > 0 and info.file_size // cs > ZIP_MAX_COMPRESSION_RATIO:
        raise DomainError(
            status_code=422,
            code="performance_zip_suspicious_compression",
            title=TITLE_VALIDATION_ERROR,
            detail="Zip archive has a suspicious compression ratio and was rejected",
            errors={"file": ["suspicious zip compression"]},
        )


def _read_zip_member_capped(archive: ZipFile, member: str, *, cap: int) -> bytes:
    info = archive.getinfo(member)
    _validate_zip_member_before_read(info)
    chunks: list[bytes] = []
    total = 0
    with archive.open(member, "r") as zf:
        while True:
            room = cap - total
            if room <= 0:
                raise DomainError(
                    status_code=422,
                    code="performance_zip_decompressed_oversize",
                    title=TITLE_VALIDATION_ERROR,
                    detail=f"Zip entry {member!r} exceeded safe decompressed size limit ({cap} bytes)",
                    errors={"file": ["zip decompressed payload too large"]},
                )
            part = zf.read(min(1024 * 1024, room))
            if not part:
                break
            total += len(part)
            if total > cap:
                raise DomainError(
                    status_code=422,
                    code="performance_zip_decompressed_oversize",
                    title=TITLE_VALIDATION_ERROR,
                    detail=f"Zip entry {member!r} exceeded safe decompressed size limit ({cap} bytes)",
                    errors={"file": ["zip decompressed payload too large"]},
                )
            chunks.append(part)
    return b"".join(chunks)


def _zip_names_in_order(archive: ZipFile) -> list[str]:
    non_dir = [zi for zi in archive.infolist() if not zi.is_dir()]
    if len(non_dir) > ZIP_MAX_NON_DIR_MEMBERS:
        raise DomainError(
            status_code=422,
            code="performance_zip_too_many_members",
            title=TITLE_VALIDATION_ERROR,
            detail=f"Zip archive contains too many files (limit {ZIP_MAX_NON_DIR_MEMBERS})",
            errors={"file": ["zip has too many members"]},
        )
    return [zi.filename for zi in non_dir if _zip_entry_name_safe(zi.filename)]


def _parse_json_chain(content: bytes, filename: str) -> ParsedPerformancePayload:
    errors: list[DomainError] = []
    for parser in (parse_pytest_benchmark_json, parse_k6_json):
        try:
            return parser(content, filename)
        except DomainError as exc:
            errors.append(exc)
    raise errors[-1]


def _is_benchmark_json_member(name: str) -> bool:
    lowered = name.lower()
    return lowered.endswith(_EXT_JSON) and (
        "benchmark" in lowered
        or "pytest-benchmark" in lowered
        or ".benchmarks/" in lowered
        or "/.benchmarks/" in lowered
    )


def _try_parse_zip_members_json_chain(
    archive: ZipFile,
    names: list[str],
    *,
    skip: set[str] | None = None,
) -> ParsedPerformancePayload | None:
    skip = skip or set()
    for selected in names:
        if selected in skip:
            continue
        try:
            raw = _read_zip_member_capped(archive, selected, cap=ZIP_MAX_UNCOMPRESSED_MEMBER_BYTES)
            return _parse_json_chain(raw, selected)
        except DomainError as exc:
            if exc.code in _ZIP_FATAL_CODES:
                raise
    return None


def _try_parse_zip_members_locust_csv(
    archive: ZipFile,
    names: list[str],
    *,
    skip: set[str] | None = None,
) -> ParsedPerformancePayload | None:
    skip = skip or set()
    for selected in names:
        if selected in skip:
            continue
        try:
            raw = _read_zip_member_capped(archive, selected, cap=ZIP_MAX_UNCOMPRESSED_MEMBER_BYTES)
            return parse_locust_csv(raw, selected)
        except DomainError as exc:
            if exc.code in _ZIP_FATAL_CODES:
                raise
    return None


def _open_zip_from_upload(upload: PerformanceUpload) -> ZipFile:
    if upload.path is not None:
        try:
            return ZipFile(upload.path)
        except BadZipFile as exc:
            raise DomainError(
                status_code=422,
                code="performance_invalid_zip",
                title=TITLE_VALIDATION_ERROR,
                detail=f"Invalid zip archive: {exc}",
                errors={"file": ["invalid zip archive"]},
            ) from exc
    if upload.content is None:
        raise DomainError(
            status_code=422,
            code="empty_upload",
            title=TITLE_VALIDATION_ERROR,
            detail=_DETAIL_UPLOADED_PERFORMANCE_EMPTY,
            errors={"file": [_ERR_FILE_EMPTY_LABEL]},
        )
    try:
        return ZipFile(BytesIO(upload.content))
    except BadZipFile as exc:
        raise DomainError(
            status_code=422,
            code="performance_invalid_zip",
            title=TITLE_VALIDATION_ERROR,
            detail=f"Invalid zip archive: {exc}",
            errors={"file": ["invalid zip archive"]},
        ) from exc


def _parse_zip(upload: PerformanceUpload, _filename: str) -> ParsedPerformancePayload:
    with _open_zip_from_upload(upload) as archive:
        names = _zip_names_in_order(archive)

        benchmark_json_candidates = [name for name in names if _is_benchmark_json_member(name)]
        parsed = _try_parse_zip_members_json_chain(archive, benchmark_json_candidates)
        if parsed is not None:
            return parsed

        json_candidates = [name for name in names if name.lower().endswith(_EXT_JSON)]
        parsed = _try_parse_zip_members_json_chain(
            archive,
            json_candidates,
            skip=set(benchmark_json_candidates),
        )
        if parsed is not None:
            return parsed

        locust_named_csv_candidates = [
            name
            for name in names
            if name.lower().endswith(".csv") and ("request_stats" in name.lower() or "locust" in name.lower())
        ]
        parsed = _try_parse_zip_members_locust_csv(archive, locust_named_csv_candidates)
        if parsed is not None:
            return parsed

        csv_candidates = [name for name in names if name.lower().endswith(".csv")]
        parsed = _try_parse_zip_members_locust_csv(
            archive,
            csv_candidates,
            skip=set(locust_named_csv_candidates),
        )
        if parsed is not None:
            return parsed

    raise DomainError(
        status_code=422,
        code="performance_unsupported_archive",
        title=TITLE_VALIDATION_ERROR,
        detail="Archive does not contain supported performance result files",
        errors={"file": ["supported files are pytest-benchmark json, k6 json, or locust csv"]},
    )


def _validate_outer_payload(upload: PerformanceUpload, *, max_bytes: int) -> None:
    if upload.content is not None:
        if len(upload.content) == 0:
            raise DomainError(
                status_code=422,
                code="empty_upload",
                title=TITLE_VALIDATION_ERROR,
                detail=_DETAIL_UPLOADED_PERFORMANCE_EMPTY,
                errors={"file": [_ERR_FILE_EMPTY_LABEL]},
            )
        if len(upload.content) > max_bytes:
            raise DomainError(
                status_code=413,
                code="performance_artifact_too_large",
                title="Payload too large",
                detail=f"File exceeds maximum allowed size of {max_bytes} bytes",
            )
        return
    assert upload.path is not None
    try:
        size = upload.path.stat().st_size
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
            title=TITLE_VALIDATION_ERROR,
            detail=_DETAIL_UPLOADED_PERFORMANCE_EMPTY,
            errors={"file": [_ERR_FILE_EMPTY_LABEL]},
        )
    if size > max_bytes:
        raise DomainError(
            status_code=413,
            code="performance_artifact_too_large",
            title="Payload too large",
            detail=f"File exceeds maximum allowed size of {max_bytes} bytes",
        )


def _read_validated_upload_bytes(upload: PerformanceUpload) -> bytes:
    if upload.content is not None:
        return upload.content
    if upload.path is None:
        raise DomainError(
            status_code=422,
            code="empty_upload",
            title=TITLE_VALIDATION_ERROR,
            detail=_DETAIL_UPLOADED_PERFORMANCE_EMPTY,
            errors={"file": [_ERR_FILE_EMPTY_LABEL]},
        )
    try:
        return upload.path.read_bytes()
    except OSError as exc:
        raise DomainError(
            status_code=400,
            code="performance_artifact_read_failed",
            title="Bad request",
            detail="Could not read uploaded performance file",
        ) from exc


def parse_upload(upload: PerformanceUpload) -> ParsedPerformancePayload:
    if upload.content is not None and upload.path is not None:
        raise DomainError(
            status_code=500,
            code="performance_upload_invalid",
            title="Internal error",
            detail="Upload payload must be either in-memory or on disk, not both",
        )
    if upload.content is None and upload.path is None:
        raise DomainError(
            status_code=422,
            code="empty_upload",
            title=TITLE_VALIDATION_ERROR,
            detail=_DETAIL_UPLOADED_PERFORMANCE_EMPTY,
            errors={"file": [_ERR_FILE_EMPTY_LABEL]},
        )

    filename = upload.filename or "artifact.bin"
    ext = _extension(filename)
    outer_limit = max_full_performance_upload_bytes(upload.filename)
    _validate_outer_payload(upload, max_bytes=outer_limit)

    if ext == ".zip":
        return _parse_zip(upload, filename)

    if ext == _EXT_JSON:
        return _parse_json_chain(_read_validated_upload_bytes(upload), filename)

    if ext == ".csv":
        return parse_locust_csv(_read_validated_upload_bytes(upload), filename)

    content_type = (upload.content_type or "").lower()
    if "json" in content_type:
        return _parse_json_chain(_read_validated_upload_bytes(upload), filename)
    if "csv" in content_type:
        return parse_locust_csv(_read_validated_upload_bytes(upload), filename)

    raise DomainError(
        status_code=422,
        code="performance_unsupported_input",
        title=TITLE_VALIDATION_ERROR,
        detail="Unsupported input format. Use zip/json/csv",
        errors={"file": ["supported formats: .zip, .json, .csv"]},
    )
