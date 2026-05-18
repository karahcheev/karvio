# Environment Registry

The registry lists project environments with server-side pagination.

## Available Actions

Users can:

- search by name or description;
- filter by use case;
- configure visible columns;
- open the details side panel;
- create an environment;
- edit an environment;
- archive an environment;
- select multiple environments and bulk archive them.

## Table Columns

| Column | Shows |
| --- | --- |
| `Name` | Name plus description or id. |
| `Status` | Active, Maintenance, or Deprecated. |
| `Use Cases` | Environment use-case labels. |
| `Topology` | Component and node counts. |
| `Infra` | Host types and providers. |
| `Revision` | Current revision, such as `r4`. |
| `Updated` | Last update time. |

Example: a performance engineer filters by `performance`, sorts by updated date, and selects the environment with the current revision before a load test.
