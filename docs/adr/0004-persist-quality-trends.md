# ADR 0004: Persist quality trends from quality reports

## Status

Accepted

## Context

The quality panel originally computed RAG and contract-review evaluation results on demand. This proved current behavior but did not show whether project changes improved or degraded retrieval and review quality over time.

## Decision

Record each generated quality report as an evaluation run. Local memory mode stores recent runs in process. Hosted pgvector mode stores runs in PostgreSQL `evaluation_runs` and exposes them through `GET /api/quality/trends`.

## Consequences

- The hosted demo can show a quality trend without requiring a separate analytics service.
- The trend table stores aggregate metrics, not raw prompts, model keys, login credentials, or document text.
- Future work can turn these records into release comparisons, charts, and CI-published evaluation reports.

