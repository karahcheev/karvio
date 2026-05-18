"""PDF export for reports."""

from __future__ import annotations

import textwrap

from app.models.enums import RunItemStatus

from app.modules.reports.services.summary import RUN_STATUS_ORDER

PDF_STATUS_COLORS: dict[str, tuple[float, float, float]] = {
    RunItemStatus.passed.value: (0.133, 0.773, 0.369),
    RunItemStatus.error.value: (0.937, 0.267, 0.267),
    RunItemStatus.failure.value: (0.761, 0.141, 0.141),
    RunItemStatus.blocked.value: (0.918, 0.722, 0.043),
    RunItemStatus.in_progress.value: (0.231, 0.510, 0.965),
    RunItemStatus.skipped.value: (0.392, 0.455, 0.545),
    RunItemStatus.xfailed.value: (0.580, 0.451, 0.933),
    RunItemStatus.xpassed.value: (0.910, 0.302, 0.302),
    RunItemStatus.untested.value: (0.620, 0.639, 0.686),
}
PDF_STATUS_LABELS: dict[str, str] = {
    RunItemStatus.untested.value: "Untested",
    RunItemStatus.in_progress.value: "In Progress",
    RunItemStatus.passed.value: "Passed",
    RunItemStatus.error.value: "Error",
    RunItemStatus.failure.value: "Failure",
    RunItemStatus.blocked.value: "Blocked",
    RunItemStatus.skipped.value: "Skipped",
    RunItemStatus.xfailed.value: "XFailed",
    RunItemStatus.xpassed.value: "XPassed",
}


def _wrap_pdf_line(line: str, *, width: int = 96) -> list[str]:
    if not line:
        return [""]
    leading_spaces = len(line) - len(line.lstrip(" "))
    indent = " " * leading_spaces
    wrapped = textwrap.wrap(
        line.lstrip(" "),
        width=max(width - leading_spaces, 20),
        initial_indent=indent,
        subsequent_indent=indent,
        break_long_words=True,
        break_on_hyphens=False,
    )
    return wrapped or [line]


def _escape_pdf_text(line: str) -> str:
    cleaned = line.replace("\r", " ").replace("\n", " ").replace("\t", "    ")
    normalized = cleaned.encode("latin-1", "replace").decode("latin-1")
    return normalized.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_pdf_detail_lines(payload: dict) -> list[str]:
    run = payload["test_run"]
    summary = payload["summary"]
    by_status = payload["by_status"]
    items = payload["items"]
    failures = payload["failures"]

    environment_name = run.get("environment_name") or "-"
    environment_revision_number = run.get("environment_revision_number")
    environment_label = (
        f"{environment_name} · r{environment_revision_number}"
        if environment_revision_number is not None
        else environment_name
    )

    lines = [
        "Run Details Appendix",
        f"Generated at: {payload['generated_at']}",
        "",
        f"Run ID: {run['id']}",
        f"Run name: {run['name']}",
        f"Project ID: {run['project_id']}",
        f"Status: {run['status']}",
        f"Environment: {environment_label}",
        f"Build: {run['build'] or '-'}",
        f"Created by: {run['created_by_name'] or run['created_by'] or 'System'}",
        f"Created at: {run['created_at']}",
        "",
        "Summary",
        (
            f"Total: {summary['total']} | Passed: {summary['passed']} | Error: {summary['error']} | "
            f"Failure: {summary['failure']} | Blocked: {summary['blocked']} | Skipped: {summary['skipped']} | "
            f"Untested: {summary['untested']} | In progress: {summary['in_progress']}"
        ),
        f"Pass rate: {summary['pass_rate']}% | Progress: {summary['progress_rate']}%",
        "",
        "By status",
    ]
    lines.extend(f"  {entry['status']}: {entry['count']}" for entry in by_status)
    lines.extend(
        [
            "",
            f"Failed items: {len(failures)}",
            "",
            f"Run items ({len(items)})",
        ]
    )

    if not items:
        lines.append("  No run items")
        return lines

    for index, item in enumerate(items, start=1):
        test_case = item["test_case"]
        lines.extend(
            [
                f"{index}. {test_case['key']} | {test_case['title']}",
                (
                    f"   Status: {item['status']} | Assignee: {item['assignee_name']} | "
                    f"Executed by: {item['executed_by_name'] or '-'} | Executions: {item['execution_count']}"
                ),
                (
                    f"   Last executed: {item['last_executed_at'] or '-'} | "
                    f"Defects: {', '.join(item['defect_ids']) if item['defect_ids'] else '-'}"
                ),
            ]
        )
        if item["comment"]:
            lines.append(f"   Comment: {item['comment']}")
        lines.append("")

    return lines


def _pdf_rgb(color: tuple[float, float, float]) -> str:
    return f"{color[0]:.3f} {color[1]:.3f} {color[2]:.3f}"


def _pdf_text(
    x: float,
    y: float,
    text: str,
    *,
    size: float = 10,
    bold: bool = False,
    color: tuple[float, float, float] = (0.09, 0.13, 0.19),
) -> str:
    font = "F2" if bold else "F1"
    return (
        f"BT /{font} {size:.2f} Tf {_pdf_rgb(color)} rg "
        f"1 0 0 1 {x:.2f} {y:.2f} Tm ({_escape_pdf_text(text)}) Tj ET"
    )


def _pdf_rect(
    x: float,
    y: float,
    width: float,
    height: float,
    *,
    fill: tuple[float, float, float] | None = None,
    stroke: tuple[float, float, float] | None = None,
    line_width: float = 1.0,
) -> list[str]:
    commands: list[str] = []
    if fill:
        commands.append(f"{_pdf_rgb(fill)} rg")
    if stroke:
        commands.append(f"{_pdf_rgb(stroke)} RG {line_width:.2f} w")
    if fill and stroke:
        draw_mode = "B"
    elif fill:
        draw_mode = "f"
    else:
        draw_mode = "S"
    commands.append(f"{x:.2f} {y:.2f} {width:.2f} {height:.2f} re {draw_mode}")
    return commands


def _pdf_line(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    *,
    color: tuple[float, float, float] = (0.82, 0.84, 0.88),
    line_width: float = 1.0,
) -> str:
    return f"{_pdf_rgb(color)} RG {line_width:.2f} w {x1:.2f} {y1:.2f} m {x2:.2f} {y2:.2f} l S"


def _pdf_dashboard_header_commands(payload: dict, run: dict) -> list[str]:
    commands: list[str] = []
    environment_name = run.get("environment_name") or "-"
    environment_revision_number = run.get("environment_revision_number")
    environment_label = (
        f"{environment_name} · r{environment_revision_number}"
        if environment_revision_number is not None
        else environment_name
    )
    commands.extend(_pdf_rect(0, 0, 612, 792, fill=(0.968, 0.976, 0.992)))
    commands.append(_pdf_text(48, 756, "Test Run Report", size=23, bold=True, color=(0.070, 0.137, 0.255)))
    commands.append(
        _pdf_text(48, 736, f"Run: {run['name']} ({run['id']})", size=10.5, color=(0.290, 0.337, 0.424))
    )
    commands.append(
        _pdf_text(
            48,
            722,
            f"Environment: {environment_label}   Build: {run['build'] or '-'}",
            size=9.5,
            color=(0.290, 0.337, 0.424),
        )
    )
    commands.append(
        _pdf_text(48, 708, f"Generated at: {payload['generated_at']}", size=8.5, color=(0.450, 0.490, 0.560))
    )
    return commands


def _pdf_dashboard_summary_cards_commands(summary: dict) -> list[str]:
    commands: list[str] = []
    card_y = 628
    card_height = 74
    card_gap = 12
    card_width = (612 - 96 - card_gap * 4) / 5
    cards = [
        ("Total Tests", str(summary["total"]), (0.231, 0.510, 0.965)),
        ("Pass Rate", f"{summary['pass_rate']}%", (0.133, 0.773, 0.369)),
        ("Progress", f"{summary['progress_rate']}%", (0.278, 0.333, 0.420)),
        ("Error", str(summary["error"]), (0.937, 0.267, 0.267)),
        ("Failure", str(summary["failure"]), (0.761, 0.141, 0.141)),
    ]
    for index, (label, value, accent_color) in enumerate(cards):
        x = 48 + index * (card_width + card_gap)
        commands.extend(_pdf_rect(x, card_y, card_width, card_height, fill=(1.0, 1.0, 1.0), stroke=(0.86, 0.89, 0.93)))
        commands.extend(_pdf_rect(x, card_y + card_height - 6, card_width, 6, fill=accent_color))
        commands.append(_pdf_text(x + 12, card_y + 44, label, size=9, color=(0.435, 0.475, 0.549)))
        commands.append(_pdf_text(x + 12, card_y + 18, value, size=21, bold=True, color=(0.098, 0.129, 0.184)))
    return commands


def _pdf_dashboard_status_chart_commands(counts_by_status: dict[str, int], max_count: float) -> list[str]:
    commands: list[str] = []
    bar_section_x = 48
    bar_section_y = 358
    bar_section_width = 516
    bar_section_height = 250
    commands.extend(
        _pdf_rect(
            bar_section_x,
            bar_section_y,
            bar_section_width,
            bar_section_height,
            fill=(1.0, 1.0, 1.0),
            stroke=(0.86, 0.89, 0.93),
        )
    )
    commands.append(
        _pdf_text(
            bar_section_x + 16,
            bar_section_y + bar_section_height - 26,
            "Status Distribution",
            size=12.5,
            bold=True,
            color=(0.133, 0.173, 0.243),
        )
    )

    chart_x = bar_section_x + 36
    chart_y = bar_section_y + 54
    chart_width = bar_section_width - 68
    chart_height = bar_section_height - 96
    for tick in range(0, 5):
        y = chart_y + tick * (chart_height / 4)
        commands.append(_pdf_line(chart_x, y, chart_x + chart_width, y, color=(0.90, 0.92, 0.95), line_width=0.6))

    commands.append(_pdf_line(chart_x, chart_y, chart_x + chart_width, chart_y, color=(0.78, 0.81, 0.87), line_width=1.0))
    commands.append(_pdf_line(chart_x, chart_y, chart_x, chart_y + chart_height, color=(0.78, 0.81, 0.87), line_width=1.0))

    bar_gap = 18
    bar_count = len(RUN_STATUS_ORDER)
    bar_width = (chart_width - bar_gap * (bar_count - 1)) / bar_count
    short_labels = {
        RunItemStatus.untested.value: "Untested",
        RunItemStatus.in_progress.value: "In Prog.",
        RunItemStatus.passed.value: "Passed",
        RunItemStatus.error.value: "Error",
        RunItemStatus.failure.value: "Failure",
        RunItemStatus.blocked.value: "Blocked",
        RunItemStatus.skipped.value: "Skipped",
        RunItemStatus.xfailed.value: "XFail",
        RunItemStatus.xpassed.value: "XPass",
    }

    for index, status in enumerate(RUN_STATUS_ORDER):
        status_key = status.value
        count = counts_by_status.get(status_key, 0)
        bar_height = (count / max_count) * chart_height if count > 0 else 0
        x = chart_x + index * (bar_width + bar_gap)
        color = PDF_STATUS_COLORS.get(status_key, (0.50, 0.55, 0.62))
        if bar_height > 0:
            commands.extend(_pdf_rect(x, chart_y, bar_width, bar_height, fill=color))
        commands.append(
            _pdf_text(
                x + (bar_width * 0.25),
                chart_y + bar_height + 7,
                str(count),
                size=8.5,
                bold=True,
                color=(0.180, 0.227, 0.302),
            )
        )
        commands.append(
            _pdf_text(
                x + (bar_width * 0.06),
                chart_y - 16,
                short_labels[status_key],
                size=7.8,
                color=(0.349, 0.396, 0.478),
            )
        )
    return commands


def _pdf_dashboard_progress_section_commands(
    summary: dict,
    counts_by_status: dict[str, int],
    *,
    total: float,
) -> list[str]:
    commands: list[str] = []
    progress_section_x = 48
    progress_section_y = 120
    progress_section_width = 516
    progress_section_height = 220
    commands.extend(
        _pdf_rect(
            progress_section_x,
            progress_section_y,
            progress_section_width,
            progress_section_height,
            fill=(1.0, 1.0, 1.0),
            stroke=(0.86, 0.89, 0.93),
        )
    )
    commands.append(
        _pdf_text(
            progress_section_x + 16,
            progress_section_y + progress_section_height - 26,
            "Progress Breakdown",
            size=12.5,
            bold=True,
            color=(0.133, 0.173, 0.243),
        )
    )

    progress_bar_x = progress_section_x + 20
    progress_bar_y = progress_section_y + progress_section_height - 72
    progress_bar_width = progress_section_width - 40
    progress_bar_height = 26
    commands.extend(_pdf_rect(progress_bar_x, progress_bar_y, progress_bar_width, progress_bar_height, fill=(0.94, 0.95, 0.97)))

    cursor_x = progress_bar_x
    for status in RUN_STATUS_ORDER:
        status_key = status.value
        count = counts_by_status.get(status_key, 0)
        if count <= 0:
            continue
        segment_width = (count / total) * progress_bar_width
        if segment_width <= 0:
            continue
        color = PDF_STATUS_COLORS.get(status_key, (0.50, 0.55, 0.62))
        commands.extend(_pdf_rect(cursor_x, progress_bar_y, segment_width, progress_bar_height, fill=color))
        if segment_width >= 44:
            commands.append(
                _pdf_text(
                    cursor_x + 6,
                    progress_bar_y + 8,
                    f"{round((count / total) * 100)}%",
                    size=8,
                    bold=True,
                    color=(1.0, 1.0, 1.0),
                )
            )
        cursor_x += segment_width

    commands.append(
        _pdf_text(
            progress_section_x + 20,
            progress_bar_y - 20,
            (
                f"Pass rate: {summary['pass_rate']}%   Progress: {summary['progress_rate']}%   "
                f"Error: {summary['error']}   Failure: {summary['failure']}"
            ),
            size=9.5,
            color=(0.286, 0.333, 0.420),
        )
    )

    legend_start_x = progress_section_x + 20
    legend_start_y = progress_section_y + 72
    legend_col_width = 160
    for index, status in enumerate(RUN_STATUS_ORDER):
        status_key = status.value
        row = index // 3
        col = index % 3
        x = legend_start_x + col * legend_col_width
        y = legend_start_y - row * 24
        color = PDF_STATUS_COLORS.get(status_key, (0.50, 0.55, 0.62))
        commands.extend(_pdf_rect(x, y, 10, 10, fill=color))
        commands.append(
            _pdf_text(
                x + 15,
                y + 1,
                f"{PDF_STATUS_LABELS[status_key]}: {counts_by_status.get(status_key, 0)}",
                size=8.8,
                color=(0.286, 0.333, 0.420),
            )
        )

    commands.append(
        _pdf_text(
            48,
            76,
            "Charts in this report are generated automatically from current run item statuses.",
            size=8,
            color=(0.470, 0.517, 0.596),
        )
    )
    return commands


def _build_pdf_dashboard_stream(payload: dict) -> bytes:
    run = payload["test_run"]
    summary = payload["summary"]
    counts_by_status = {item["status"]: item["count"] for item in payload["by_status"]}
    total = max(summary["total"], 1)
    max_count = max(max(counts_by_status.values(), default=0), 1)

    commands: list[str] = []
    commands.extend(_pdf_dashboard_header_commands(payload, run))
    commands.extend(_pdf_dashboard_summary_cards_commands(summary))
    commands.extend(_pdf_dashboard_status_chart_commands(counts_by_status, float(max_count)))
    commands.extend(_pdf_dashboard_progress_section_commands(summary, counts_by_status, total=float(total)))
    return "\n".join(commands).encode("latin-1")


def _build_pdf_text_page_stream(lines: list[str]) -> bytes:
    if not lines:
        lines = [""]
    stream_lines = ["BT", "/F1 10 Tf", "0.110 0.137 0.188 rg", "50 760 Td", "14 TL"]
    stream_lines.append(f"({_escape_pdf_text(lines[0])}) Tj")
    for line in lines[1:]:
        stream_lines.append("T*")
        stream_lines.append(f"({_escape_pdf_text(line)}) Tj")
    stream_lines.append("ET")
    return "\n".join(stream_lines).encode("latin-1")


def _build_pdf_from_streams(streams: list[bytes]) -> bytes:
    if not streams:
        streams = [b""]

    objects: dict[int, bytes] = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        3: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        4: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    }

    page_kids: list[str] = []
    next_object_id = 5
    for stream_content in streams:
        page_object_id = next_object_id
        content_object_id = next_object_id + 1
        next_object_id += 2
        page_kids.append(f"{page_object_id} 0 R")

        objects[content_object_id] = (
            f"<< /Length {len(stream_content)} >>\nstream\n".encode("latin-1")
            + stream_content
            + b"\nendstream"
        )
        objects[page_object_id] = (
            (
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {content_object_id} 0 R >>"
            ).encode("latin-1")
        )

    objects[2] = f"<< /Type /Pages /Count {len(streams)} /Kids [{' '.join(page_kids)}] >>".encode("latin-1")

    max_object_id = max(objects)
    pdf_content = bytearray()
    pdf_content.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")

    offsets = [0] * (max_object_id + 1)
    for object_id in range(1, max_object_id + 1):
        payload = objects[object_id]
        offsets[object_id] = len(pdf_content)
        pdf_content.extend(f"{object_id} 0 obj\n".encode("latin-1"))
        pdf_content.extend(payload)
        if not payload.endswith(b"\n"):
            pdf_content.extend(b"\n")
        pdf_content.extend(b"endobj\n")

    xref_offset = len(pdf_content)
    pdf_content.extend(f"xref\n0 {max_object_id + 1}\n".encode("latin-1"))
    pdf_content.extend(b"0000000000 65535 f \n")
    for object_id in range(1, max_object_id + 1):
        pdf_content.extend(f"{offsets[object_id]:010} 00000 n \n".encode("latin-1"))

    pdf_content.extend(
        (
            f"trailer\n<< /Size {max_object_id + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        ).encode("latin-1")
    )
    return bytes(pdf_content)


def serialize_report_pdf(payload: dict) -> tuple[bytes, str, str]:
    """Serializes payload to PDF. Returns (content, media_type, extension)."""
    detail_lines: list[str] = []
    for line in _build_pdf_detail_lines(payload):
        detail_lines.extend(_wrap_pdf_line(line))

    max_detail_lines_per_page = 50
    detail_pages = [
        detail_lines[index : index + max_detail_lines_per_page]
        for index in range(0, len(detail_lines), max_detail_lines_per_page)
    ]
    detail_streams = [_build_pdf_text_page_stream(page) for page in detail_pages]
    streams = [_build_pdf_dashboard_stream(payload), *detail_streams]
    content = _build_pdf_from_streams(streams)
    return content, "application/pdf", "pdf"
