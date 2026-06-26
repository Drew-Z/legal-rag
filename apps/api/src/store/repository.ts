import type { DocumentChunk, LegalDocument, ProjectSpace } from "@legal-rag/shared";

export const DEFAULT_PROJECT_ID = "project_default";
export const DEFAULT_PROJECT: ProjectSpace = {
  id: DEFAULT_PROJECT_ID,
  name: "默认项目",
  description: "演示与本地导入文档",
  createdAt: "2026-06-26T00:00:00.000Z",
  isDefault: true
};

export interface DocumentRepository {
  addProject(project: ProjectSpace): void | Promise<void>;
  listProjects(): ProjectSpace[] | Promise<ProjectSpace[]>;
  addDocument(document: LegalDocument, chunks: DocumentChunk[]): void | Promise<void>;
  listDocuments(projectId?: string): LegalDocument[] | Promise<LegalDocument[]>;
  getDocument(id: string): LegalDocument | undefined | Promise<LegalDocument | undefined>;
  getDocumentByHash(
    contentHash: string,
    projectId: string
  ): LegalDocument | undefined | Promise<LegalDocument | undefined>;
  getChunks(documentId: string): DocumentChunk[] | Promise<DocumentChunk[]>;
  allChunks(projectId?: string): DocumentChunk[] | Promise<DocumentChunk[]>;
}

export class Repository implements DocumentRepository {
  private readonly projects = new Map<string, ProjectSpace>([[DEFAULT_PROJECT.id, DEFAULT_PROJECT]]);
  private readonly documents = new Map<string, LegalDocument>();
  private readonly documentIdByHash = new Map<string, string>();
  private readonly chunksByDocument = new Map<string, DocumentChunk[]>();

  addProject(project: ProjectSpace): void {
    this.projects.set(project.id, project);
  }

  listProjects(): ProjectSpace[] {
    return [...this.projects.values()].sort((left, right) => {
      if (left.isDefault) {
        return -1;
      }
      if (right.isDefault) {
        return 1;
      }
      return right.createdAt.localeCompare(left.createdAt);
    });
  }

  addDocument(document: LegalDocument, chunks: DocumentChunk[]): void {
    this.documents.set(document.id, document);
    if (document.contentHash) {
      this.documentIdByHash.set(hashKey(document.projectId, document.contentHash), document.id);
    }
    this.chunksByDocument.set(document.id, chunks);
  }

  listDocuments(projectId?: string): LegalDocument[] {
    return [...this.documents.values()].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    ).filter((document) => !projectId || document.projectId === projectId);
  }

  getDocument(id: string): LegalDocument | undefined {
    return this.documents.get(id);
  }

  getDocumentByHash(contentHash: string, projectId: string): LegalDocument | undefined {
    const documentId = this.documentIdByHash.get(hashKey(projectId, contentHash));
    return documentId ? this.documents.get(documentId) : undefined;
  }

  getChunks(documentId: string): DocumentChunk[] {
    return this.chunksByDocument.get(documentId) ?? [];
  }

  allChunks(projectId?: string): DocumentChunk[] {
    return [...this.chunksByDocument.values()].flat().filter((chunk) => !projectId || chunk.metadata.projectId === projectId);
  }
}

function hashKey(projectId: string, contentHash: string): string {
  return `${projectId}:${contentHash}`;
}
