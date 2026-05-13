# Test Suites

Test Suites are the folder tree inside the Test Cases repository. Suites keep cases organized by stable functional areas, test types, or long-lived ownership boundaries.

A suite is not a test plan and does not record execution scope by itself. It organizes the case catalog; test plans and test runs use those cases as reusable or one-time scope.

![Test suites tree](<../../images/Test Suites.png>)

## Suite Tree

The suite tree is shown on the left side of the Test Cases screen. Users can:

- open `All tests` to see every case in the project;
- select a suite to scope the table to that branch;
- expand and collapse nested suites;
- create a suite, including a child suite;
- delete a suite when their role and project state allow it.

Example: a QA lead creates `Checkout`, `Payments`, `Refunds`, and `Fraud Checks`. During release preparation, they select `Payments` and quickly review which cases are still in `Draft`, which are active, and who owns them.

## Choosing a Structure

Build suites around stable product language:

- functional areas: `Checkout`, `Account Settings`, `Notifications`;
- API domains: `Payments API`, `Webhooks`, `Authentication API`;
- platform areas: `Mobile`, `Accessibility`, `Cross-Browser`;
- durable testing groups: `Smoke`, `Regression`.

Avoid using suites for temporary release labels. Tags, milestones, test plans, and run metadata are better for short-lived grouping.

## Working with Cases in a Suite

When a suite is selected before creating a case, the new test case is created inside that suite. Existing cases can be moved through the edit form or bulk edit.

Selecting a suite only changes the table view. It does not rewrite a test plan or an existing test run.

## Practices

- Keep the tree shallow enough that testers do not need to expand many levels.
- Name suites with product terminology that the team already uses.
- Use child suites only when the parent helps navigation.
- Check whether cases are still needed before deleting a suite.
- Use tags and test plans for release-specific grouping instead of temporary suites.
