import type { DocumentChunk, ScoredChunk } from "@legal-rag/shared";

export interface StoredChunk {
  chunk: DocumentChunk;
  embedding: number[];
}

export interface VectorStore {
  upsertChunks(items: StoredChunk[]): Promise<void>;
  similaritySearch(queryEmbedding: number[], topK: number): Promise<ScoredChunk[]>;
  keywordSearch(query: string, topK: number): Promise<ScoredChunk[]>;
}
