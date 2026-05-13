# Environment Details

Clicking an environment opens the details side panel.

!!! screenshot "SCREENSHOT TODO: Environment Details Side Panel"
    Add a screenshot with Overview, Topology, Revisions, and Advanced sections.

## Overview

Overview shows name, status, kind, description, use cases, tags, current revision, topology summary, infra summary, regions, graph summary, and updated timestamp.

## Topology

Topology groups components by:

- Load Generators;
- System Under Test;
- Supporting Services.

Each component shows name, type, node count, endpoint count, endpoints, tags, and node cards with host type, provider, region, endpoint, count, and tags.

## Revisions

Revisions show revision number, current marker, creation timestamp, entity count, edge count, revision note, snapshot hash, and selected topology snapshot JSON.

Example: regression fails on `staging-eu r5` but passed on `r4`. The engineer opens revisions and sees a changed payment sandbox endpoint.

## Advanced

Advanced shows raw topology, meta, and extra JSON for integrations, debugging, and API comparison.

## Edit and Archive

The details panel supports `Edit` and `Archive`. Row actions provide the same controls, and bulk archive is available from selected rows.

Archive is not a hard delete. The backend fills `archived_at`, and list endpoints hide archived environments by default unless `include_archived=true` is used.

## Link to Test Runs

Test runs can store environment and environment revision. Test case history then shows environment name, revision number, build, run status, and result status.

This helps separate product defects from topology or configuration drift.
