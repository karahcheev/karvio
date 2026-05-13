# JUnit XML Import

Karvio can import test results from JUnit XML files produced by automated test frameworks (pytest, JUnit, TestNG, NUnit, Jest, and others). This lets you combine automated and manual test results in a single place.

Use JUnit XML import when CI already runs automated checks and you want the results to appear in the same run, milestone, dashboard, and history as manual testing.

!!! screenshot "SCREENSHOT TODO: JUnit import entry point"
    Add a screenshot of the Import Results action from a test run.

---

## Supported Format

Karvio expects standard JUnit XML format:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="Login Tests" tests="3" failures="1" errors="0" time="1.234">
    <testcase name="Valid login redirects to dashboard" classname="test_login" time="0.412">
    </testcase>
    <testcase name="Invalid password shows error" classname="test_login" time="0.389">
      <failure message="AssertionError">Expected error message, got 200 OK</failure>
    </testcase>
    <testcase name="Locked account shows message" classname="test_login" time="0.433">
    </testcase>
  </testsuite>
</testsuites>
```

Test cases in the XML are matched to existing Karvio test cases by **name**. If no match is found, the import can optionally create new test cases automatically.

---

## Import into a Test Run

### From the Run Page

1. Open the target test run.
2. Click **Import Results** in the toolbar.
3. Select your JUnit XML file.
4. Configure the import options (see below).
5. Click **Import**.

!!! screenshot "SCREENSHOT TODO: Import JUnit XML dialog"
    Add a screenshot of the upload dialog with file selection and import options.

### From the Project Level

You can also import results at the project level, creating a new run automatically:

1. Go to **Test Runs**.
2. Click **Import from JUnit XML**.
3. Follow the same steps as above.

---

## Import Options

| Option | Description |
|--------|-------------|
| **Create Missing Test Cases** | If enabled, test cases from the XML that have no matching Karvio case are created automatically and added to the run |
| **Default Suite** | When creating missing cases, place them in this suite |
| **Dry Run** | Preview the import result without saving anything |

---

## Dry Run (Preflight)

Use the **Dry Run** option before committing an import to verify:

- How many test cases matched existing Karvio cases
- How many test cases would be created (if "Create Missing" is enabled)
- Any parse errors or unexpected values in the XML

Dry run output shows a summary table. Fix any issues in the XML file or adjust the import options before running the real import.

!!! screenshot "SCREENSHOT TODO: JUnit dry run summary"
    Add a screenshot showing matched cases, cases to create, skipped results, and parse warnings.

---

## Result Mapping

JUnit XML results are mapped to Karvio statuses as follows:

| JUnit Result | Karvio Status |
|--------------|---------------|
| *(no failure/error element)* | **Passed** |
| `<failure>` | **Failed** |
| `<error>` | **Failed** |
| `<skipped>` | **Not Applicable** |

The failure or error message from the XML is added as a comment on the run item.

---

## Matching Recommendations

| Recommendation | Why it helps |
|----------------|--------------|
| Keep automated test names stable | Karvio matches imported results by name. Renaming tests can create missing matches. |
| Use descriptive test names | The imported result should be useful to manual testers and release reviewers. |
| Run dry run in CI validation first | Catch malformed XML and unexpected case creation before modifying a run. |
| Decide where missing cases should go | Configure the default suite before enabling automatic creation. |
| Import into a build-specific run | Keeps automation evidence tied to the correct release candidate. |

---

## Frequently Asked Questions

**Can I import multiple XML files into one run?**
Each import operation processes one file. To import results from multiple files, run the import action multiple times against the same run. Results are merged – previously imported items are updated if the test case names match.

**What happens if a test case name appears more than once in the XML?**
Karvio uses the last occurrence of a duplicate name. If your framework generates duplicate names (e.g., parameterized tests), consider enabling "Create Missing Test Cases" so each variant gets its own case.

**Does the import support attachments?**
JUnit XML itself does not carry attachments. Upload attachments manually to individual run items after importing.
