# Architecture

Legal RAG is a small monorepo that demonstrates a complete legal-document RAG loop without requiring a live model key.

```mermaid
flowchart LR
  Web["Vue Web App"] --> API["Express API"]
  API --> Upload["upload: TXT/PDF/DOCX parsers"]
  API --> Dataset["public-safe dataset seed"]
  Upload --> Documents["documents: clean and store"]
  Dataset --> Documents
  Documents --> Hash["hash: duplicate detection"]
  Hash --> Chunks["chunks: section-aware splitter"]
  Chunks --> Embeddings["embeddings: provider adapter"]
  Embeddings --> VectorStore["vector store: memory or pgvector"]
  VectorStore --> Rewrite["query rewrite"]
  Rewrite --> Hybrid["hybrid recall: vector + keyword"]
  Hybrid --> Rerank["threshold filter + rerank"]
  Rerank --> Rag["rag: grounded answer"]
  Chunks --> Review["review: rule-guided risk report"]
  Rag --> Citations["citations: source quotes"]
  Review --> Citations
```

## Runtime

- `apps/web`: Vue 3 + TypeScript + Vite UI.
- `apps/api`: Express + TypeScript API.
- `packages/shared`: shared request and response types.
- `samples/sample-contract.txt`: demo contract used for local validation.
- `datasets/public-safe/legal-public-dataset.jsonl`: public-safe legal snippets and synthetic contract samples.
- `eval/rag-eval-set.json`: citation and refusal evaluation cases.
- `VECTOR_STORE=pgvector`: persists documents, chunks, metadata, and embeddings in PostgreSQL + pgvector.

## RAG Flow

1. The user imports text through `POST /api/documents/import-text`, uploads TXT/PDF/DOCX through `POST /api/documents/upload`, or seeds the public-safe dataset through `POST /api/datasets/seed`.
2. The API computes a SHA-256 content hash and returns the existing document when the same text is imported again.
3. The API cleans text, enriches source metadata, splits it into section-aware chunks, and estimates token count.
4. `MockEmbeddingProvider` creates deterministic local embeddings when no API key is available; `OpenAICompatibleEmbeddingProvider` can call a real embedding model such as `Qwen3-Embedding-0.6B`.
5. `MemoryVectorStore` stores chunks and vectors in process memory; `PgVectorStore` persists chunk embeddings in PostgreSQL + pgvector.
6. `POST /api/rag/query` rewrites short contextual questions, embeds the rewritten question, recalls top 20 candidates from both vector and keyword search, filters weak candidates, reranks down to top 5, generates a grounded answer, and returns citations plus diagnostics.
7. When the query is outside the current legal/contract corpus or retrieval evidence is too weak, the RAG service refuses with a "current materials cannot confirm" answer and no citations.

## Contract Review Flow

The MVP review service uses deterministic legal-risk rules. This keeps the demo stable and auditable:

- Payment terms: detects single final payment or unclear payment milestones.
- Delivery: detects vague acceptance standards.
- Breach liability: detects high liquidated damages and uncapped losses.
- IP: detects overly broad ownership and reuse restrictions.
- Dispute resolution: detects one-sided venue clauses.

The service returns both structured JSON and readable Markdown.

## Extension Points

- Switch between mock/memory and OpenAI-compatible/pgvector with environment variables.
- Move document processing to BullMQ when ingestion becomes asynchronous.
- Replace the current lightweight rerank with a cross-encoder or model reranker.
- Add OCR and table-aware parsing for scanned or complex contracts.
- Expand the eval suite to track citation hit rate, refusal accuracy, and risk-review recall.
