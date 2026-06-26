import assert from "node:assert/strict";
import test from "node:test";
import { createPgVectorSchemaSql } from "./schema.js";

test("createPgVectorSchemaSql creates pgvector tables and indexes", () => {
  const sql = createPgVectorSchemaSql(1024);

  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS vector/);
  assert.match(sql, /embedding vector\(1024\)/);
  assert.match(sql, /USING hnsw \(embedding vector_cosine_ops\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS documents/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS chunks/);
});
