"""PDF export for project overview dashboard."""

from __future__ import annotations

from app.modules.reports.adapters.export_pdf import (
    _build_pdf_from_streams,
    _build_pdf_text_page_stream,
    _pdf_line,
    _pdf_rect,
    _pdf_text,
    _wrap_pdf_line,
)

_STATUS_NAME_TO_KEY = {
    "Passed": "passed",
    "Error": "error",
    "Failure": "failure",
    "Blocked": "blocked",
    "Skipped": "skipped",
    "In progress": "in_progress",
    "Untested": "untested",
    "XFailed": "xfailed",
    "XPassed": "xpassed",
}

_STATUS_DISPLAY_COLORS: dict[str, tuple[float, float, float]] = {
    "passed": (0.133, 0.773, 0.369),
    "error": (0.937, 0.267, 0.267),
    "failure": (0.761, 0.141, 0.141),
    "blocked": (0.918, 0.722, 0.043),
    "skipped": (0.392, 0.455, 0.545),
    "in_progress": (0.231, 0.510, 0.965),
    "untested": (0.620, 0.639, 0.686),
    "xfailed": (0.580, 0.451, 0.933),
    "xpassed": (0.910, 0.302, 0.302),
}

_BLUE = (0.231, 0.510, 0.965)
_GREEN = (0.133, 0.773, 0.369)
_RED = (0.937, 0.267, 0.267)
_DARK_RED = (0.761, 0.141, 0.141)
_YELLOW = (0.918, 0.722, 0.043)
_TITLE = (0.070, 0.137, 0.255)
_SUBTITLE = (0.290, 0.337, 0.424)
_META = (0.450, 0.490, 0.560)
_BODY = (0.098, 0.129, 0.184)
_BORDER = (0.86, 0.89, 0.93)
_GRID = (0.90, 0.92, 0.95)
_AXIS = (0.78, 0.81, 0.87)
_BAR_LABEL = (0.180, 0.227, 0.302)
_AXIS_LABEL = (0.349, 0.396, 0.478)
_SECTION_TITLE = (0.133, 0.173, 0.243)
_BG = (0.968, 0.976, 0.992)
_WHITE = (1.0, 1.0, 1.0)


def _kpi_card(
    x: float, y: float, width: float, height: float, label: str, value: str, accent: tuple[float, float, float]
) -> list[str]:
    commands: list[str] = []
    commands.extend(_pdf_rect(x, y, width, height, fill=_WHITE, stroke=_BORDER))
    commands.extend(_pdf_rect(x, y + height - 5, width, 5, fill=accent))
    commands.append(_pdf_text(x + 10, y + height - 26, label, size=8.5, color=_META))
    commands.append(_pdf_text(x + 10, y + 10, value, size=19, bold=True, color=_BODY))
    return commands


def _section_box(
    x: float, y: float, width: float, height: float, title: str
) -> list[str]:
    commands: list[str] = []
    commands.extend(_pdf_rect(x, y, width, height, fill=_WHITE, stroke=_BORDER))
    commands.append(
        _pdf_text(x + 16, y + height - 26, title, size=12.5, bold=True, color=_SECTION_TITLE)
    )
    return commands


def _bar_chart(
    x: float, y: float, width: float, height: float, bars: list[tuple[str, float, tuple[float, float, float]]]
) -> list[str]:
    """Vertical bar chart. bars = [(label, value, color), ...]"""
    if not bars:
        return []
    commands: list[str] = []
    max_value = max(v for _, v, _ in bars)
    if max_value <= 0:
        max_value = 1.0

    grid_x = x + 36
    grid_y = y
    grid_w = width - 50
    grid_h = height - 36

    # Grid lines + Y-axis
    for tick in range(5):
        ty = grid_y + tick * (grid_h / 4)
        commands.append(_pdf_line(grid_x, ty, grid_x + grid_w, ty, color=_GRID, line_width=0.6))
    commands.append(_pdf_line(grid_x, grid_y, grid_x + grid_w, grid_y, color=_AXIS, line_width=1.0))
    commands.append(_pdf_line(grid_x, grid_y, grid_x, grid_y + grid_h, color=_AXIS, line_width=1.0))

    bar_count = len(bars)
    bar_gap = max(4.0, min(16.0, (grid_w * 0.2) / bar_count))
    bar_width = (grid_w - bar_gap * (bar_count - 1)) / bar_count

    for idx, (label, value, color) in enumerate(bars):
        bx = grid_x + idx * (bar_width + bar_gap)
        bar_height = (value / max_value) * grid_h if value > 0 else 0.0
        if bar_height > 0:
            commands.extend(_pdf_rect(bx, grid_y, bar_width, bar_height, fill=color))
        count_label = str(int(value)) if value == int(value) else f"{value:.1f}"
        commands.append(
            _pdf_text(bx + max(bar_width * 0.1, 2), grid_y + bar_height + 5, count_label, size=7.5, bold=True, color=_BAR_LABEL)
        )
        # Truncate label to fit
        max_chars = max(int(bar_width / 5.5), 3)
        short_label = label[:max_chars] if len(label) > max_chars else label
        commands.append(
            _pdf_text(bx + max(bar_width * 0.05, 1), grid_y - 14, short_label, size=7.0, color=_AXIS_LABEL)
        )

    return commands


def _build_page1(payload: dict) -> bytes:
    stats = payload["release_stats"]
    project_id = payload["project_id"]
    from_date = payload.get("created_from") or "Start"
    to_date = payload.get("created_to") or "Now"
    generated_at = payload["generated_at"]
    run_count = payload["run_count"]
    granularity = payload.get("granularity", "day")
    status_dist = payload.get("status_distribution", [])

    pass_rate = round(stats.get("pass_rate", 0))

    commands: list[str] = []
    commands.extend(_pdf_rect(0, 0, 612, 792, fill=_BG))

    # Header block
    commands.append(_pdf_text(48, 748, "Project Overview Report", size=22, bold=True, color=_TITLE))
    commands.append(
        _pdf_text(48, 727, f"Project: {project_id}     Period: {from_date}  –  {to_date}", size=10, color=_SUBTITLE)
    )
    commands.append(
        _pdf_text(
            48,
            713,
            f"Generated: {generated_at}     Runs in window: {run_count}     Granularity: {granularity}",
            size=8.5,
            color=_META,
        )
    )
    commands.append(_pdf_line(48, 703, 564, 703, color=(0.82, 0.84, 0.88)))

    # KPI cards — two rows of 3
    card_w = 156.0
    card_h = 68.0
    card_gap = 12.0
    row1_y = 623.0
    row2_y = row1_y - card_h - 10.0

    kpi_row1 = [
        ("Total items", str(stats.get("total", 0)), _BLUE),
        ("Pass rate", f"{pass_rate}%", _GREEN),
        ("Passed", str(stats.get("passed", 0)), _GREEN),
    ]
    kpi_row2 = [
        ("Error", str(stats.get("error", 0)), _RED),
        ("Failure", str(stats.get("failure", 0)), _DARK_RED),
        ("Blocked", str(stats.get("blocked", 0)), _YELLOW),
    ]
    for idx, (label, value, accent) in enumerate(kpi_row1):
        kx = 48.0 + idx * (card_w + card_gap)
        commands.extend(_kpi_card(kx, row1_y, card_w, card_h, label, value, accent))
    for idx, (label, value, accent) in enumerate(kpi_row2):
        kx = 48.0 + idx * (card_w + card_gap)
        commands.extend(_kpi_card(kx, row2_y, card_w, card_h, label, value, accent))

    # Active runs badge (right side, row 2)
    active_runs = stats.get("active_runs", 0)
    badge_x = 48.0 + 3 * (card_w + card_gap)
    badge_w = 516.0 - 3 * (card_w + card_gap)
    if badge_w >= 60:
        commands.extend(_pdf_rect(badge_x, row2_y, badge_w, card_h, fill=_WHITE, stroke=_BORDER))
        commands.extend(_pdf_rect(badge_x, row2_y + card_h - 5, badge_w, 5, fill=_BLUE))
        commands.append(_pdf_text(badge_x + 10, row2_y + card_h - 26, "Active runs", size=8.5, color=_META))
        commands.append(_pdf_text(badge_x + 10, row2_y + 10, str(active_runs), size=19, bold=True, color=_BODY))

    # Status distribution chart
    chart_top = row2_y - 18.0
    chart_section_h = chart_top - 90.0
    chart_section_y = 90.0

    if status_dist and chart_section_h > 100:
        commands.extend(_section_box(48, chart_section_y, 516, chart_section_h, "Status Distribution"))
        inner_margin = 20.0
        inner_h = chart_section_h - 56.0
        bars = []
        for item in status_dist:
            key = _STATUS_NAME_TO_KEY.get(item["name"], item["name"].lower().replace(" ", "_"))
            color = _STATUS_DISPLAY_COLORS.get(key, (0.5, 0.55, 0.62))
            bars.append((item["name"], float(item["value"]), color))
        commands.extend(
            _bar_chart(
                48 + inner_margin,
                chart_section_y + inner_margin,
                516 - inner_margin * 2,
                inner_h,
                bars,
            )
        )

    commands.append(
        _pdf_text(
            48, 60, "This report was generated from run data within the selected date range.", size=8, color=_META
        )
    )
    return "\n".join(commands).encode("latin-1")


def _build_pass_rate_trend_section(
    x: float, y: float, width: float, height: float, status_trend: list[dict]
) -> list[str]:
    if not status_trend:
        return []
    commands: list[str] = []
    commands.extend(_section_box(x, y, width, height, "Pass Rate Trend"))
    inner_margin = 20.0
    bars = [
        (item["bucket_label"], float(item["pass_rate"]), _GREEN)
        for item in status_trend
    ]
    # Cap to last 30 buckets so bars don't get too thin
    if len(bars) > 30:
        bars = bars[-30:]
    commands.extend(_bar_chart(x + inner_margin, y + inner_margin, width - inner_margin * 2, height - 56, bars))
    return commands


def _build_execution_trend_section(
    x: float, y: float, width: float, height: float, execution_trend: list[dict]
) -> list[str]:
    if not execution_trend:
        return []
    commands: list[str] = []
    commands.extend(_section_box(x, y, width, height, "Execution Trend (runs per period)"))
    inner_margin = 20.0
    bars = [
        (item["bucket_label"], float(item["runs"]), _BLUE)
        for item in execution_trend
    ]
    if len(bars) > 30:
        bars = bars[-30:]
    commands.extend(_bar_chart(x + inner_margin, y + inner_margin, width - inner_margin * 2, height - 56, bars))
    return commands


def _build_assignee_section(
    x: float, y: float, width: float, height: float, execution_by_assignee: list[dict]
) -> list[str]:
    if not execution_by_assignee:
        return []
    commands: list[str] = []
    commands.extend(_section_box(x, y, width, height, "Execution by Assignee"))
    inner_margin = 20.0
    bars = [
        (item["assignee_name"], float(item["executed"]), _BLUE)
        for item in execution_by_assignee[:12]
    ]
    commands.extend(_bar_chart(x + inner_margin, y + inner_margin, width - inner_margin * 2, height - 56, bars))
    return commands


def _build_dimension_section(
    x: float, y: float, width: float, height: float, title: str, items: list[dict], name_key: str
) -> list[str]:
    if not items:
        return []
    commands: list[str] = []
    commands.extend(_section_box(x, y, width, height, title))
    inner_margin = 20.0
    bars = [(item[name_key], float(item["runs"]), _BLUE) for item in items[:12]]
    commands.extend(_bar_chart(x + inner_margin, y + inner_margin, width - inner_margin * 2, height - 56, bars))
    return commands


def _build_page2(payload: dict) -> bytes | None:
    status_trend = payload.get("status_trend") or []
    execution_trend = payload.get("execution_trend") or []
    if not status_trend and not execution_trend:
        return None

    commands: list[str] = []
    commands.extend(_pdf_rect(0, 0, 612, 792, fill=_BG))
    commands.append(_pdf_text(48, 754, "Project Overview Report – Trends", size=14, bold=True, color=_TITLE))
    commands.append(_pdf_line(48, 744, 564, 744, color=(0.82, 0.84, 0.88)))

    if status_trend and execution_trend:
        commands.extend(_build_pass_rate_trend_section(48, 390, 516, 330, status_trend))
        commands.extend(_build_execution_trend_section(48, 44, 516, 330, execution_trend))
    elif status_trend:
        commands.extend(_build_pass_rate_trend_section(48, 44, 516, 680, status_trend))
    else:
        commands.extend(_build_execution_trend_section(48, 44, 516, 680, execution_trend))

    return "\n".join(commands).encode("latin-1")


def _build_page3(payload: dict) -> bytes | None:
    execution_by_assignee = payload.get("execution_by_assignee") or []
    runs_by_environment = payload.get("runs_by_environment") or []
    runs_by_build = payload.get("runs_by_build") or []

    has_assignee = bool(execution_by_assignee)
    has_env = bool(runs_by_environment)
    has_build = bool(runs_by_build)
    if not has_assignee and not has_env and not has_build:
        return None

    commands: list[str] = []
    commands.extend(_pdf_rect(0, 0, 612, 792, fill=_BG))
    commands.append(_pdf_text(48, 754, "Project Overview Report – Dimensions", size=14, bold=True, color=_TITLE))
    commands.append(_pdf_line(48, 744, 564, 744, color=(0.82, 0.84, 0.88)))

    # Layout: assignee full width, then env/build side by side
    sections: list[tuple[str, list[str]]] = []
    if has_assignee:
        sections.append(("assignee", execution_by_assignee))
    if has_env:
        sections.append(("env", runs_by_environment))
    if has_build:
        sections.append(("build", runs_by_build))

    if len(sections) == 1:
        if sections[0][0] == "assignee":
            commands.extend(_build_assignee_section(48, 44, 516, 680, execution_by_assignee))
        elif sections[0][0] == "env":
            commands.extend(_build_dimension_section(48, 44, 516, 680, "Runs by Environment", runs_by_environment, "environment"))
        else:
            commands.extend(_build_dimension_section(48, 44, 516, 680, "Runs by Build", runs_by_build, "build"))
    elif len(sections) == 2:
        commands.extend(_build_assignee_section(48, 370, 516, 355, execution_by_assignee) if has_assignee else [])
        y2 = 44
        if has_env:
            commands.extend(_build_dimension_section(48, y2, 516, 300, "Runs by Environment", runs_by_environment, "environment"))
        elif has_build:
            commands.extend(_build_dimension_section(48, y2, 516, 300, "Runs by Build", runs_by_build, "build"))
    else:
        # All three: assignee on top, env/build side by side below
        commands.extend(_build_assignee_section(48, 420, 516, 305, execution_by_assignee))
        half_w = 246.0
        commands.extend(_build_dimension_section(48, 44, half_w, 355, "Runs by Environment", runs_by_environment, "environment"))
        commands.extend(_build_dimension_section(48 + half_w + 24, 44, half_w, 355, "Runs by Build", runs_by_build, "build"))

    return "\n".join(commands).encode("latin-1")


def _build_detail_lines(payload: dict) -> list[str]:
    stats = payload["release_stats"]
    lines: list[str] = [
        "Project Overview — Data Appendix",
        f"Generated: {payload['generated_at']}",
        "",
        f"Project ID: {payload['project_id']}",
        f"Period: {payload.get('created_from') or 'Start'}  to  {payload.get('created_to') or 'Now'}",
        f"Granularity: {payload.get('granularity', 'day')}",
        f"Run count: {payload['run_count']}",
        "",
        "Release Stats",
        f"  Total items: {stats.get('total', 0)}",
        f"  Pass rate:   {round(stats.get('pass_rate', 0))}%",
        f"  Active runs: {stats.get('active_runs', 0)}",
        f"  Passed:      {stats.get('passed', 0)}",
        f"  Error:       {stats.get('error', 0)}",
        f"  Failure:     {stats.get('failure', 0)}",
        f"  Blocked:     {stats.get('blocked', 0)}",
        f"  Skipped:     {stats.get('skipped', 0)}",
        f"  Untested:    {stats.get('untested', 0)}",
        f"  In progress: {stats.get('in_progress', 0)}",
        "",
    ]

    recent = payload.get("recent_activity") or []
    if recent:
        lines.append(f"Recent Activity ({len(recent)})")
        for item in recent:
            build_part = f"  build: {item['build']}" if item.get("build") else ""
            lines.append(f"  {item['updated_at'][:10]}  {item['status']:12}  {item['name']}{build_part}")
        lines.append("")

    failures = payload.get("failures_by_run") or []
    if failures:
        lines.append(f"Failures by Run ({len(failures)})")
        for item in failures:
            lines.append(f"  {item['category']}  error: {item['error']}  failure: {item['failure']}")
        lines.append("")

    return lines


def serialize_overview_pdf(payload: dict) -> tuple[bytes, str, str]:
    """Serializes overview payload to PDF. Returns (content, media_type, extension)."""
    streams: list[bytes] = []

    page1 = _build_page1(payload)
    streams.append(page1)

    page2 = _build_page2(payload)
    if page2 is not None:
        streams.append(page2)

    page3 = _build_page3(payload)
    if page3 is not None:
        streams.append(page3)

    detail_lines: list[str] = []
    for line in _build_detail_lines(payload):
        detail_lines.extend(_wrap_pdf_line(line))
    max_per_page = 50
    for idx in range(0, len(detail_lines), max_per_page):
        streams.append(_build_pdf_text_page_stream(detail_lines[idx : idx + max_per_page]))

    content = _build_pdf_from_streams(streams)
    return content, "application/pdf", "pdf"
