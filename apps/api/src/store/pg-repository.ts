import type { DocumentChunk, LegalDocument, ProjectSpace } from "@legal-rag/shared";
import type { Queryable } from "../db/pool.js";
import { DEFAULT_PROJECT } from "./repository.js";
import type { DocumentRepository } from "./repository.js";

export class PgRepository implements DocumentRepository {
  constructor(private readonly db: Queryable) {}

  async addProject(project: ProjectSpace): Promise<void> {
    await this.db.query(
      `
      INSERT INTO projects (id, name, description, created_at, is_default)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        is_default = EXCLUDED.is_default
      `,
      [project.id, project.name, project.description, project.createdAt, project.isDefault ?? false]
    );
  }

  async listProjects(): Promise<ProjectSpace[]> {
    const result = await this.db.query("SELECT * FROM projects ORDER BY is_default DESC, created_at DESC");
    return result.rows.map(rowToProject);
  }

  async addDocument(document: LegalDocument, _chunks: DocumentChunk[] = []): Promise<void> {
    await this.db.query(
      `
      INSERT INTO documents (
        id, project_id, title, source_type, original_name, created_at, chunk_count,
        content_hash, doc_type, source_url, source_label
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        project_id = EXCLUDED.project_id,
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
        document.projectId,
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

  async listDocuments(projectId?: string): Promise<LegalDocument[]> {
    if (!projectId) {
      const result = await this.db.query("SELECT * FROM documents ORDER BY created_at DESC");
      return result.rows.map(rowToDocument);
    }
    const result = await this.db.query("SELECT * FROM documents WHERE project_id = $1 ORDER BY created_at DESC", [
      projectId
    ]);
    return result.rows.map(rowToDocument);
  }

  async getDocument(id: string): Promise<LegalDocument | undefined> {
    const result = await this.db.query("SELECT * FROM documents WHERE id = $1", [id]);
    return result.rows[0] ? rowToDocument(result.rows[0]) : undefined;
  }

  async getDocumentByHash(contentHash: string, projectId: string): Promise<LegalDocument | undefined> {
    const result = await this.db.query("SELECT * FROM documents WHERE content_hash = $1 AND project_id = $2", [
      contentHash,
      projectId
    ]);
    return result.rows[0] ? rowToDocument(result.rows[0]) : undefined;
  }

  async getChunks(documentId: string): Promise<DocumentChunk[]> {
    const result = await this.db.query("SELECT * FROM chunks WHERE document_id = $1 ORDER BY chunk_index ASC", [
      documentId
    ]);
    return result.rows.map(rowToChunk);
  }

  async allChunks(projectId?: string): Promise<DocumentChunk[]> {
    if (!projectId) {
      const result = await this.db.query("SELECT * FROM chunks ORDER BY document_id ASC, chunk_index ASC");
      return result.rows.map(rowToChunk);
    }
    const result = await this.db.query(
      "SELECT * FROM chunks WHERE metadata->>'projectId' = $1 ORDER BY document_id ASC, chunk_index ASC",
      [projectId]
    );
    return result.rows.map(rowToChunk);
  }
}

function rowToProject(row: Record<string, unknown>): ProjectSpace {
  return {
    id: String(row.id),
    name: String(row.name),
    description: optionalString(row.description),
    createdAt: toIsoString(row.created_at),
    isDefault: Boolean(row.is_default)
  };
}

function rowToDocument(row: Record<string, unknown>): LegalDocument {
  return {
    id: String(row.id),
    projectId: optionalString(row.project_id) ?? DEFAULT_PROJECT.id,
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
