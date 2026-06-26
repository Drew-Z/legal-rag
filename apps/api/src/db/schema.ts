export function createPgVectorSchemaSql(dimensions: number): string {
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new Error("Embedding dimensions must be a positive integer");
  }

  return `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id text PRIMARY KEY,
  title text NOT NULL,
  source_type text NOT NULL,
  original_name text,
  created_at timestamptz NOT NULL,
  chunk_count integer NOT NULL,
  content_hash text UNIQUE,
  doc_type text,
  source_url text,
  source_label text
);

CREATE TABLE IF NOT EXISTS chunks (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  chunk_index integer NOT NULL,
  page integer NOT NULL,
  section text NOT NULL,
  token_estimate integer NOT NULL,
  metadata jsonb NOT NULL,
  embedding vector(${dimensions}) NOT NULL
);

CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks(document_id);
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS chunks_keyword_idx ON chunks USING gin (to_tsvector('simple', title || ' ' || section || ' ' || content));
`;
}
