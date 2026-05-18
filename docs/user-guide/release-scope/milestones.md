# Milestones

Milestones group plans and runs under a release, sprint, hotfix, or acceptance cycle. They provide a consolidated readiness view.

## Milestone List

The Milestones page supports search, status filter, column visibility, server-side pagination, create, edit, archive, delete, and details view.

## Fields

| Field | Description |
| --- | --- |
| `Name` | Release or cycle name. |
| `Description` | Scope and context. |
| `Target Date` | Planned completion date. |
| `Release Label` | Version, train, or release candidate. |
| `Status` | Current milestone state. |

## Details Page

Milestone details show linked plans and runs, total tests, pass rate, failed, blocked, untested, overdue items, and readiness context.

## Link Plans and Runs

Plans and runs can reference a milestone. This allows release managers to review execution status without opening every run individually.

## Practices

- Create a milestone for every release or sprint where consolidated readiness matters.
- Keep target date and release label current.
- Review blocked, failed, and untested counts before changing status to completed.
- Archive old milestones instead of deleting them when history matters.
