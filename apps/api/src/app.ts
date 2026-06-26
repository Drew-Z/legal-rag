import cors from "cors";
import express, { type Request, type Response } from "express";
import multer from "multer";
import type { ProjectSpace } from "@legal-rag/shared";
import { splitIntoChunks } from "./chunks/splitter.js";
import type { AppConfig } from "./config/env.js";
import { createPool } from "./db/pool.js";
import { createPgVectorSchemaSql } from "./db/schema.js";
import { seedPublicSafeDataset } from "./datasets/dataset-service.js";
import { DocumentIngestionService } from "./documents/ingestion-service.js";
import { parseUploadedDocument } from "./documents/parsers.js";
import { cleanText } from "./documents/text.js";
import type { EmbeddingProvider } from "./embeddings/provider.js";
import { MockEmbeddingProvider } from "./embeddings/provider.js";
import {
  OpenAICompatibleChatProvider,
  OpenAICompatibleEmbeddingProvider,
  type ChatProvider
} from "./model-providers/openai-compatible.js";
import { buildQualityReport } from "./quality/quality-service.js";
import { RagService } from "./rag/rag-service.js";
import { reviewContract } from "./review/review-service.js";
import { PgRepository } from "./store/pg-repository.js";
import { DEFAULT_PROJECT, DEFAULT_PROJECT_ID, type DocumentRepository, Repository } from "./store/repository.js";
import { MemoryVectorStore } from "./vector-store/memory.js";
import { PgVectorStore } from "./vector-store/pgvector.js";
import type { VectorStore } from "./vector-store/types.js";

export async function createApp(config: AppConfig) {
  const app = express();
  const { repository, embeddings, vectorStore, chatProvider } = await createRuntime(config);
  const ingestion = new DocumentIngestionService(repository, embeddings, vectorStore);
  const rag = new RagService(embeddings, vectorStore, chatProvider);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 8 * 1024 * 1024
    }
  });

  app.use(cors({ origin: config.webOrigin }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      modelProvider: config.modelProvider,
      vectorStore: config.vectorStore,
      embeddingModel: config.embedding.model
    });
  });

  app.get("/api/quality/report", async (_request, response) => {
    response.json(await buildQualityReport(config, repository));
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

    response.json(await rag.answerQuestion(question, topK, projectId));
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

    response.json(reviewContract(chunks));
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

async function createRuntime(config: AppConfig): Promise<{
  repository: DocumentRepository;
  embeddings: EmbeddingProvider;
  vectorStore: VectorStore;
  chatProvider?: ChatProvider;
}> {
  const embeddings =
    config.modelProvider === "openai-compatible" && config.llm
      ? new OpenAICompatibleEmbeddingProvider({
          baseUrl: config.embedding.baseUrl ?? config.llm.baseUrl,
          apiKey: config.embedding.apiKey ?? config.llm.apiKey,
          model: config.embedding.model,
          dimensions: config.embedding.dimensions
        })
      : new MockEmbeddingProvider();

  const chatProvider =
    config.modelProvider === "openai-compatible" && config.llm
      ? new OpenAICompatibleChatProvider({
          baseUrl: config.llm.baseUrl,
          apiKey: config.llm.apiKey,
          model: config.llm.model
        })
      : undefined;

  if (config.vectorStore === "pgvector") {
    if (!config.databaseUrl) {
      throw new Error("DATABASE_URL is required when VECTOR_STORE=pgvector");
    }
    const pool = createPool(config.databaseUrl);
    await pool.query(createPgVectorSchemaSql(config.embedding.dimensions));
    const repository = new PgRepository(pool);
    await repository.addProject(DEFAULT_PROJECT);
    return {
      repository,
      embeddings,
      vectorStore: new PgVectorStore(pool),
      chatProvider
    };
  }

  return {
    repository: new Repository(),
    embeddings,
    vectorStore: new MemoryVectorStore(),
    chatProvider
  };
}
