from __future__ import annotations

import json

from app.modules.report_import.tms_results_json import parse_tms_results_json


async def test_parse_tms_results_json_xfail_status() -> None:
    payload = {"cases": [{"name": "tc_one", "status": "xfailed"}]}
    report = parse_tms_results_json(json.dumps(payload).encode("utf-8"))
    assert report.cases[0].status == "xfailed"
