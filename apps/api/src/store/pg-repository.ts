import type { DocumentChunk, LegalDocument } from "@legal-rag/shared";
import type { Queryable } from "../db/pool.js";
import type { DocumentRepository } from "./repository.js";

export class PgRepository implements DocumentRepository {
  constructor(private readonly db: Queryable) {}

  async addDocument(document: LegalDocument, _chunks: DocumentChunk[] = []): Promise<void> {
    await this.db.query(
      `
      INSERT INTO documents (
        id, title, source_type, original_name, created_at, chunk_count,
        content_hash, doc_type, source_url, source_label
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        source_type = EXCLUDED.source_type,
        original_name = EXCLUDED.original_name,
        created_at = EXCLUDED.created_at,
        chunk_count = EXCLUDED.chunk_count,
        content_hash = EXCLUDED.content_hash,
        doc_type = EXCLUDED.doc_type,
        source_url = EXCLUDED.source_url,
        source_label = EXCLUDED.source_label
      `,
      [
        document.id,
        document.title,
        document.sourceType,
        document.originalName,
        document.createdAt,
        document.chunkCount,
        document.contentHash,
        document.docType,
        document.sourceUrl,
        document.sourceLabel
      ]
    );
  }

  async listDocuments(): Promise<LegalDocument[]> {
    const result = await this.db.query("SELECT * FROM documents ORDER BY created_at DESC");
    return result.rows.map(rowToDocument);
  }

  async getDocument(id: string): Promise<LegalDocument | undefined> {
    const result = await this.db.query("SELECT * FROM documents WHERE id = $1", [id]);
    return result.rows[0] ? rowToDocument(result.rows[0]) : undefined;
  }

  async getDocumentByHash(contentHash: string): Promise<LegalDocument | undefined> {
    const result = await this.db.query("SELECT * FROM documents WHERE content_hash = $1", [contentHash]);
    return result.rows[0] ? rowToDocument(result.rows[0]) : undefined;
  }

  async getChunks(documentId: string): Promise<DocumentChunk[]> {
    const result = await this.db.query("SELECT * FROM chunks WHERE document_id = $1 ORDER BY chunk_index ASC", [
      documentId
    ]);
    return result.rows.map(rowToChunk);
  }

  async allChunks(): Promise<DocumentChunk[]> {
    const result = await this.db.query("SELECT * FROM chunks ORDER BY document_id ASC, chunk_index ASC");
    return result.rows.map(rowToChunk);
  }
}

function rowToDocument(row: Record<string, unknown>): LegalDocument {
  return {
    id: String(row.id),
    title: String(row.title),
    sourceType: row.source_type as LegalDocument["sourceType"],
    originalName: optionalString(row.original_name),
    createdAt: toIsoString(row.created_at),
    chunkCount: Number(row.chunk_count),
    contentHash: optionalString(row.content_hash),
    docType: row.doc_type as LegalDocument["docType"] | undefined,
    sourceUrl: optionalString(row.source_url),
    sourceLabel: optionalString(row.source_label)
  };
}

function rowToChunk(row: Record<string, unknown>): DocumentChunk {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    title: String(row.title),
    content: String(row.content),
    chunkIndex: Number(row.chunk_index),
    page: Number(row.page),
    section: String(row.section),
    tokenEstimate: Number(row.token_estimate),
    metadata: row.metadata as DocumentChunk["metadata"]
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}
