# Legal RAG Context

This repository is a single-context project for a legal-document RAG demo and contract-risk review workbench.

## Domain Terms

- **Project Space**: A workspace that scopes documents, duplicate detection, retrieval, Q&A, and contract review. The default project keeps local demos simple.
- **Legal Document**: A user-imported text, uploaded file, public-safe dataset entry, or sample contract stored with source metadata and a content hash.
- **Ingestion Job**: A project-scoped asynchronous task for text import, file upload, or public-safe dataset seeding. It records status, progress, result, and errors.
- **Chunk**: A section-aware text fragment with source metadata, page, section, chunk index, token estimate, and an embedding.
- **Citation**: The traceable source evidence returned with RAG answers and contract-review risks.
- **RAG Answer**: A grounded answer generated from retrieved chunks. It includes citations, retrieved chunks, rewritten question, and diagnostics.
- **Diagnostics**: Retrieval and answer-source metadata shown in the UI, including vector candidates, keyword candidates, filtered candidates, reranked candidates, and answer source.
- **Contract Risk**: A structured review finding with clause, risk level, issue, suggestion, citation, and human-review flag.
- **Quality Report**: Runtime and evaluation summary shown in the quality panel: model provider, vector store, corpus size, RAG evaluation, contract-review evaluation, and readiness checks.
- **Evaluation Run**: A persisted quality report snapshot used to compare RAG and contract-review metrics over time.
- **Audit Log**: A persisted project-space event recording the acting user, action, target, summary, and timestamp for sensitive operations.

## Runtime Modes

- **Local demo mode**: Uses mock embeddings and in-memory vector search so the project runs without model keys or a database.
- **Hosted demo mode**: Uses Render for Web/API, Supabase PostgreSQL + pgvector for persistence, OpenAI-compatible generation, and Qwen3-Embedding-0.6B embeddings.

## Design Constraints

- Legal answers must be citation-grounded or refuse when current materials are insufficient.
- Uploaded or seeded documents must be scoped to a project space.
- Ingestion jobs should expose progress without storing raw document text in job records.
- Project-space mutations and AI actions should record audit logs so future multi-user authorization can be reviewed.
- Model keys, database credentials, and demo login credentials must never be committed.
- Hosted auth is intentionally single-user until multi-user authorization is designed.
