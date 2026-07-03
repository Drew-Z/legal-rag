import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { EvaluationReport, EvaluationResult, RagAnswer } from "@legal-rag/shared";
import { seedPublicSafeDataset } from "../datasets/dataset-service.js";
import { DocumentIngestionService } from "../documents/ingestion-service.js";
import { MockEmbeddingProvider } from "../embeddings/provider.js";
import { RagService } from "../rag/rag-service.js";
import { Repository } from "../store/repository.js";
import { MemoryVectorStore } from "../vector-store/memory.js";

export interface EvalCase {
  id: string;
  question: string;
  shouldAnswer: boolean;
  expectedTopic: string;
  expectedCitationHints: string[];
}

export interface EvalSummary {
  total: number;
  passed: number;
  failed: number;
  answerableCases: number;
  refusalCases: number;
  citationAccuracy: number;
  answerableAccuracy: number;
  refusalAccuracy: number;
  results: EvaluationResult[];
}

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const EVAL_SET_PATH = resolve(CURRENT_DIR, "..", "..", "..", "..", "eval", "rag-eval-set.json");
const REFUSAL_PATTERN = /无法确认|请先导入/;

export async function runMockRagEvaluation(): Promise<EvalSummary> {
  const repository = new Repository();
  const embeddings = new MockEmbeddingProvider();
  const vectorStore = new MemoryVectorStore();
  const ingestion = new DocumentIngestionService(repository, embeddings, vectorStore);
  const rag = new RagService(embeddings, vectorStore);

  await seedPublicSafeDataset(ingestion);

  const evalCases = await loadEvalCases();
  const results: EvaluationResult[] = [];

  for (const item of evalCases) {
    const answer = await rag.answerQuestion(item.question, 5);
    results.push(evaluateAnswer(item, answer));
  }

  const passed = results.filter((result) => result.passed).length;
  const answerableCases = evalCases.filter((item) => item.shouldAnswer).length;
  const answerableResults = results.filter((result) => result.kind === "answerable");
  const refusalResults = results.filter((result) => result.kind === "refusal");

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    answerableCases,
    refusalCases: evalCases.length - answerableCases,
    citationAccuracy: ratio(answerableResults.filter((result) => result.citationHit).length, answerableResults.length),
    answerableAccuracy: ratio(answerableResults.filter((result) => result.passed).length, answerableResults.length),
    refusalAccuracy: ratio(refusalResults.filter((result) => result.refused).length, refusalResults.length),
    results
  };
}

export async function buildEvaluationReport(): Promise<EvaluationReport> {
  const summary = await runMockRagEvaluation();

  return {
    generatedAt: new Date().toISOString(),
    total: summary.total,
    passed: summary.passed,
    failed: summary.failed,
    answerableCases: summary.answerableCases,
    refusalCases: summary.refusalCases,
    citationAccuracy: summary.citationAccuracy,
    answerableAccuracy: summary.answerableAccuracy,
    refusalAccuracy: summary.refusalAccuracy,
    results: summary.results
  };
}

export async function loadEvalCases(evalSetPath = EVAL_SET_PATH): Promise<EvalCase[]> {
  try {
    return JSON.parse(await readFile(evalSetPath, "utf8")) as EvalCase[];
  } catch (error) {
    if (isMissingFileError(error)) {
      console.warn(`[quality] RAG eval set missing at ${evalSetPath}; returning an unavailable evaluation report.`);
      return [];
    }

    throw error;
  }
}

function evaluateAnswer(item: EvalCase, answer: RagAnswer): EvaluationResult {
  const citationText = answer.citations
    .map((citation) => `${citation.title} ${citation.section} ${citation.quote}`)
    .join("\n");

  if (!item.shouldAnswer) {
    const refused = REFUSAL_PATTERN.test(answer.answer) && answer.citations.length === 0;
    return {
      id: item.id,
      passed: refused,
      kind: "refusal",
      expectedTopic: item.expectedTopic,
      citationHit: false,
      refused,
      reason: refused ? "refused as expected" : "expected refusal without citations",
      citationText,
      answer: answer.answer
    };
  }

  const missingHints = item.expectedCitationHints.filter((hint) => !citationText.includes(hint));
  const passed = answer.citations.length > 0 && missingHints.length === 0 && !REFUSAL_PATTERN.test(answer.answer);

  return {
    id: item.id,
    passed,
    kind: "answerable",
    expectedTopic: item.expectedTopic,
    citationHit: missingHints.length === 0 && answer.citations.length > 0,
    refused: REFUSAL_PATTERN.test(answer.answer),
    reason: passed ? "matched expected citation hints" : `missing citation hints: ${missingHints.join(", ")}`,
    citationText,
    answer: answer.answer
  };
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(4));
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}
