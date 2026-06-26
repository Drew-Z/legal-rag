# ADR 0002: Keep model providers and vector stores behind adapters

## Status

Accepted

## Context

The project must run locally without secrets while also supporting a realistic hosted RAG deployment with real embeddings and persistent vectors.

## Decision

Keep embeddings, chat generation, and vector storage behind provider/vector-store adapters. Local demos use mock embeddings and memory storage. Hosted demos use OpenAI-compatible providers and pgvector.

## Consequences

- Tests and validation can run without model keys.
- The same ingestion and RAG modules can run against memory or pgvector.
- Switching providers is mostly configuration-driven.
- Adapter seams should stay real: each seam has at least two adapters or a clear hosted/local reason to exist.

