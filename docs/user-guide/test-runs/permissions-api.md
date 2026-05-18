# Test Run Permissions and API

This page summarizes role requirements and API links for Test Runs.

## Permissions

| Action | Minimum Role |
| --- | --- |
| View runs and run items | `viewer` |
| Create runs | `tester` |
| Start a run | `tester` |
| Complete a run | `tester` |
| Add or remove run items | `tester` |
| Record results | `tester` |
| Import JUnit XML | `tester` |
| Export run report | `viewer` |
| Archive run | `lead` |
| Delete run through API | `lead` |

## API

Endpoint tables, query parameters, lifecycle transitions, run case rows, rerun behavior, JUnit import, and report export are documented in [Test Runs API](../api/test-runs/index.md).
