# Performance Testing

Karvio lets you store, track, and compare results from performance and load tests alongside your functional test data. Upload artifacts from tools such as JMeter or LoadRunner, record a verdict, and compare metrics across runs over time.

Performance runs are useful for release gates, regression detection, and preserving the raw evidence behind performance decisions.

!!! screenshot "SCREENSHOT TODO: Performance runs list"
    Add a screenshot of the Performance page with status, verdict, load kind, environment, and filters.

---

## Performance Run List

The **Performance** page lists all performance runs in the current project. Each row shows:

- **Name** – the run name
- **Status** – Pending / Running / Completed / Failed
- **Verdict** – Pass / Fail / Inconclusive
- **Load Kind** – the type of test executed
- **Environment** – the target environment
- **Start Date** – when the test ran

### Filtering

Filter by:

- **Status** – Pending / Running / Completed / Failed
- **Verdict** – Pass / Fail / Inconclusive
- **Load Kind** – Smoke / Load / Stress / Endurance / Spike
- **Environment** – a specific environment

### Sorting

Sort by: created date, start date, name, status, verdict, load kind, or environment.

---

## Load Kind Reference

| Load Kind | Description |
|-----------|-------------|
| **Smoke** | A brief low-load test to verify the system is functional |
| **Load** | A sustained test at expected production load |
| **Stress** | A test that pushes the system beyond expected limits |
| **Endurance** | A long-duration test to detect memory leaks and degradation |
| **Spike** | A sudden large increase in load to test recovery |

---

## Create a Performance Run

1. Click **New Performance Run**.
2. Fill in the run details:

| Field | Description |
|-------|-------------|
| **Name** | A descriptive name, e.g., `Checkout – Load Test v2.4` |
| **Status** | Initial status – typically **Pending** |
| **Verdict** | Set after reviewing results: Pass / Fail / Inconclusive |
| **Load Kind** | The type of load test |
| **Environment** | The environment that was tested |
| **Start Date** | When the test began |
| **Description** | Notes about the test setup or goals |

3. Click **Create**.

!!! screenshot "SCREENSHOT TODO: Create performance run form"
    Add a screenshot of a performance run form with environment, load kind, verdict, and dates.

---

## Upload Performance Artifacts

Artifacts are the output files from your load testing tool (JMeter `.jtl` or `.csv`, LoadRunner `.lrr`, Gatling reports, etc.).

### Upload a File

1. Open the performance run.
2. Go to the **Artifacts** tab.
3. Click **Upload Artifact**.
4. Select the file from your computer.
5. Click **Upload**.

### Preflight Validation (Dry Run)

Before fully importing an artifact, you can validate it:

1. On the upload dialog, enable **Dry Run**.
2. Click **Upload**.

Karvio parses the file and reports any errors or warnings without saving data. Fix any issues and re-upload.

!!! screenshot "SCREENSHOT TODO: Performance artifact dry run"
    Add a screenshot of artifact upload validation with warnings or a successful parse summary.

### Import

After a successful preflight, click **Import** to process the artifact. Large files are processed asynchronously – a progress indicator shows the import status.

!!! screenshot "SCREENSHOT TODO: Performance artifact import progress"
    Add a screenshot of a processing or completed import state.

### Download

Click the file name in the artifact list to download a copy of the original file.

---

## Run Overview and Metrics

Open a performance run to see the **Overview** tab with:

- Run metadata (environment, dates, verdict)
- Key metric summaries from imported artifacts (response times, throughput, error rates)

!!! screenshot "SCREENSHOT TODO: Performance run overview metrics"
    Add a screenshot of imported metric summaries and verdict.

---

## Environment Details

The **Environment** tab on a performance run shows the configuration of the linked environment at the time the test was executed.

---

## Compare Runs

To compare metrics across multiple runs:

1. On the Performance list page, select two or more runs with the checkboxes.
2. Click **Compare**.

The comparison view shows metrics side by side for the selected runs.

!!! screenshot "SCREENSHOT TODO: Performance run comparison"
    Add a screenshot comparing two or more performance runs.

---

## Verdict Guidance

| Verdict | Use when |
|---------|----------|
| **Pass** | Metrics meet agreed thresholds and no blocking performance issue is observed. |
| **Fail** | One or more critical thresholds are breached or the run exposes unacceptable degradation. |
| **Inconclusive** | The run is invalid, incomplete, noisy, or lacks enough evidence for a release decision. |

Document the reason for Fail or Inconclusive in the run description or comments so later reviewers understand the decision.

---

## Archive a Performance Run

1. Open the run.
2. Click **Archive** in the toolbar.

Archived runs are hidden from default filters but remain accessible for historical comparison.

---

## Delete a Performance Run

!!! warning
    Deleting a performance run permanently removes the run record and all uploaded artifacts.

1. In the run list, open the context menu (…).
2. Click **Delete**.
3. Confirm the deletion.
