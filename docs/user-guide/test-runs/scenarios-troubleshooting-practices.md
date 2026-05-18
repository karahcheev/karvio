# Test Run Scenarios, Troubleshooting, and Practices

This page covers common Test Run workflows and failure modes.

## Release Regression

A QA lead creates a run from release suites and tags, selects milestone and environment revision, then starts execution. The team filters run items by assignee and status, records results, links Jira issues, and closes the run only after every active item has a final status.

## CI Automation Import

An automation pipeline generates JUnit XML. An engineer imports the report into an existing run or uses project-level import. Karvio matches tests by `automation_id` or name, updates run item statuses, and can create missing cases when enabled.

## Reusable Scope from a Test Plan

A team stores `Core Smoke` as a test plan. For each deployment, the QA lead creates a separate run from that plan and records build and environment. Scope stays consistent while execution evidence stays separate.

## UAT Sign-Off

A product owner and QA lead use a milestone-linked run as the acceptance checklist. The final PDF export becomes part of release approval.

## Environment-Specific Failure

The same run item fails on `staging-eu · r5` but passes on `staging-us · r2`. Run overview and test case history show build, environment revision, and stderr, so triage can focus on configuration drift.

## Mass Blocked During an Incident

If a dependency such as a payment sandbox is down, QA selects affected run items, sets `Blocked`, adds an incident comment, and links one shared Jira issue.

## Completion Error

A run cannot be completed while any item is `In Progress`. Filter the run items table by `In Progress`, move those items to a final status or back to `Untested`, then complete the run again.

## JUnit Import Did Not Match Tests

Check automation IDs and case names. Dry run lists unmatched and ambiguous entries. Use `Create missing test cases` only for genuinely new automated checks.

## Dataset Row Results

The UI records one result for all rows of a run item. Use the row API when automation or data-driven execution needs separate statuses per dataset row.

## Practices

- Include scope and build in the run name, such as `Checkout Smoke – RC2`.
- Select an environment for release evidence.
- Use `Create` for planned scope review and `Create and Start` for urgent execution.
- Before completion, confirm there are no `In Progress` items and failures/blockers have comments.
- Use `XFailed` for known expected failures and `XPassed` for unexpected recovery.
- Create a new run instead of editing completed or archived evidence.
