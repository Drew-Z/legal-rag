import type { DocumentChunk, ScoredChunk } from "@legal-rag/shared";
import type { Queryable } from "../db/pool.js";
import type { StoredChunk, VectorStore } from "./types.js";

export class PgVectorStore implements VectorStore {
  constructor(private readonly db: Queryable) {}

  async upsertChunks(items: StoredChunk[]): Promise<void> {
    for (const item of items) {
      await this.db.query(
        `
        INSERT INTO chunks (
          id, document_id, title, content, chunk_index, page, section,
          token_estimate, metadata, embedding
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::vector)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          chunk_index = EXCLUDED.chunk_index,
          page = EXCLUDED.page,
          section = EXCLUDED.section,
          token_estimate = EXCLUDED.token_estimate,
          metadata = EXCLUDED.metadata,
          embedding = EXCLUDED.embedding
        `,
        [
          item.chunk.id,
          item.chunk.documentId,
          item.chunk.title,
          item.chunk.content,
          item.chunk.chunkIndex,
          item.chunk.page,
          item.chunk.section,
          item.chunk.tokenEstimate,
          JSON.stringify(item.chunk.metadata),
          toPgVectorLiteral(item.embedding)
        ]
      );
    }
  }

  async similaritySearch(queryEmbedding: number[], topK: number): Promise<ScoredChunk[]> {
    const result = await this.db.query(
      `
      SELECT *, 1 - (embedding <=> $1::vector) AS vector_score
      FROM chunks
      ORDER BY embedding <=> $1::vector
      LIMIT $2
      `,
      [toPgVectorLiteral(queryEmbedding), topK]
    );

    return result.rows.map((row) => ({
      ...rowToChunk(row),
      score: Number(row.vector_score),
      vectorScore: Number(row.vector_score)
    }));
  }

  async keywordSearch(query: string, topK: number): Promise<ScoredChunk[]> {
    const result = await this.db.query(
      `
      SELECT *,
        ts_rank_cd(to_tsvector('simple', title || ' ' || section || ' ' || content), plainto_tsquery('simple', $1)) AS keyword_score
      FROM chunks
      WHERE to_tsvector('simple', title || ' ' || section || ' ' || content) @@ plainto_tsquery('simple', $1)
         OR title ILIKE $3
         OR section ILIKE $3
         OR content ILIKE $3
      ORDER BY keyword_score DESC, chunk_index ASC
      LIMIT $2
      `,
      [query, topK, `%${escapeLike(query.slice(0, 32))}%`]
    );

    return result.rows.map((row) => {
      const keywordScore = Number(row.keyword_score) || 0.1;
      return {
        ...rowToChunk(row),
        score: keywordScore,
        keywordScore
      };
    });
  }
}

export function toPgVectorLiteral(vector: number[]): string {
  if (vector.some((value) => !Number.isFinite(value))) {
    throw new Error("pgvector embeddings must contain only finite numbers");
  }

  return `[${vector.join(",")}]`;
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

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
