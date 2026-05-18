# Dataset Scenarios and Practices

This page shows common dataset workflows and maintenance rules.

## One Checkout Test for Many Payments

A test case describes checkout flow once. The dataset stores cards, currencies, and expected provider statuses. Manual and automated runs can use the same row keys.

## Regional Difference Control

`Tax calculation by market` stores country, VAT rate, rounding mode, and expected total. When tax logic changes for one market, the team updates one row and sees which cases use it.

## Safe Data Changes Before a Release

Before release, a QA lead can pin a case to a dataset revision through the API so late dataset edits do not change an agreed release run. After release, the binding can return to `follow_latest`.

## Manual and Automation Alignment

Automation imports CSV/JSON from pytest parameters, and manual testers link the same dataset to a manual case. Both workflows use the same scenario keys.

## Practices

- Keep `row_key` stable and readable, such as `visa_eur_success`.
- Do not use a dataset as a requirements document; keep it to parameters and expected values.
- Limit columns to fields used by the case.
- Fill `source_ref` when data comes from automation, CSV, or another system.
- Use `pin_revision` for release-critical reproducibility.
- Use `follow_latest` for active regression data that should pick up new rows.
