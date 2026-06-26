import type {
  ContractReviewResult,
  DocumentChunk,
  LegalDocument,
  QualityReport,
  RagAnswer
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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
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
  qualityReport: () => request<QualityReport>("/api/quality/report"),
  importText: (title: string, text: string) =>
    request<ImportTextResponse>("/api/documents/import-text", {
      method: "POST",
      body: JSON.stringify({ title, text })
    }),
  uploadDocument: (file: File, title: string, onProgress?: (percent: number) => void) =>
    uploadRequest<UploadDocumentResponse>("/api/documents/upload", file, title, onProgress),
  seedDataset: () =>
    request<SeedDatasetResponse>("/api/datasets/seed", {
      method: "POST",
      body: JSON.stringify({})
    }),
  listDocuments: () => request<{ documents: LegalDocument[] }>("/api/documents"),
  getChunks: (documentId: string) =>
    request<{ document: LegalDocument; chunks: DocumentChunk[] }>(`/api/documents/${documentId}/chunks`),
  query: (question: string, topK = 5) =>
    request<RagAnswer>("/api/rag/query", {
      method: "POST",
      body: JSON.stringify({ question, topK })
    }),
  review: (payload: { documentId?: string; text?: string }) =>
    request<ContractReviewResult>("/api/contracts/review", {
      method: "POST",
      body: JSON.stringify(payload)
    })
};

function uploadRequest<T>(
  path: string,
  file: File,
  title: string,
  onProgress?: (percent: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("title", title);
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", path);
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
