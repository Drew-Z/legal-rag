import type { Express, Request, RequestHandler, Response } from "express";
import { recordAuditLog } from "../audit/audit-log.js";
import { getRequestUser } from "../auth/session.js";
import { seedPublicSafeDataset } from "../datasets/dataset-service.js";
import type { DocumentIngestionService } from "../documents/ingestion-service.js";
import { parseUploadedDocument } from "../documents/parsers.js";
import { cleanText } from "../documents/text.js";
import { DEFAULT_PROJECT_ID, type DocumentRepository } from "../store/repository.js";
import type { InMemoryIngestionJobQueue } from "./ingestion-jobs.js";

export function registerIngestionJobRoutes(
  app: Express,
  dependencies: {
    repository: DocumentRepository;
    ingestion: DocumentIngestionService;
    ingestionJobs: InMemoryIngestionJobQueue;
    uploadSingleFile: RequestHandler;
  }
): void {
  const { repository, ingestion, ingestionJobs, uploadSingleFile } = dependencies;

  app.get("/api/ingestion-jobs", async (request, response) => {
    const projectId = await resolveProjectId(request, response, repository);
    if (!projectId) {
      return;
    }
    const limit = Math.max(1, Math.min(Number(request.query.limit ?? 20), 100));
    response.json({ jobs: ingestionJobs.list(projectId, limit) });
  });

  app.get("/api/ingestion-jobs/:id", async (request, response) => {
    const job = ingestionJobs.get(request.params.id);
    if (!job) {
      response.status(404).json({ error: "ingestion job not found" });
      return;
    }
    if (!(await repository.userCanAccessProject(job.projectId, getRequestUser(request).email))) {
      response.status(403).json({ error: "project access denied" });
      return;
    }
    response.json({ job });
  });

  app.post("/api/ingestion-jobs/import-text", async (request, response) => {
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

    const job = ingestionJobs.submit(
      {
        projectId,
        kind: "import-text",
        title
      },
      async (update) => {
        update({ progress: 25, message: "正在清洗和切分文本" });
        const result = await ingestion.importDocument({
          projectId,
          title,
          text,
          sourceType: "text"
        });
        update({ progress: 85, message: "正在写入知识库" });
        await recordAuditLog(repository, request, {
          projectId,
          action: "document.import",
          targetType: "document",
          targetId: result.documentId,
          summary: `${result.duplicate ? "复用重复文档" : "导入文本文档"}：${result.document.title}`
        });
        return result;
      }
    );

    response.status(202).json({ job });
  });

  app.post("/api/ingestion-jobs/upload", uploadSingleFile, async (request, response) => {
    const projectId = await resolveProjectId(request, response, repository);
    if (!projectId) {
      return;
    }
    if (!request.file) {
      response.status(400).json({ error: "file is required" });
      return;
    }

    const file = {
      buffer: Buffer.from(request.file.buffer),
      originalname: request.file.originalname,
      mimetype: request.file.mimetype
    };
    const title = String(request.body?.title ?? "").trim() || file.originalname;
    const job = ingestionJobs.submit(
      {
        projectId,
        kind: "upload",
        title
      },
      async (update) => {
        update({ progress: 20, message: "正在解析上传文件" });
        const parsed = await parseUploadedDocument(file.buffer, file.originalname, file.mimetype);
        update({ progress: 55, message: "正在向量化文档" });
        const result = await ingestion.importDocument({
          projectId,
          title,
          text: parsed.text,
          sourceType: "upload",
          docType: "uploaded",
          sourceLabel: file.originalname,
          originalName: file.originalname
        });
        update({ progress: 85, message: "正在写入知识库" });
        await recordAuditLog(repository, request, {
          projectId,
          action: "document.upload",
          targetType: "document",
          targetId: result.documentId,
          summary: `${result.duplicate ? "复用重复上传" : "上传文档"}：${result.document.title}`
        });
        return {
          ...result,
          parser: parsed.parser,
          warnings: parsed.warnings
        };
      }
    );

    response.status(202).json({ job });
  });

  app.post("/api/ingestion-jobs/seed", async (request, response) => {
    const projectId = await resolveProjectId(request, response, repository);
    if (!projectId) {
      return;
    }

    const job = ingestionJobs.submit(
      {
        projectId,
        kind: "seed-dataset",
        title: "公开安全数据集"
      },
      async (update) => {
        update({ progress: 20, message: "正在初始化公开安全数据集" });
        const results = await seedPublicSafeDataset(ingestion, projectId);
        const imported = results.filter((result) => !result.duplicate).length;
        const duplicates = results.filter((result) => result.duplicate).length;
        update({ progress: 90, message: "正在记录数据集入库结果" });
        await recordAuditLog(repository, request, {
          projectId,
          action: "dataset.seed",
          targetType: "dataset",
          targetId: "public-safe",
          summary: `初始化公开安全数据集：新增 ${imported} 份，重复 ${duplicates} 份`
        });
        return {
          imported,
          duplicates,
          documents: results.map((result) => result.document)
        };
      }
    );

    response.status(202).json({ job });
  });
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

  if (!(await repository.userCanAccessProject(projectId, getRequestUser(request).email))) {
    response.status(403).json({ error: "project access denied" });
    return undefined;
  }

  return projectId;
}
