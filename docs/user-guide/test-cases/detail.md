# Test Case Detail

The test case detail page provides the main editing and review surface for a single case.

![Test case detail](<../../images/Test Case Detail.png>)

## Header Actions

In view mode, users can:

- `Edit` the case;
- `Actions -> Clone Test Case`;
- `Actions -> AI Review` when AI is enabled;
- `Actions -> Archive`;
- `Actions -> Delete`.

In edit mode, users can:

- upload a case-level attachment;
- save changes;
- cancel editing.

## Details Tab

The Details tab shows and edits:

- title;
- template type;
- automation ID;
- status;
- type and priority;
- expected time;
- tags;
- owner;
- suite;
- product and component coverage;
- preconditions;
- text steps and expected result for text cases;
- structured steps for step-based cases;
- raw automated test content for automated cases.

The backend validates the template contract. Text cases cannot submit `raw_test`; step cases keep steps as separate records; automated cases require `raw_test` and do not accept an expected-result field.

## AI Review

AI review analyzes an existing case and suggests improvements. Users can apply individual fields instead of accepting the whole result.

Example: a QA lead opens an old critical case before a release and sees that preconditions do not specify test data and the expected result is too broad.

## Attachments Tab

Attachments are used for:

- images in preconditions, steps, and expected results;
- durable reference files;
- downloads from the case;
- cleanup when the user has permission.

Step attachments are shown separately from case-level attachments, but the tab count includes both.

## Datasets Tab

The Datasets tab shows parameter sets linked to the case. Users can:

- link an existing dataset;
- create and link a new dataset;
- view dataset details;
- edit a linked dataset;
- unlink a dataset from the case;
- delete the dataset from the project if they have the lead role;
- preview the first rows of the current revision.

The UI creates bindings in `follow_latest` mode and selects all rows. The API supports `pin_revision` and row subsets.

![Test case datasets tab](<../../images/Test Case Datasets Tab.png>)

## Results History Tab

Results History shows recent executions of this case:

- result status;
- test run status;
- run name and `Open run` link;
- environment and environment revision;
- build;
- suite;
- execution time;
- comment;
- lazy-loaded result details.

Expanded details include execution timestamp, duration, executor, assignee, actual result, stdout, stderr, defect IDs, status-change history, and downloadable artifacts.

![Results history](<../../images/Results History.png>)

## Defects Tab

The Defects tab shows linked external issues. When Jira is configured, users can link or unlink issues so the test documentation and bug tracker stay connected.

## Clone Test Case

Clone creates a new draft from an existing case. The wizard allows changes to:

- title;
- type;
- priority;
- owner;
- suite;
- expected time;
- tags.

Fields, steps, and attachments are copied. After creation, the user lands on the new case.
