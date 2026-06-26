export function createPgVectorSchemaSql(dimensions: number): string {
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new Error("Embedding dimensions must be a positive integer");
  }

  return `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL,
  is_default boolean NOT NULL DEFAULT false
);

INSERT INTO projects (id, name, description, created_at, is_default)
VALUES ('project_default', '默认项目', '演示与本地导入文档', '2026-06-26T00:00:00.000Z', true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS documents (
  id text PRIMARY KEY,
  project_id text NOT NULL DEFAULT 'project_default' REFERENCES projects(id),
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

ALTER TABLE documents ADD COLUMN IF NOT EXISTS project_id text NOT NULL DEFAULT 'project_default';
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_content_hash_key;

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

UPDATE chunks
SET metadata = jsonb_set(metadata, '{projectId}', to_jsonb('project_default'::text), true)
WHERE metadata->>'projectId' IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS documents_project_content_hash_idx
  ON documents(project_id, content_hash)
  WHERE content_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS documents_project_id_idx ON documents(project_id);
CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks(document_id);
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS chunks_keyword_idx ON chunks USING gin (to_tsvector('simple', title || ' ' || section || ' ' || content));

CREATE TABLE IF NOT EXISTS evaluation_runs (
  id text PRIMARY KEY,
  generated_at timestamptz NOT NULL,
  model_provider text NOT NULL,
  vector_store text NOT NULL,
  embedding_model text NOT NULL,
  chat_model text,
  document_count integer NOT NULL,
  chunk_count integer NOT NULL,
  rag_passed integer NOT NULL,
  rag_total integer NOT NULL,
  citation_accuracy double precision NOT NULL,
  refusal_accuracy double precision NOT NULL,
  review_passed integer NOT NULL,
  review_total integer NOT NULL,
  review_recall double precision NOT NULL
);

CREATE INDEX IF NOT EXISTS evaluation_runs_generated_at_idx ON evaluation_runs(generated_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  summary text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_logs_project_created_at_idx ON audit_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);
`;
}
