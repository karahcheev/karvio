# Test Plans

Test Plans are reusable execution scopes. A plan stores selected suites, explicit cases, tags, metadata, and optional milestone context, then creates test runs from that scope.

## Test Plan List

The Test Plans page supports search, status filter, column visibility, server-side pagination, details side panel, create, edit, delete, and Create Run.

## Create or Edit a Test Plan

The form has metadata and case selection.

### Metadata

| Field | Description |
| --- | --- |
| `Plan Name` | Required plan name. |
| `Description` | Scope, inclusion rules, and exclusions. |
| `Tags` | Labels such as `smoke`, `regression`, or `release`. |
| `Milestone` | Optional release context. |

### Test Selection

Selection modes include:

- `Tree` for suites and cases;
- `All Cases` for the flat catalog;
- `By Tag` for tag-driven scope;
- search;
- selected count;
- load more for large catalogs.

An empty plan can be saved, but a run cannot be created from a plan with no active cases.

## Plan Details

The side panel shows metadata, selected suites, explicit cases, tags, counts, milestone, and actions: Create Run, Edit, Delete.

## Create a Run from a Test Plan

Create Run opens a form for run name, description, environment, milestone, build, assignee, and start mode.

The run receives active cases from selected suites, descendant suites, and explicit case IDs. Duplicates are removed while preserving order.

## Practices

- Use plans for repeated smoke, regression, and release acceptance scopes.
- Use direct runs for one-time exploratory or incident checks.
- Review plan scope before every major release.
- Keep plan tags stable and meaningful.
