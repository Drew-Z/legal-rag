import type {
  AuthStatus,
  ContractReviewResult,
  DocumentChunk,
  EvaluationReport,
  LegalDocument,
  ProjectSpace,
  QualityReport,
  RagAnswer,
  ReviewEvaluationReport
} from "@legal-rag/shared";

export interface ImportTextResponse {
  documentId: string;
  chunkCount: number;
  document: LegalDocument;
  duplicate?: boolean;
}

export interface UploadDocumentResponse extends ImportTextResponse {
  parser: "txt" | "pdf" | "docx";
  warnings: string[];
}

export interface SeedDatasetResponse {
  imported: number;
  duplicates: number;
  documents: LegalDocument[];
}

export interface CreateProjectResponse {
  project: ProjectSpace;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "";

function apiPath(path: string): string {
  return `${API_BASE_URL}${path}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiPath(path), {
    credentials: API_BASE_URL ? "include" : "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers
    },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean; modelProvider: string; vectorStore: string }>("/api/health"),
  authStatus: () => request<AuthStatus>("/api/auth/status"),
  login: (email: string, password: string) =>
    request<AuthStatus>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),
  logout: () =>
    request<AuthStatus>("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({})
    }),
  qualityReport: () => request<QualityReport>("/api/quality/report"),
  evaluationReport: () => request<EvaluationReport>("/api/evaluation/report"),
  reviewEvaluationReport: () => request<ReviewEvaluationReport>("/api/review/evaluation/report"),
  listProjects: () => request<{ projects: ProjectSpace[] }>("/api/projects"),
  createProject: (name: string, description = "") =>
    request<CreateProjectResponse>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, description })
    }),
  importText: (projectId: string, title: string, text: string) =>
    request<ImportTextResponse>("/api/documents/import-text", {
      method: "POST",
      body: JSON.stringify({ projectId, title, text })
    }),
  uploadDocument: (projectId: string, file: File, title: string, onProgress?: (percent: number) => void) =>
    uploadRequest<UploadDocumentResponse>("/api/documents/upload", projectId, file, title, onProgress),
  seedDataset: (projectId: string) =>
    request<SeedDatasetResponse>("/api/datasets/seed", {
      method: "POST",
      body: JSON.stringify({ projectId })
    }),
  listDocuments: (projectId: string) => request<{ documents: LegalDocument[] }>(`/api/documents?projectId=${encodeURIComponent(projectId)}`),
  getChunks: (projectId: string, documentId: string) =>
    request<{ document: LegalDocument; chunks: DocumentChunk[] }>(
      `/api/documents/${documentId}/chunks?projectId=${encodeURIComponent(projectId)}`
    ),
  query: (projectId: string, question: string, topK = 5) =>
    request<RagAnswer>("/api/rag/query", {
      method: "POST",
      body: JSON.stringify({ projectId, question, topK })
    }),
  review: (payload: { projectId: string; documentId?: string; text?: string }) =>
    request<ContractReviewResult>("/api/contracts/review", {
      method: "POST",
      body: JSON.stringify(payload)
    })
};

function uploadRequest<T>(
  path: string,
  projectId: string,
  file: File,
  title: string,
  onProgress?: (percent: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("projectId", projectId);
    form.append("title", title);
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiPath(path));
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      const body = JSON.parse(xhr.responseText || "{}");
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
      } else {
        reject(new Error(body.error ?? `Request failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(form);
  });
}
