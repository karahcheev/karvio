# Glossary

This glossary defines the product terms used in Karvio. API pages may also mention backend entity names when they differ from UI labels.

## Core Terms

| Term | Meaning |
| --- | --- |
| Project | Top-level security, data, and reporting boundary. Test cases, runs, plans, datasets, environments, and release scope records belong to a project. |
| Test suite | Folder-like grouping for test cases in the repository. |
| Test case | Reusable check that describes what should be verified. A case may be manual, structured with steps, or linked to automation. |
| Test plan | Reusable execution scope. A plan stores a selected set of cases and can create new test runs. |
| Test run | Concrete execution session for a project, build, environment, and milestone. |
| Run item | A test case inside a specific test run. API pages call this entity `run_case`. |
| Result | Status update recorded against a run item or dataset row, usually with comments, actual result, evidence, or defect links. |
| Dataset | Reusable parameter table that lets one test case cover multiple input combinations. |
| Run case row | Dataset-driven execution row inside a run item. |
| Environment | Project-level target configuration, such as staging, production EU, or Chrome on Windows. |
| Environment revision | Immutable environment snapshot captured for reproducible execution history. |
| Product | Business-level application, service, or product area used in Release Scope. |
| Component | Functional or technical area with ownership, dependencies, and risk metadata. |
| Milestone | Release, sprint, hotfix, or acceptance target used to group plans and runs. |
| Attachment | File uploaded to a test case, step, draft step, or run item. |
| Artifact | File or output produced by performance tests, generated reports, or automation imports. |

## UI and API Names

| UI term | API term | Notes |
| --- | --- | --- |
| Run item | `run_case` | The UI emphasizes execution work. The API uses the persisted entity name. |
| Run item row | `run_case_row` | Row-level result target created from dataset bindings. |
| Test suite | `suite` | Repository folder for test cases. |
| Environment revision | `environment_revision` | Versioned snapshot attached to a run. |
| Attachment | `attachment` | Uploaded file metadata and stored content. |

## Archive, Delete, and Remove

Karvio uses these words deliberately:

- **Archive** hides a resource from active workflows while preserving history.
- **Delete** permanently removes a resource or its metadata.
- **Remove** unlinks an item from a container without necessarily deleting the source record, such as removing a run item from a test run.

Prefer archive when historical traceability matters.
