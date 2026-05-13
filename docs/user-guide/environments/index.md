# Environments

Environments are versioned infrastructure profiles for functional, regression, and performance runs. An environment records where a test was executed: components under test, supporting services, load generators, region, provider, and revision.

!!! screenshot "SCREENSHOT TODO: Environment Registry"
    Add a screenshot of the registry with search, Use Cases filter, topology/infra/revision columns, and row actions.

## What Environments Solve

Environments help teams answer:

- which target was used for a test run;
- which topology version was active;
- which hosts, containers, cloud services, or Kubernetes workloads participated;
- which region and provider were involved;
- whether infrastructure changed between passing and failing runs;
- which environments are suitable for functional, performance, or custom use cases.

## Core Concepts

| Concept | Description |
| --- | --- |
| Environment | Named project infrastructure profile. |
| Kind | Profile type: `custom`, `functional`, or `performance`. |
| Status | Current state: `active`, `maintenance`, or `deprecated`. |
| Use Cases | Labels such as `functional`, `performance`, `regression`, or `release`. |
| Topology | Components and nodes that make up the target. |
| Placement | `System Under Test`, `Supporting Services`, or `Load Generators`. |
| Host / Node | VM, container, Kubernetes workload, or cloud service. |
| Revision | Immutable environment snapshot after create or update. |

## Subsections

- [Environment Registry](registry.md)
- [Create Environment](create.md)
- [Environment Details](details.md)
- [Permissions and API](permissions-api.md)
- [Scenarios and Practices](scenarios-practices.md)
