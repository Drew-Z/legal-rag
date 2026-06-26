import type { AuditLogEntry, DocumentChunk, LegalDocument, ProjectMember, ProjectSpace } from "@legal-rag/shared";

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
  listProjectsForUser(userEmail: string): ProjectSpace[] | Promise<ProjectSpace[]>;
  addProjectMember(member: ProjectMember): void | Promise<void>;
  userCanAccessProject(projectId: string, userEmail: string): boolean | Promise<boolean>;
  recordAuditLog(entry: AuditLogEntry): void | Promise<void>;
  listAuditLogs(projectId?: string, limit?: number): AuditLogEntry[] | Promise<AuditLogEntry[]>;
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
  private readonly projectMembers = new Map<string, ProjectMember>();
  private readonly documentIdByHash = new Map<string, string>();
  private readonly chunksByDocument = new Map<string, DocumentChunk[]>();
  private readonly auditLogs: AuditLogEntry[] = [];

  addProject(project: ProjectSpace): void {
    this.projects.set(project.id, project);
    if (project.ownerEmail) {
      this.addProjectMember({
        projectId: project.id,
        userEmail: project.ownerEmail,
        role: "owner",
        createdAt: project.createdAt
      });
    }
  }

  listProjects(): ProjectSpace[] {
    return sortProjects([...this.projects.values()]);
  }

  listProjectsForUser(userEmail: string): ProjectSpace[] {
    return sortProjects(
      [...this.projects.values()].filter(
        (project) => project.isDefault || this.userCanAccessProject(project.id, userEmail)
      )
    );
  }

  addProjectMember(member: ProjectMember): void {
    this.projectMembers.set(projectMemberKey(member.projectId, member.userEmail), member);
  }

  userCanAccessProject(projectId: string, userEmail: string): boolean {
    const project = this.projects.get(projectId);
    if (!project) {
      return false;
    }
    if (project.isDefault) {
      return true;
    }
    return this.projectMembers.has(projectMemberKey(projectId, userEmail));
  }

  recordAuditLog(entry: AuditLogEntry): void {
    this.auditLogs.unshift(entry);
    this.auditLogs.splice(200);
  }

  listAuditLogs(projectId?: string, limit = 50): AuditLogEntry[] {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    return this.auditLogs.filter((entry) => !projectId || entry.projectId === projectId).slice(0, safeLimit);
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

function sortProjects(projects: ProjectSpace[]): ProjectSpace[] {
  return projects.sort((left, right) => {
    if (left.isDefault) {
      return -1;
    }
    if (right.isDefault) {
      return 1;
    }
    return right.createdAt.localeCompare(left.createdAt);
  });
}

function hashKey(projectId: string, contentHash: string): string {
  return `${projectId}:${contentHash}`;
}

function projectMemberKey(projectId: string, userEmail: string): string {
  return `${projectId}:${userEmail}`;
}
