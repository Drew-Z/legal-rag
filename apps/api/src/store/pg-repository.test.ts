import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentChunk, LegalDocument } from "@legal-rag/shared";
import { PgRepository } from "./pg-repository.js";

test("PgRepository stores documents and reads documents/chunks", async () => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const document: LegalDocument = {
    id: "doc_1",
    projectId: "project_default",
    title: "测试合同",
    sourceType: "dataset",
    createdAt: "2026-06-26T00:00:00.000Z",
    chunkCount: 1,
    contentHash: "hash_1",
    docType: "sample-contract",
    sourceLabel: "测试来源",
    sourceUrl: "local://test"
  };
  const chunk: DocumentChunk = {
    id: "chunk_1",
    documentId: "doc_1",
    title: "测试合同",
    content: "第一条 付款",
    chunkIndex: 0,
    page: 1,
    section: "第一条",
    tokenEstimate: 8,
    metadata: {
      source: "测试合同",
      projectId: "project_default",
      page: 1,
      section: "第一条",
      chunkIndex: 0,
      tokenEstimate: 8
    }
  };
  const db = {
    async query(sql: string, params: unknown[] = []) {
      queries.push({ sql, params });
      if (/FROM documents\s+WHERE content_hash/.test(sql)) {
        return { rows: [documentRow(document)] };
      }
      if (/FROM documents\s+WHERE id/.test(sql)) {
        return { rows: [documentRow(document)] };
      }
      if (/FROM documents\s+ORDER BY/.test(sql)) {
        return { rows: [documentRow(document)] };
      }
      if (/FROM chunks\s+WHERE document_id/.test(sql)) {
        return { rows: [chunkRow(chunk)] };
      }
      return { rows: [] };
    }
  };

  const repository = new PgRepository(db);
  await repository.addDocument(document, [chunk]);

  assert.equal((await repository.getDocumentByHash("hash_1", "project_default"))?.id, "doc_1");
  assert.equal((await repository.getDocument("doc_1"))?.title, "测试合同");
  assert.equal((await repository.listDocuments()).length, 1);
  assert.equal((await repository.getChunks("doc_1"))[0]?.id, "chunk_1");
  assert.ok(queries.some((query) => /INSERT INTO documents/.test(query.sql)));
});

function documentRow(document: LegalDocument): Record<string, unknown> {
  return {
    id: document.id,
    project_id: document.projectId,
    title: document.title,
    source_type: document.sourceType,
    original_name: document.originalName,
    created_at: document.createdAt,
    chunk_count: document.chunkCount,
    content_hash: document.contentHash,
    doc_type: document.docType,
    source_url: document.sourceUrl,
    source_label: document.sourceLabel
  };
}

function chunkRow(chunk: DocumentChunk): Record<string, unknown> {
  return {
    id: chunk.id,
    document_id: chunk.documentId,
    title: chunk.title,
    content: chunk.content,
    chunk_index: chunk.chunkIndex,
    page: chunk.page,
    section: chunk.section,
    token_estimate: chunk.tokenEstimate,
    metadata: chunk.metadata
  };
}
