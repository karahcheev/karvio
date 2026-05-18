# Test Datasets

Test Datasets are reusable parameter tables for manual and automated test cases. A dataset separates test logic from input data so one test case can cover many scenarios, while revisions preserve changes over time.

![Datasets list](<../../images/Datasets List.png>)

## What Datasets Solve

Use datasets when one scenario needs multiple input combinations:

- user roles and permissions;
- currencies, countries, and tax profiles;
- payment card types and 3DS outcomes;
- product SKUs and discount rules;
- feature flags and configuration variants;
- imported parameters from pytest or external CSV/JSON files.

Instead of keeping 20 nearly identical test cases, the team keeps one scenario and 20 data rows.

## Core Concepts

| Concept | Description |
| --- | --- |
| Dataset | Project-scoped set of columns and rows. |
| Source Type | Origin of the data: `Manual`, `Pytest Parametrize`, or `Imported`. |
| Source Ref | Link to a file, test, fixture, document, or external reference. |
| Column | Data field such as `country`, `currency`, or `coupon_code`. |
| Row | Concrete scenario such as `bg_eur_valid_coupon`. |
| Revision | Version of the dataset structure and rows. |
| Binding | Link between a dataset and a test case. |

## Subsections

- [Dataset Registry](registry.md)
- [Create and Edit Datasets](create-and-edit.md)
- [Bindings and Revisions](bindings-revisions.md)
- [Permissions and API](permissions-api.md)
- [Scenarios and Practices](scenarios-practices.md)
