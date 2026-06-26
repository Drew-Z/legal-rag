# ADR 0007: Add configured users and project authorization

## Status

Accepted

## Context

The hosted demo originally used one configured login to protect model keys, upload endpoints, and database resources. The project now supports multiple project spaces, audit logs, async ingestion jobs, and contract review. These features need user-aware project access without introducing a full SaaS identity provider.

## Decision

Keep the existing `AUTH_EMAIL` / `AUTH_PASSWORD` path for simple demos, and add `AUTH_USERS_JSON` for multiple configured users. Project spaces now have an owner and project members. The default project remains visible to all authenticated users for demo compatibility. New projects are owned by the creating user and are only listed or accessible to project members.

## Consequences

- Existing single-user deployments keep working.
- The hosted demo can be configured with multiple accounts without adding an external auth provider.
- Project-space authorization is enforced before documents, ingestion jobs, RAG queries, review, and audit-log access.
- Future work can replace configured users with a database-backed user table or external identity provider while keeping project membership semantics.
