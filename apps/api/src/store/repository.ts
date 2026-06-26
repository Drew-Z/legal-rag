import type { DocumentChunk, LegalDocument } from "@legal-rag/shared";

export interface DocumentRepository {
  addDocument(document: LegalDocument, chunks: DocumentChunk[]): void | Promise<void>;
  listDocuments(): LegalDocument[] | Promise<LegalDocument[]>;
  getDocument(id: string): LegalDocument | undefined | Promise<LegalDocument | undefined>;
  getDocumentByHash(contentHash: string): LegalDocument | undefined | Promise<LegalDocument | undefined>;
  getChunks(documentId: string): DocumentChunk[] | Promise<DocumentChunk[]>;
  allChunks(): DocumentChunk[] | Promise<DocumentChunk[]>;
}

export class Repository implements DocumentRepository {
  private readonly documents = new Map<string, LegalDocument>();
  private readonly documentIdByHash = new Map<string, string>();
  private readonly chunksByDocument = new Map<string, DocumentChunk[]>();

  addDocument(document: LegalDocument, chunks: DocumentChunk[]): void {
    this.documents.set(document.id, document);
    if (document.contentHash) {
      this.documentIdByHash.set(document.contentHash, document.id);
    }
    this.chunksByDocument.set(document.id, chunks);
  }

  listDocuments(): LegalDocument[] {
    return [...this.documents.values()].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
  }

  getDocument(id: string): LegalDocument | undefined {
    return this.documents.get(id);
  }

  getDocumentByHash(contentHash: string): LegalDocument | undefined {
    const documentId = this.documentIdByHash.get(contentHash);
    return documentId ? this.documents.get(documentId) : undefined;
  }

  getChunks(documentId: string): DocumentChunk[] {
    return this.chunksByDocument.get(documentId) ?? [];
  }

  allChunks(): DocumentChunk[] {
    return [...this.chunksByDocument.values()].flat();
  }
}
