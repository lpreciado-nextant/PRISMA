# ADR-0004 — Assets in Dataverse File/Image columns

**Status:** Accepted
**Date:** 2026-09-16

## Context

Demo assets include self-contained HTML files, videos, one-pagers, and screenshots. External blob storage or separate hosting would mean more infrastructure, another security boundary, and link rot.

## Decision

All uploaded assets live in Dataverse File and Image columns. No external blob storage, no separate hosting to provision.

## Consequences

- The payload travels with the record — this is what makes self-contained HTML demos viable and keeps record visibility and asset visibility in one security model.
- Detail-page screenshots get a child table (`nx_solutionimage`) since a record needs a captioned gallery beyond the single `Thumbnail` image column.
- File-size limits and storage costs follow Dataverse constraints; large videos may need review.
- Hosted web apps and Power Apps/Power BI assets remain URLs (deep-link or embed), not uploads.
