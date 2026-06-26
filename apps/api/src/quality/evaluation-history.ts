import type { QualityReport, QualityTrendPoint } from "@legal-rag/shared";
import type { Queryable } from "../db/pool.js";

export interface EvaluationHistoryStore {
  record(report: QualityReport): void | Promise<void>;
  list(limit?: number): QualityTrendPoint[] | Promise<QualityTrendPoint[]>;
}

export class MemoryEvaluationHistoryStore implements EvaluationHistoryStore {
  private readonly points: QualityTrendPoint[] = [];

  record(report: QualityReport): void {
    this.points.unshift(toTrendPoint(report));
    this.points.splice(50);
  }

  list(limit = 20): QualityTrendPoint[] {
    return this.points.slice(0, limit);
  }
}

export class PgEvaluationHistoryStore implements EvaluationHistoryStore {
  constructor(private readonly db: Queryable) {}

  async record(report: QualityReport): Promise<void> {
    const point = toTrendPoint(report);
    await this.db.query(
      `
      INSERT INTO evaluation_runs (
        id, generated_at, model_provider, vector_store, embedding_model, chat_model,
        document_count, chunk_count, rag_passed, rag_total, citation_accuracy,
        refusal_accuracy, review_passed, review_total, review_recall
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        point.id,
        point.generatedAt,
        point.modelProvider,
        point.vectorStore,
        point.embeddingModel,
        point.chatModel,
        point.documentCount,
        point.chunkCount,
        point.ragPassed,
        point.ragTotal,
        point.citationAccuracy,
        point.refusalAccuracy,
        point.reviewPassed,
        point.reviewTotal,
        point.reviewRecall
      ]
    );
  }

  async list(limit = 20): Promise<QualityTrendPoint[]> {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const result = await this.db.query(
      `
      SELECT *
      FROM evaluation_runs
      ORDER BY generated_at DESC
      LIMIT $1
      `,
      [safeLimit]
    );
    return result.rows.map(rowToTrendPoint);
  }
}

function toTrendPoint(report: QualityReport): QualityTrendPoint {
  return {
    id: `eval_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    generatedAt: report.generatedAt,
    modelProvider: report.runtime.modelProvider,
    vectorStore: report.runtime.vectorStore,
    embeddingModel: report.runtime.embeddingModel,
    chatModel: report.runtime.chatModel,
    documentCount: report.runtime.documentCount,
    chunkCount: report.runtime.chunkCount,
    ragPassed: report.eval.passed,
    ragTotal: report.eval.total,
    citationAccuracy: report.eval.citationAccuracy,
    refusalAccuracy: report.eval.refusalAccuracy,
    reviewPassed: report.reviewEval.passed,
    reviewTotal: report.reviewEval.total,
    reviewRecall: report.reviewEval.recall
  };
}

function rowToTrendPoint(row: Record<string, unknown>): QualityTrendPoint {
  return {
    id: String(row.id),
    generatedAt: toIsoString(row.generated_at),
    modelProvider: row.model_provider as QualityTrendPoint["modelProvider"],
    vectorStore: row.vector_store as QualityTrendPoint["vectorStore"],
    embeddingModel: String(row.embedding_model),
    chatModel: optionalString(row.chat_model),
    documentCount: Number(row.document_count),
    chunkCount: Number(row.chunk_count),
    ragPassed: Number(row.rag_passed),
    ragTotal: Number(row.rag_total),
    citationAccuracy: Number(row.citation_accuracy),
    refusalAccuracy: Number(row.refusal_accuracy),
    reviewPassed: Number(row.review_passed),
    reviewTotal: Number(row.review_total),
    reviewRecall: Number(row.review_recall)
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

