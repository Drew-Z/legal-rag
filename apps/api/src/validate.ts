import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { createApp } from "./app.js";

const app = await createApp({
  port: 0,
  webOrigin: "http://127.0.0.1:5173",
  modelProvider: "mock",
  vectorStore: "memory",
  embedding: {
    model: "mock",
    dimensions: 96
  }
});

const server = createServer(app);

await new Promise<void>((resolveReady) => {
  server.listen(0, "127.0.0.1", resolveReady);
});

const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("Failed to start validation server");
}

const baseUrl = `http://127.0.0.1:${address.port}`;
const sample = await readFile(resolve("..", "..", "samples", "sample-contract.txt"), "utf8");

try {
  const health = await getJson<{ ok: boolean }>("/api/health");
  assert(health.ok, "health check failed");

  const quality = await getJson<{
    eval: { total: number; passed: number; failed: number };
    checks: Array<{ status: string }>;
  }>("/api/quality/report");
  assert(quality.eval.total > 0, "expected quality eval cases");
  assert(quality.eval.failed === 0, "expected quality eval to pass");
  assert(quality.checks.length > 0, "expected quality checks");

  const evaluation = await getJson<{ total: number; passed: number; failed: number; results: unknown[] }>(
    "/api/evaluation/report"
  );
  assert(evaluation.total > 0, "expected evaluation cases");
  assert(evaluation.failed === 0, "expected evaluation report to pass");
  assert(evaluation.results.length === evaluation.total, "expected detailed evaluation results");

  const reviewEvaluation = await getJson<{
    total: number;
    passed: number;
    failed: number;
    recall: number;
    results: unknown[];
  }>("/api/review/evaluation/report");
  assert(reviewEvaluation.total > 0, "expected review evaluation cases");
  assert(reviewEvaluation.failed === 0, "expected review evaluation report to pass");
  assert(reviewEvaluation.recall === 1, "expected review evaluation recall to be 100%");
  assert(reviewEvaluation.results.length === reviewEvaluation.total, "expected detailed review evaluation results");

  const createdProject = await postJson<{ project: { id: string; name: string } }>("/api/projects", {
    name: "validation workspace"
  });
  assert(createdProject.project.id.length > 0, "expected created project id");

  const projectImport = await postJson<{ documentId: string; chunkCount: number }>("/api/documents/import-text", {
    projectId: createdProject.project.id,
    title: "isolated workspace contract",
    text: "第一条 付款\n本项目专属合同约定验收后七日内付款。"
  });
  assert(projectImport.chunkCount > 0, "expected project import chunks");

  const projectDocuments = await getJson<{ documents: Array<{ id: string }> }>(
    `/api/documents?projectId=${createdProject.project.id}`
  );
  assert(
    projectDocuments.documents.some((document) => document.id === projectImport.documentId),
    "expected project document to appear in its workspace"
  );

  const defaultDocumentsBeforeImport = await getJson<{ documents: Array<{ id: string }> }>("/api/documents");
  assert(
    !defaultDocumentsBeforeImport.documents.some((document) => document.id === projectImport.documentId),
    "expected project document to be hidden from default workspace"
  );

  const imported = await postJson<{ documentId: string; chunkCount: number }>("/api/documents/import-text", {
    title: "sample service contract",
    text: sample
  });
  assert(imported.chunkCount > 0, "expected imported chunks");

  const duplicate = await postJson<{ documentId: string; duplicate?: boolean }>("/api/documents/import-text", {
    title: "sample service contract duplicate",
    text: sample
  });
  assert(duplicate.documentId === imported.documentId, "duplicate import should return existing document");
  assert(duplicate.duplicate === true, "duplicate import should be marked");

  const chunks = await getJson<{ chunks: unknown[] }>(`/api/documents/${imported.documentId}/chunks`);
  assert(chunks.chunks.length === imported.chunkCount, "chunk list did not match import count");

  const seeded = await postJson<{ imported: number; duplicates: number; documents: unknown[] }>("/api/datasets/seed", {});
  assert(seeded.imported > 0, "expected seeded dataset imports");

  const uploaded = await postMultipart<{ documentId: string; chunkCount: number; parser: string }>(
    "/api/documents/upload",
    "validation-upload.txt",
    "text/plain",
    "验证上传合同\n\n第一条 付款\n甲方验收后十日内支付服务费。\n\n第二条 违约责任\n任一方违约应承担赔偿责任。"
  );
  assert(uploaded.chunkCount > 0, "expected uploaded chunks");
  assert(uploaded.parser === "txt", "expected txt parser");

  const answer = await postJson<{
    answer: string;
    citations: unknown[];
    rewrittenQuestion: string;
    diagnostics?: {
      vectorCandidates: number;
      keywordCandidates: number;
      rerankedCandidates: number;
      answerSource: "model" | "fallback" | "refusal";
    };
  }>("/api/rag/query", {
    question: "违约责任是否合理？",
    topK: 5
  });
  assert(answer.answer.length > 0, "expected answer text");
  assert(answer.citations.length > 0, "expected citations");
  assert(answer.rewrittenQuestion.length > 0, "expected rewritten question");
  assert((answer.diagnostics?.vectorCandidates ?? 0) > 0, "expected vector diagnostics");
  assert((answer.diagnostics?.rerankedCandidates ?? 0) > 0, "expected rerank diagnostics");
  assert(answer.diagnostics?.answerSource === "fallback", "expected mock validation to use local fallback answer");

  const review = await postJson<{ risks: unknown[] }>("/api/contracts/review", {
    documentId: imported.documentId
  });
  assert(review.risks.length >= 3, "expected contract risks");

  console.log("MVP validation passed");
} finally {
  server.close();
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`);
  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return response.json() as Promise<T>;
}

async function postMultipart<T>(
  path: string,
  filename: string,
  mimeType: string,
  content: string
): Promise<T> {
  const form = new FormData();
  form.append("title", "validation upload");
  form.append("file", new Blob([content], { type: mimeType }), filename);
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    body: form
  });
  return response.json() as Promise<T>;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
