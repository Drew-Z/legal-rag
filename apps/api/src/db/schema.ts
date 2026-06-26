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
`;
}
