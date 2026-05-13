# Test Case Scenarios and Practices

This page shows common Test Case workflows and maintenance rules.

## Prepare Regression Scope

A QA lead filters active cases by product and component, reviews mandatory coverage, bulk-adds a release tag, and assigns owners. This reduces manual work when building a test plan and makes the release scope transparent.

## Support Automation

An automation engineer creates an automated or step-based case with a stable `automation_id`. When CI imports JUnit XML, the result lands in that case history.

## Investigate a Regression Failure

A tester opens the failing case, reviews Results History, expands the latest result, checks build, environment revision, stderr, and artifacts, then links a Jira issue from the Defects tab.

## Reuse a Check Across Data Variants

One case such as `Discount calculation applies correct final price` can link to a dataset containing coupons, currencies, and customer segments. The test logic stays single-source while data coverage expands.

## Practices

- Make titles testable: `Refund is rejected after settlement`, not `Refund test`.
- Use `Steps` for critical manual procedures and `Text` for short smoke or exploratory checks.
- Fill `Primary Product` and `Component Coverage` when a case affects release readiness.
- Keep `automation_id` stable for automated tests.
- Archive outdated cases when history matters; delete only when history is not needed.
- Use datasets for input variation instead of copying near-identical cases.
