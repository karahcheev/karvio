# Release Scope Scenarios

This page shows practical release scope workflows.

## Prepare Regression Scope for a Release

1. Create milestone `Release 2.4`.
2. Confirm the product contains all release components.
3. Review product summary for high-risk uncovered areas.
4. Open Preview Plan from product details.
5. Review included cases and reason codes.
6. Create the generated plan.
7. Link the plan to the milestone.
8. Create a run for the target environment and build.

Result: regression scope is assembled faster and every included case has a reason.

## Focus on High-Risk Components

Filter Components by `critical` and `high`, open details, review risk context, and check whether test cases provide `regression` or `deep` coverage. Add or update cases where coverage is weak.

## Manage Acceptance by Milestone

Create a milestone with target date and release label, link plans and runs, then monitor total tests, pass rate, failed, blocked, and untested counts.

## Create a Run for a New Build

Open Test Plans, find the relevant plan by tag or milestone, click Create Run, set build/environment/assignee/start mode, and begin execution.

## Release Scope Quality Practices

- Create components by risk area, not tiny UI fragments.
- Use `critical` and `high` only where failure affects release decisions.
- Maintain component coverage on test cases.
- Mark only truly required release cases as mandatory.
- Store repeated scope in test plans.
- Create milestones for releases, sprints, and hotfixes that need readiness review.
- Check high-risk uncovered, blocked, failed, untested, and overdue items before release.
