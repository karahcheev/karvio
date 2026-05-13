# Bulk Operations, Permissions, and API

This page covers bulk actions, role requirements, lifecycle rules, and API links for Test Cases.

## Bulk Operations

Selecting rows in the table opens the bulk toolbar. Users can:

- bulk edit;
- bulk delete;
- clear selection.

Bulk edit can apply:

- suite;
- status;
- owner;
- tag;
- priority.

Example: after reviewing 40 draft cases, a QA lead assigns owners, adds `release-2026.05`, and moves selected cases to `Active`.

## Permissions

| Action | Minimum Role |
| --- | --- |
| View test cases and steps | `viewer` |
| Create and edit case content | `tester` |
| Change status through allowed lifecycle transitions | Depends on transition; lead and manager cover publish/archive workflows |
| Delete test cases | `lead` |
| Edit datasets from the case tab | `tester` |
| Delete datasets | `lead` |

## Lifecycle

Supported status transitions:

- `draft -> active`;
- `active -> archived`.

`archived` is terminal in the standard lifecycle.

## API

Endpoint tables, query parameters, payload examples, step management, component coverage fields, and bulk operations are documented in [Test Cases API](../api/test-cases/index.md).
