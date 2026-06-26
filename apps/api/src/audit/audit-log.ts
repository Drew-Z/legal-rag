import type { Request } from "express";
import type { AuditAction, AuditLogEntry } from "@legal-rag/shared";
import { getRequestUser } from "../auth/session.js";
import type { DocumentRepository } from "../store/repository.js";

export async function recordAuditLog(
  repository: DocumentRepository,
  request: Request,
  input: {
    projectId?: string;
    action: AuditAction;
    targetType?: AuditLogEntry["targetType"];
    targetId?: string;
    summary: string;
  }
): Promise<void> {
  const user = getRequestUser(request);
  await repository.recordAuditLog({
    id: `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    projectId: input.projectId,
    userEmail: user.email,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    summary: input.summary,
    createdAt: new Date().toISOString()
  });
}
