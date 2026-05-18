# Environment Scenarios and Practices

This page covers common environment workflows.

## Investigate a Failure on One Target

A case fails on `staging-eu` and passes on `staging-us`. The tester opens result history, checks environment revision, then reviews topology and supporting services to find the difference.

## Performance Run with Load Generators

A performance engineer creates `perf-k8s-us-east`, adds the API as System Under Test, Kafka/Postgres as Supporting Services, and k6 workers as Load Generators. Results can then be interpreted against generator count and resources.

## Control Infrastructure Changes Before Release

A release manager checks that regression ran on an active environment with the expected revision. Runs on maintenance or deprecated targets can be excluded from release evidence.

## Move to a New Target Version

DevOps adds a new cache layer. The environment receives a new revision, and QA compares results before and after the topology change without mixing evidence.

## Practices

- Use clear names such as `staging-eu-payments`, `perf-us-east-k8s`, or `prod-like-bg`.
- Fill use cases because they become filters for QA and performance teams.
- Add important dependencies as Supporting Services instead of hiding them in description.
- Record provider and region when failures may depend on latency or routing.
- Describe Load Generators and resources for performance targets.
- Archive old environments instead of reusing the same name for a different topology.
