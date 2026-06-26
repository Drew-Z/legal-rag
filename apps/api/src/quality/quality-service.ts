import type { AppConfig } from "../config/env.js";
import { runMockRagEvaluation, type EvalSummary } from "../evaluation/eval-service.js";
import type { DocumentRepository } from "../store/repository.js";

export type QualityStatus = "pass" | "warn" | "fail";

export interface QualityCheck {
  id: string;
  label: string;
  status: QualityStatus;
  detail: string;
}

export interface QualityReport {
  generatedAt: string;
  runtime: {
    modelProvider: AppConfig["modelProvider"];
    vectorStore: AppConfig["vectorStore"];
    embeddingModel: string;
    chatModel?: string;
    documentCount: number;
    chunkCount: number;
  };
  eval: Omit<EvalSummary, "results">;
  checks: QualityCheck[];
}

export async function buildQualityReport(
  config: AppConfig,
  repository: DocumentRepository
): Promise<QualityReport> {
  const documents = await repository.listDocuments();
  const chunks = await repository.allChunks();
  const evalSummary = await runMockRagEvaluation();

  return {
    generatedAt: new Date().toISOString(),
    runtime: {
      modelProvider: config.modelProvider,
      vectorStore: config.vectorStore,
      embeddingModel: config.embedding.model,
      chatModel: config.llm?.model,
      documentCount: documents.length,
      chunkCount: chunks.length
    },
    eval: {
      total: evalSummary.total,
      passed: evalSummary.passed,
      failed: evalSummary.failed,
      answerableCases: evalSummary.answerableCases,
      refusalCases: evalSummary.refusalCases,
      citationAccuracy: evalSummary.citationAccuracy,
      answerableAccuracy: evalSummary.answerableAccuracy,
      refusalAccuracy: evalSummary.refusalAccuracy
    },
    checks: [
      runtimeModelCheck(config),
      vectorStoreCheck(config),
      corpusCheck(documents.length, chunks.length),
      evalCheck(evalSummary),
      citationGuardrailCheck(evalSummary)
    ]
  };
}

function runtimeModelCheck(config: AppConfig): QualityCheck {
  if (config.modelProvider === "openai-compatible" && config.llm) {
    return {
      id: "runtime-model",
      label: "真实生成模型",
      status: "pass",
      detail: `已配置 ${config.llm.model}`
    };
  }

  return {
    id: "runtime-model",
    label: "真实生成模型",
    status: "warn",
    detail: "当前使用 mock provider，适合本地演示但不代表真实模型效果"
  };
}

function vectorStoreCheck(config: AppConfig): QualityCheck {
  if (config.vectorStore === "pgvector") {
    return {
      id: "vector-store",
      label: "向量持久化",
      status: "pass",
      detail: "已启用 PostgreSQL + pgvector"
    };
  }

  return {
    id: "vector-store",
    label: "向量持久化",
    status: "warn",
    detail: "当前使用内存向量库，重启后不会保留语料"
  };
}

function corpusCheck(documentCount: number, chunkCount: number): QualityCheck {
  if (documentCount > 0 && chunkCount > 0) {
    return {
      id: "corpus",
      label: "知识库语料",
      status: "pass",
      detail: `${documentCount} 份文档，${chunkCount} 个 chunk 可检索`
    };
  }

  return {
    id: "corpus",
    label: "知识库语料",
    status: "warn",
    detail: "尚未导入文档，问答会缺少引用依据"
  };
}

function evalCheck(evalSummary: EvalSummary): QualityCheck {
  return {
    id: "rag-eval",
    label: "RAG 评测集",
    status: evalSummary.failed === 0 ? "pass" : "fail",
    detail: `${evalSummary.passed}/${evalSummary.total} 通过，可回答准确率 ${formatPercent(evalSummary.answerableAccuracy)}`
  };
}

function citationGuardrailCheck(evalSummary: EvalSummary): QualityCheck {
  return {
    id: "citation-guardrail",
    label: "引用与拒答护栏",
    status: evalSummary.failed === 0 && evalSummary.refusalCases > 0 ? "pass" : "warn",
    detail: `引用命中率 ${formatPercent(evalSummary.citationAccuracy)}，拒答准确率 ${formatPercent(evalSummary.refusalAccuracy)}`
  };
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
