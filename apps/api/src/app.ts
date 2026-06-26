import cors from "cors";
import express, { type Request, type Response } from "express";
import multer from "multer";
import type { AuthStatus, ProjectSpace } from "@legal-rag/shared";
import { recordAuditLog } from "./audit/audit-log.js";
import { AuthService, requireAuth } from "./auth/session.js";
import { splitIntoChunks } from "./chunks/splitter.js";
import type { AppConfig } from "./config/env.js";
import { seedPublicSafeDataset } from "./datasets/dataset-service.js";
import { DocumentIngestionService } from "./documents/ingestion-service.js";
import { parseUploadedDocument } from "./documents/parsers.js";
import { cleanText } from "./documents/text.js";
import { buildEvaluationReport } from "./evaluation/eval-service.js";
import { InMemoryIngestionJobQueue } from "./ingestion/ingestion-jobs.js";
import { registerIngestionJobRoutes } from "./ingestion/ingestion-routes.js";
import { buildQualityReport } from "./quality/quality-service.js";
import { RagService } from "./rag/rag-service.js";
import { buildReviewEvaluationReport } from "./review/review-eval-service.js";
import { reviewContractWithModel } from "./review/review-service.js";
import { createRuntime } from "./runtime.js";
import { DEFAULT_PROJECT_ID, type DocumentRepository } from "./store/repository.js";

export async function createApp(config: AppConfig) {
  const app = express();
  const { repository, embeddings, vectorStore, chatProvider, evaluationHistory } = await createRuntime(config);
  const auth = new AuthService(config.auth);
  const ingestion = new DocumentIngestionService(repository, embeddings, vectorStore);
  const ingestionJobs = new InMemoryIngestionJobQueue();
  const rag = new RagService(embeddings, vectorStore, chatProvider);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 8 * 1024 * 1024
    }
  });

  app.use(cors({ origin: config.webOrigin, credentials: true }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      modelProvider: config.modelProvider,
      vectorStore: config.vectorStore,
      embeddingModel: config.embedding.model
    });
  });

  app.get("/api/auth/status", (request, response) => {
    const user = auth.getUserFromRequest(request);
    const status: AuthStatus = {
      enabled: auth.enabled,
      authenticated: !auth.enabled || Boolean(user),
      user
    };
    response.json(status);
  });

  app.post("/api/auth/login", (request, response) => {
    if (!auth.enabled) {
      response.json({
        enabled: false,
        authenticated: true
      } satisfies AuthStatus);
      return;
    }

    const email = String(request.body?.email ?? "").trim();
    const password = String(request.body?.password ?? "");
    const user = auth.authenticate(email, password);
    if (!user) {
      response.status(401).json({ error: "invalid email or password" });
      return;
    }

    response.setHeader("Set-Cookie", auth.createCookie(user));
    response.json({
      enabled: true,
      authenticated: true,
      user
    } satisfies AuthStatus);
  });

  app.post("/api/auth/logout", (_request, response) => {
    response.setHeader("Set-Cookie", auth.clearCookie());
    response.json({
      enabled: auth.enabled,
      authenticated: false
    } satisfies AuthStatus);
  });

  app.use("/api", requireAuth(auth));

  app.get("/api/quality/report", async (_request, response) => {
    const report = await buildQualityReport(config, repository);
    await evaluationHistory.record(report);
    response.json(report);
  });

  app.get("/api/quality/trends", async (_request, response) => {
    response.json({ points: await evaluationHistory.list(20) });
  });

  app.get("/api/evaluation/report", async (_request, response) => {
    response.json(await buildEvaluationReport());
  });

  app.get("/api/review/evaluation/report", async (_request, response) => {
    response.json(await buildReviewEvaluationReport());
  });

  app.get("/api/audit-logs", async (request, response) => {
    const rawProjectId = request.query.projectId ? String(request.query.projectId).trim() : "";
    const projectId = rawProjectId || undefined;
    if (projectId) {
      const projects = await repository.listProjects();
      if (!projects.some((project) => project.id === projectId)) {
        response.status(404).json({ error: "project not found" });
        return;
      }
    }

    const limit = Math.max(1, Math.min(Number(request.query.limit ?? 50), 100));
    response.json({ logs: await repository.listAuditLogs(projectId, limit) });
  });

  registerIngestionJobRoutes(app, {
    repository,
    ingestion,
    ingestionJobs,
    uploadSingleFile: upload.single("file")
  });

  app.get("/api/projects", async (_request, response) => {
    response.json({ projects: await repository.listProjects() });
  });

  app.post("/api/projects", async (request, response) => {
    const name = String(request.body?.name ?? "").trim();
    const description = String(request.body?.description ?? "").trim();

    if (!name) {
      response.status(400).json({ error: "project name is required" });
      return;
    }

    const project: ProjectSpace = {
      id: `project_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      description: description || undefined,
      createdAt: new Date().toISOString()
    };
    await repository.addProject(project);
    await recordAuditLog(repository, request, {
      projectId: project.id,
      action: "project.create",
      targetType: "project",
      targetId: project.id,
      summary: `创建项目空间：${project.name}`
    });
    response.status(201).json({ project });
  });

  app.post("/api/documents/import-text", async (request, response) => {
    const projectId = await resolveProjectId(request, response, repository);
    if (!projectId) {
      return;
    }
    const title = String(request.body?.title ?? "").trim();
    const text = cleanText(String(request.body?.text ?? ""));

    if (!title || !text) {
      response.status(400).json({ error: "title and text are required" });
      return;
    }

    const result = await ingestion.importDocument({
      projectId,
      title,
      text,
      sourceType: "text"
    });

    await recordAuditLog(repository, request, {
      projectId,
      action: "document.import",
      targetType: "document",
      targetId: result.documentId,
      summary: `${result.duplicate ? "复用重复文档" : "导入文本文档"}：${result.document.title}`
    });
    response.status(result.duplicate ? 200 : 201).json(result);
  });

  app.post("/api/documents/upload", upload.single("file"), async (request, response) => {
    const projectId = await resolveProjectId(request, response, repository);
    if (!projectId) {
      return;
    }
    if (!request.file) {
      response.status(400).json({ error: "file is required" });
      return;
    }

    try {
      const parsed = await parseUploadedDocument(
        request.file.buffer,
        request.file.originalname,
        request.file.mimetype
      );
      const title = String(request.body?.title ?? "").trim() || request.file.originalname;
      const result = await ingestion.importDocument({
        projectId,
        title,
        text: parsed.text,
        sourceType: "upload",
        docType: "uploaded",
        sourceLabel: request.file.originalname,
        originalName: request.file.originalname
      });

      await recordAuditLog(repository, request, {
        projectId,
        action: "document.upload",
        targetType: "document",
        targetId: result.documentId,
        summary: `${result.duplicate ? "复用重复上传" : "上传文档"}：${result.document.title}`
      });
      response.status(result.duplicate ? 200 : 201).json({
        ...result,
        parser: parsed.parser,
        warnings: parsed.warnings
      });
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "upload failed" });
    }
  });

  app.post("/api/datasets/seed", async (_request, response) => {
    const projectId = await resolveProjectId(_request, response, repository);
    if (!projectId) {
      return;
    }
    const results = await seedPublicSafeDataset(ingestion, projectId);
    await recordAuditLog(repository, _request, {
      projectId,
      action: "dataset.seed",
      targetType: "dataset",
      targetId: "public-safe",
      summary: `初始化公开安全数据集：新增 ${results.filter((result) => !result.duplicate).length} 份，重复 ${results.filter((result) => result.duplicate).length} 份`
    });
    response.json({
      imported: results.filter((result) => !result.duplicate).length,
      duplicates: results.filter((result) => result.duplicate).length,
      documents: results.map((result) => result.document)
    });
  });

  app.get("/api/documents", async (_request, response) => {
    const projectId = await resolveProjectId(_request, response, repository);
    if (!projectId) {
      return;
    }
    response.json({ documents: await repository.listDocuments(projectId) });
  });

  app.get("/api/documents/:id/chunks", async (request, response) => {
    const projectId = await resolveProjectId(request, response, repository);
    if (!projectId) {
      return;
    }
    const document = await repository.getDocument(request.params.id);
    if (!document || document.projectId !== projectId) {
      response.status(404).json({ error: "document not found" });
      return;
    }

    response.json({
      document,
      chunks: await repository.getChunks(request.params.id)
    });
  });

  app.post("/api/rag/query", async (request, response) => {
    const projectId = await resolveProjectId(request, response, repository);
    if (!projectId) {
      return;
    }
    const question = String(request.body?.question ?? "").trim();
    const topK = Math.max(1, Math.min(Number(request.body?.topK ?? 5), 10));

    if (!question) {
      response.status(400).json({ error: "question is required" });
      return;
    }

    const answer = await rag.answerQuestion(question, topK, projectId);
    await recordAuditLog(repository, request, {
      projectId,
      action: "rag.query",
      targetType: "question",
      summary: `智能问答：${question.slice(0, 80)}`
    });
    response.json(answer);
  });

  app.post("/api/contracts/review", async (request, response) => {
    const projectId = await resolveProjectId(request, response, repository);
    if (!projectId) {
      return;
    }
    const documentId = request.body?.documentId ? String(request.body.documentId) : undefined;
    const pastedText = request.body?.text ? cleanText(String(request.body.text)) : "";
    const document = documentId ? await repository.getDocument(documentId) : undefined;
    if (documentId && (!document || document.projectId !== projectId)) {
      response.status(404).json({ error: "document not found" });
      return;
    }
    const chunks = documentId
      ? await repository.getChunks(documentId)
      : splitIntoChunks({
          documentId: "pasted_contract",
          title: "粘贴合同",
          text: pastedText
        }).map((chunk) => ({
          ...chunk,
          metadata: {
            ...chunk.metadata,
            projectId
          }
        }));

    if (chunks.length === 0) {
      response.status(400).json({ error: "documentId or text is required" });
      return;
    }

    const review = await reviewContractWithModel(chunks, chatProvider);
    await recordAuditLog(repository, request, {
      projectId,
      action: "contract.review",
      targetType: "contract",
      targetId: documentId,
      summary: `合同审查：识别 ${review.risks.length} 项风险`
    });
    response.json(review);
  });

  return app;
}

async function resolveProjectId(
  request: Request,
  response: Response,
  repository: DocumentRepository
): Promise<string | undefined> {
  const rawProjectId =
    request.body?.projectId ??
    request.query.projectId ??
    request.header("x-project-id") ??
    DEFAULT_PROJECT_ID;
  const projectId = String(rawProjectId).trim() || DEFAULT_PROJECT_ID;
  const projects = await repository.listProjects();

  if (!projects.some((project) => project.id === projectId)) {
    response.status(404).json({ error: "project not found" });
    return undefined;
  }

  return projectId;
}
