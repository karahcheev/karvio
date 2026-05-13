from __future__ import annotations

from datetime import timezone
from html import escape

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.reports.services import reports as reports_service
from app.modules.test_runs.models import TestRun


async def build_test_run_report_message(db: AsyncSession, run: TestRun) -> tuple[str, str, str]:
    summary, _ = await reports_service.build_run_summary_and_breakdown(db, run.id)
    run_name = escape(run.name)
    environment_label = run.environment_name_snapshot
    if run.environment_revision_number is not None:
        environment_label = f"{environment_label or 'Unknown'} · r{run.environment_revision_number}"
    environment = escape(environment_label) if environment_label else "Not specified"
    build = escape(run.build) if run.build else "Not specified"
    completed_at = run.completed_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC") if run.completed_at else "N/A"
    status_label = escape(run.status.value.replace("_", " ").title())
    subject = f"Karvio report: {run.name} completed"
    plain_text = (
        f"Test run completed\n\n"
        f"Run: {run.name}\n"
        f"Status: {run.status.value}\n"
        f"Completed at: {completed_at}\n"
        f"Environment: {environment_label or 'Not specified'}\n"
        f"Build: {run.build or 'Not specified'}\n\n"
        f"Summary\n"
        f"- Total: {summary.total}\n"
        f"- Passed: {summary.passed}\n"
        f"- Error: {summary.error}\n"
        f"- Failure: {summary.failure}\n"
        f"- Blocked: {summary.blocked}\n"
        f"- Skipped: {summary.skipped}\n"
        f"- Pass rate: {summary.pass_rate}%\n"
    )
    html = f"""
<html>
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden;">
      <div style="padding:28px 32px;background:linear-gradient(135deg,#111827 0%,#1f2937 100%);color:#ffffff;">
        <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.75;">Karvio Test Run Report</div>
        <h1 style="margin:12px 0 8px;font-size:28px;line-height:1.2;">{run_name}</h1>
        <p style="margin:0;font-size:14px;line-height:1.5;opacity:0.82;">The test run has completed and the final summary is ready.</p>
      </div>
      <div style="padding:24px 32px;">
        <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:#ecfdf5;color:#047857;font-size:13px;font-weight:600;">
          Status: {status_label}
        </div>

        <div style="margin-top:24px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">
          <div style="padding:16px;border:1px solid #e5e7eb;border-radius:16px;background:#f9fafb;">
            <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Total</div>
            <div style="margin-top:8px;font-size:30px;font-weight:700;color:#111827;">{summary.total}</div>
          </div>
          <div style="padding:16px;border:1px solid #dcfce7;border-radius:16px;background:#f0fdf4;">
            <div style="font-size:12px;color:#166534;text-transform:uppercase;letter-spacing:0.04em;">Passed</div>
            <div style="margin-top:8px;font-size:30px;font-weight:700;color:#166534;">{summary.passed}</div>
          </div>
          <div style="padding:16px;border:1px solid #ffedd5;border-radius:16px;background:#fff7ed;">
            <div style="font-size:12px;color:#9a3412;text-transform:uppercase;letter-spacing:0.04em;">Error</div>
            <div style="margin-top:8px;font-size:30px;font-weight:700;color:#c2410c;">{summary.error}</div>
          </div>
          <div style="padding:16px;border:1px solid #fee2e2;border-radius:16px;background:#fef2f2;">
            <div style="font-size:12px;color:#991b1b;text-transform:uppercase;letter-spacing:0.04em;">Failure</div>
            <div style="margin-top:8px;font-size:30px;font-weight:700;color:#991b1b;">{summary.failure}</div>
          </div>
          <div style="padding:16px;border:1px solid #fef3c7;border-radius:16px;background:#fffbeb;">
            <div style="font-size:12px;color:#92400e;text-transform:uppercase;letter-spacing:0.04em;">Blocked</div>
            <div style="margin-top:8px;font-size:30px;font-weight:700;color:#92400e;">{summary.blocked}</div>
          </div>
          <div style="padding:16px;border:1px solid #e5e7eb;border-radius:16px;background:#f9fafb;">
            <div style="font-size:12px;color:#4b5563;text-transform:uppercase;letter-spacing:0.04em;">Skipped</div>
            <div style="margin-top:8px;font-size:30px;font-weight:700;color:#111827;">{summary.skipped}</div>
          </div>
          <div style="padding:16px;border:1px solid #dbeafe;border-radius:16px;background:#eff6ff;">
            <div style="font-size:12px;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.04em;">Pass rate</div>
            <div style="margin-top:8px;font-size:30px;font-weight:700;color:#1d4ed8;">{summary.pass_rate}%</div>
          </div>
        </div>

        <div style="margin-top:24px;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <div style="padding:14px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#374151;">
            Run details
          </div>
          <table role="presentation" style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:180px;">Completed at</td>
              <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">{completed_at}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Environment</td>
              <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">{environment}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Build</td>
              <td style="padding:12px 16px;color:#111827;font-size:14px;">{build}</td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  </body>
</html>
"""
    return subject, plain_text, html


def build_alerting_test_message(project_id: str) -> tuple[str, str, str]:
    subject = f"Karvio alert test for project {project_id}"
    plain_text = f"Karvio alerting test notification for project {project_id}."
    html = f"<p><strong>Karvio alerting test notification</strong> for project <code>{project_id}</code>.</p>"
    return subject, plain_text, html
