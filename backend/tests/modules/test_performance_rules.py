from app.modules.performance.services.comparisons import _build_comparison_and_verdict


async def test_build_comparison_without_baseline_defaults_to_yellow() -> None:
    verdict, comparisons, regressions = _build_comparison_and_verdict(
        current={
            "throughput_rps": 120.0,
            "error_rate_pct": 0.5,
            "p95_ms": 220,
            "p99_ms": 350,
            "checks_passed": 95,
            "checks_total": 100,
        },
        baseline=None,
    )

    assert verdict == "yellow"
    assert regressions == []
    assert comparisons[0]["baseline"] == "n/a"


async def test_build_comparison_detects_warn_level_regression() -> None:
    verdict, _comparisons, regressions = _build_comparison_and_verdict(
        current={
            "throughput_rps": 100.0,
            "error_rate_pct": 1.2,
            "p95_ms": 112,
            "p99_ms": 160,
            "checks_passed": 98,
            "checks_total": 100,
        },
        baseline={
            "throughput_rps": 100.0,
            "error_rate_pct": 1.0,
            "p95_ms": 100,
            "p99_ms": 150,
            "checks_passed": 99,
            "checks_total": 100,
        },
    )

    assert verdict == "yellow"
    assert any("P95 latency increased" in item["title"] for item in regressions)


async def test_build_comparison_detects_red_level_regression() -> None:
    verdict, _comparisons, regressions = _build_comparison_and_verdict(
        current={
            "throughput_rps": 80.0,
            "error_rate_pct": 2.5,
            "p95_ms": 140,
            "p99_ms": 200,
            "checks_passed": 90,
            "checks_total": 100,
        },
        baseline={
            "throughput_rps": 100.0,
            "error_rate_pct": 1.0,
            "p95_ms": 100,
            "p99_ms": 150,
            "checks_passed": 99,
            "checks_total": 100,
        },
    )

    assert verdict == "red"
    assert regressions
