import type { LegalDocument } from "@legal-rag/shared";
import { splitIntoChunks } from "../chunks/splitter.js";
import type { EmbeddingProvider } from "../embeddings/provider.js";
import type { DocumentRepository } from "../store/repository.js";
import type { VectorStore } from "../vector-store/types.js";
import { hashDocumentContent } from "./hash.js";
import { enrichChunkMetadata, type ImportDocumentInput } from "./metadata.js";
import { cleanText } from "./text.js";

export interface ImportDocumentResult {
  documentId: string;
  chunkCount: number;
  document: LegalDocument;
  duplicate?: boolean;
}

export class DocumentIngestionService {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly embeddings: EmbeddingProvider,
    private readonly vectorStore: VectorStore
  ) {}

  async importDocument(input: ImportDocumentInput): Promise<ImportDocumentResult> {
    const title = input.title.trim();
    const text = cleanText(input.text);

    if (!title || !text) {
      throw new Error("title and text are required");
    }

    const contentHash = hashDocumentContent(text);
    const existingDocument = await this.repository.getDocumentByHash(contentHash);
    if (existingDocument) {
      return {
        documentId: existingDocument.id,
        chunkCount: existingDocument.chunkCount,
        document: existingDocument,
        duplicate: true
      };
    }

    const documentId = `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const chunks = splitIntoChunks({ documentId, title, text }).map((chunk) => ({
      ...chunk,
      metadata: enrichChunkMetadata(chunk.metadata, input)
    }));
    const document: LegalDocument = {
      id: documentId,
      title,
      sourceType: input.sourceType ?? "text",
      originalName: input.originalName,
      createdAt: new Date().toISOString(),
      chunkCount: chunks.length,
      contentHash,
      docType: input.docType,
      sourceUrl: input.sourceUrl,
      sourceLabel: input.sourceLabel
    };

    await this.repository.addDocument(document, chunks);
    const vectors = await this.embeddings.embedBatch(chunks.map((chunk) => chunk.content));
    await this.vectorStore.upsertChunks(chunks.map((chunk, index) => ({ chunk, embedding: vectors[index] })));

    return {
      documentId,
      chunkCount: chunks.length,
      document
    };
  }
}
