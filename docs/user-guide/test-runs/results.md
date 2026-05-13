# Results and Imports

This page covers result entry, bulk updates, JUnit XML import into an existing run, and dataset rows.

## Add Run Result

`Add Result` opens the result modal.

!!! screenshot "SCREENSHOT TODO: Add Run Result Modal"
    Add a screenshot with status Failure, failed step, actual result, defect field, and Jira auto-create.

### Result Fields

| Field | Used When |
| --- | --- |
| `Select Status` | Required for every result. |
| `Time` | Execution time such as `10m`, `1h`, or `00:15:00`. |
| `Failed Step` | Required for `Failure` when the case has steps. |
| `Actual Result` | Required for `Failure`. |
| `Defect ID / Link` | Useful for `Error`, `Failure`, `Blocked`, and `XPassed`. |
| `Auto-create Jira issue on failure` | Creates a Jira issue when status is `Failure` and no defect field is provided. |
| `Comment` | Required for `Error`, `Failure`, `Blocked`, and `XPassed`. |

### Status Guidance

| Status | Use When |
| --- | --- |
| `Passed` | Actual behavior matches expected behavior. |
| `Failure` | Product behavior is wrong and needs triage. |
| `Error` | The test could not run correctly because of tooling, data, or execution error. |
| `Blocked` | External dependency, environment issue, or upstream defect prevents execution. |
| `Skipped` | The case is intentionally skipped for this scope. |
| `XFailed` | A known expected failure is confirmed. |
| `XPassed` | A scenario expected to fail unexpectedly passed and needs review. |
| `In Progress` | Execution started but is not final. |
| `Untested` | No result has been recorded. |

The current UI applies one payload to all rows of a run item. Row-level updates are available through the API.

## Bulk Update Run Items

When users select multiple run items, the bulk toolbar can edit selected items, delete selected items, or clear selection.

Bulk edit uses the same result modal and applies the result to every selected item. For bulk failures, users can add a shared comment, defect reference, or Jira auto-create setting.

## JUnit XML Import into Existing Run

For `not_started` and `in_progress` runs:

1. Click `Import JUnit`.
2. Choose an `.xml` file.
3. Optionally enable `Create missing test cases`.
4. Run `Dry Run` to preview matching.
5. Review matched, unmatched, ambiguous, and error lists.
6. Click `Import Results`.

!!! screenshot "SCREENSHOT TODO: JUnit Dry Run"
    Add a screenshot of the dry-run summary and unmatched/ambiguous/error lists.

## Dataset Rows in Runs

When a test case is linked to datasets, the backend creates Run Case Rows:

- cases without datasets get one `Default scenario` row;
- one dataset creates one row per selected dataset row;
- multiple datasets create combinations;
- each row stores dataset alias, dataset id/name, revision, row key, scenario label, and values.

Row snapshots make results reproducible even if the dataset changes later.
