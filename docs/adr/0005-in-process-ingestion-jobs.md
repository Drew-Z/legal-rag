# ADR 0005: Use in-process ingestion jobs before external queues

## Status

Accepted

## Context

Document ingestion can become slow when parsing large files, generating real embeddings, or writing many chunks to pgvector. The original request path imported documents synchronously, which kept the MVP simple but made progress reporting, retries, and future batch uploads harder.

## Decision

Introduce an ingestion job interface and an in-process job queue adapter. The Web app uses the asynchronous job endpoints for text import, file upload, and public-safe dataset seeding. Existing synchronous endpoints remain available for compatibility with validation scripts and simple API examples.

## Consequences

- The UI can show queued/running/succeeded/failed ingestion states and progress.
- The current hosted demo avoids adding Redis or BullMQ operational cost.
- Future work can replace the in-process adapter with BullMQ or another durable queue without changing the frontend job interface.
- In-process jobs are not durable across API restarts, so large production batch ingestion still needs an external queue.
