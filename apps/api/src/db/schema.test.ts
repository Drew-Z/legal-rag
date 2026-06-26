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
  assert.match(sql, /CREATE TABLE IF NOT EXISTS evaluation_runs/);
  assert.match(sql, /evaluation_runs_generated_at_idx/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS audit_logs/);
  assert.match(sql, /audit_logs_project_created_at_idx/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS project_members/);
  assert.match(sql, /project_members_user_email_idx/);
});
