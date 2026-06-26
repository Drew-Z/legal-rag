# ADR 0006: Keep contract review rule-first with optional model explanation

## Status

Accepted

## Context

Contract review needs stable, explainable, citation-backed results. A pure LLM review can produce richer language, but it can also add unsupported risks, drift from the expected schema, or make deterministic evaluation noisy.

## Decision

Use deterministic rules as the recall layer for contract risks. When a chat model is configured, ask the model only to improve the explanation and suggestion for already recalled risks. The model output must be JSON and pass schema validation before it can replace rule text. If the model is unavailable or invalid, return the rule-based review result as a fallback.

## Consequences

- Contract-review evaluation remains deterministic because recall still comes from rules.
- The hosted demo can show model-assisted review language when the model responds correctly.
- Citations, risk levels, and human-review flags stay grounded in the rule result.
- Future work can add richer schemas, cost tracking, and per-risk confidence without changing the frontend response shape.
