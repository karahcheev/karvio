# Dataset Registry

The Datasets page lists all datasets in a project with server-side pagination.

## Available Actions

Users can:

- search by dataset name or description;
- filter by `Source Type`;
- open details from a row;
- create a dataset;
- edit a dataset with the `tester` role;
- delete a dataset with the `lead` role;
- select multiple rows and run bulk delete.

## Table Columns

The table shows:

- `Name` with description and id;
- `Source`;
- `Linked Cases`;
- `Updated`.

## Source Types

| Source Type | Use When |
| --- | --- |
| `manual` | Data is maintained manually in the UI. |
| `pytest_parametrize` | Data mirrors automated test parameters or pytest fixtures. |
| `imported` | Data came from CSV, JSON, or another external source. |

Example: an automation engineer imports pytest parameters, and a manual tester uses the same dataset in a manual case to align terminology and expected values.
