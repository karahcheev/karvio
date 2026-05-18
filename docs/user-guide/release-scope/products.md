# Products

A Product represents an application, service, platform, or major product area that the team tests for release readiness. Examples include `Web App`, `Mobile App`, `Billing Service`, and `Admin Portal`.

## Why Products Matter

Products help teams:

- group components in business context;
- see coverage gaps;
- find high-risk uncovered areas;
- generate a test plan from product scope;
- separate active products from archived ones.

## Product List

The Products tab supports search, status filter, column visibility, server-side pagination, details side panel, create, edit, archive/activate, and delete after confirmation.

## Columns

| Column | Meaning |
| --- | --- |
| `Name` | Product name and description. |
| `Status` | `active` or `archived`. |
| `Owner` | Owner when set through the API. |
| `Tags` | Labels when set through the API. |
| `Components` | Number of linked components. |
| `Covered` | Adequately covered components. |
| `Uncovered` | Components without coverage. |
| `High-Risk Uncovered` | High or critical risk components without coverage. |
| `Mandatory Cases` | Required release cases. |
| `Updated` | Last update time. |

## Create a Product

The create form includes product name, key, and description. If key is empty, Karvio generates one automatically. New products start as `active`.

## Edit Product and Component Links

The edit form allows changing name, key, description, and release-scope components. Components are selected from the project component list and define which technical areas belong to the product scope.

## Product Details

The side panel supports Preview Plan, Edit, Archive/Activate, Delete, overview metadata, coverage gaps, linked components, and generated plan preview.

## Coverage Gaps

Coverage gap metrics help identify uncovered components, high-risk uncovered components, insufficient coverage score, and mandatory release cases.

## Preview Plan

Preview Plan generates a candidate test plan from product scope. The preview shows resolved components, included and excluded cases, reason codes, highest risk, and a Create Plan action.
