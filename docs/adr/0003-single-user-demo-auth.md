# ADR 0003: Use single-user auth for the hosted demo

## Status

Accepted

## Context

The public demo needs to protect model keys, upload endpoints, and database resources. Full multi-user authorization would add product and schema complexity that is not yet central to the demo.

## Decision

Use a single-user login gate backed by an HTTP-only signed cookie. Keep local auth disabled by default.

## Consequences

- Hosted demo access is protected without introducing user tables yet.
- Cross-origin Render deployment requires `AUTH_COOKIE_SECURE=true` and `AUTH_COOKIE_SAME_SITE=None`.
- Future multi-user work should replace this with user identity, project-space authorization, and audit logging rather than extending the single-user mechanism too far.

