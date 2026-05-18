# Component Coverage

Release Scope becomes useful when test cases are linked to products and components.

## Coverage Fields

The test case create and edit forms include component coverage:

| Field | Description |
| --- | --- |
| `Primary Product` | Main product tested by the case. |
| `Component` | Component covered by the case. Multiple coverage rows are allowed. |
| `Strength` | `smoke`, `regression`, or `deep`. |
| `Mandatory` | Marks the case as required for release coverage. |

## Coverage Strength

| Strength | Meaning |
| --- | --- |
| `Smoke` | Fast sanity check. |
| `Regression` | Standard regression check. |
| `Deep` | More exhaustive or edge-case coverage. |

Mandatory cases appear in product summaries and generated plans. A mandatory release case receives the `mandatory_release` reason code when a plan is generated.

## Practices

- Link cases to the components they actually validate.
- Use `deep` only when the case provides meaningful depth.
- Mark mandatory cases sparingly.
- Review high-risk components for missing or weak coverage before release.
