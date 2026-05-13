from __future__ import annotations

import json
import logging
import sys
from datetime import datetime
from uuid import UUID

from app.core import logging_config


def test_json_log_formatter_serializes_complex_extra_fields() -> None:
    formatter = logging_config.JsonLogFormatter()
    record = logging.LogRecord("tms.test", logging.INFO, __file__, 10, "done", (), None)
    record.request_id = "req-1"
    record.happened_at = datetime(2026, 4, 3, 10, 0)
    record.tags = {"a", "b"}
    record.payload = {"nested": {"ok": True}, "items": [1, 2]}
    record.trace_obj = UUID("12345678-1234-5678-1234-567812345678")

    payload = json.loads(formatter.format(record))

    assert payload["message"] == "done"
    assert payload["request_id"] == "req-1"
    assert payload["happened_at"] == "2026-04-03T10:00:00+00:00"
    assert sorted(payload["tags"]) == ["a", "b"]
    assert payload["payload"] == {"nested": {"ok": True}, "items": [1, 2]}
    assert payload["trace_obj"] == "12345678-1234-5678-1234-567812345678"


def test_json_log_formatter_includes_extra_and_exception() -> None:
    formatter = logging_config.JsonLogFormatter()
    try:
        raise RuntimeError("boom")
    except RuntimeError:
        record = logging.LogRecord("tms.test", logging.ERROR, __file__, 10, "failed %s", ("x",), exc_info=sys.exc_info())
    record.request_id = "req-1"
    payload = json.loads(formatter.format(record))
    assert payload["message"] == "failed x"
    assert payload["request_id"] == "req-1"
    assert "exception" in payload


def test_plain_log_formatter_renders_sorted_extras() -> None:
    formatter = logging_config.PlainLogFormatter()
    record = logging.LogRecord("tms.test", logging.INFO, __file__, 12, "hello", (), None)
    record.b = 2
    record.a = "x"
    rendered = formatter.format(record)
    assert rendered.startswith("INFO tms.test hello")
    assert "a=x" in rendered
    assert "b=2" in rendered


def test_plain_log_formatter_without_extras_returns_base() -> None:
    formatter = logging_config.PlainLogFormatter()
    record = logging.LogRecord("tms.test", logging.INFO, __file__, 12, "hello", (), None)
    if hasattr(record, "taskName"):
        delattr(record, "taskName")
    assert formatter.format(record) == "INFO tms.test hello"


def test_exclude_status_access_filter() -> None:
    filt = logging_config.ExcludeStatusAccessFilter()
    access_status = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, '"GET /status HTTP/1.1" 200', (), None)
    access_other = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, '"GET /api HTTP/1.1" 200', (), None)
    other_logger = logging.LogRecord("tms.api", logging.INFO, __file__, 1, "anything", (), None)
    assert filt.filter(access_status) is False
    assert filt.filter(access_other) is True
    assert filt.filter(other_logger) is True


def test_configure_logging_sets_handler_and_is_idempotent() -> None:
    root = logging.getLogger()
    old_handlers = list(root.handlers)
    old_level = root.level
    old_flag = getattr(root, "_tms_observability_configured", None)
    try:
        if hasattr(root, "_tms_observability_configured"):
            delattr(root, "_tms_observability_configured")
        logging_config.configure_logging(level="WARNING", json_logs=False)
        assert root.level == logging.WARNING
        assert len(root.handlers) == 1
        assert isinstance(root.handlers[0].formatter, logging_config.PlainLogFormatter)
        logging_config.configure_logging(level="NO_SUCH_LEVEL", json_logs=True)
        assert root.level == logging.INFO
        assert isinstance(root.handlers[0].formatter, logging_config.PlainLogFormatter)
        logging_config.configure_logging(level="ERROR", json_logs=True)
        assert root.level == logging.ERROR
        assert isinstance(root.handlers[0].formatter, logging_config.PlainLogFormatter)
    finally:
        root.handlers = old_handlers
        root.setLevel(old_level)
        if old_flag is None:
            if hasattr(root, "_tms_observability_configured"):
                delattr(root, "_tms_observability_configured")
        else:
            root._tms_observability_configured = old_flag  # type: ignore[attr-defined]
