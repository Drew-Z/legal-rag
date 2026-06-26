import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RagAnswer } from "@legal-rag/shared";
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

export interface EvalResult {
  id: string;
  passed: boolean;
  reason: string;
  citationText: string;
  answer: string;
}

export interface EvalSummary {
  total: number;
  passed: number;
  failed: number;
  answerableCases: number;
  refusalCases: number;
  results: EvalResult[];
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
  const results: EvalResult[] = [];

  for (const item of evalCases) {
    const answer = await rag.answerQuestion(item.question, 5);
    results.push(evaluateAnswer(item, answer));
  }

  const passed = results.filter((result) => result.passed).length;
  const answerableCases = evalCases.filter((item) => item.shouldAnswer).length;

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    answerableCases,
    refusalCases: evalCases.length - answerableCases,
    results
  };
}

export async function loadEvalCases(): Promise<EvalCase[]> {
  return JSON.parse(await readFile(EVAL_SET_PATH, "utf8")) as EvalCase[];
}

function evaluateAnswer(item: EvalCase, answer: RagAnswer): EvalResult {
  const citationText = answer.citations
    .map((citation) => `${citation.title} ${citation.section} ${citation.quote}`)
    .join("\n");

  if (!item.shouldAnswer) {
    const refused = REFUSAL_PATTERN.test(answer.answer) && answer.citations.length === 0;
    return {
      id: item.id,
      passed: refused,
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
    reason: passed ? "matched expected citation hints" : `missing citation hints: ${missingHints.join(", ")}`,
    citationText,
    answer: answer.answer
  };
}
