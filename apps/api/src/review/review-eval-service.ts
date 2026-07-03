import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReviewEvaluationReport, ReviewEvaluationResult } from "@legal-rag/shared";
import { splitIntoChunks } from "../chunks/splitter.js";
import { reviewContract } from "./review-service.js";

interface ReviewEvalCase {
  id: string;
  title: string;
  text: string;
  expectedRisks: string[];
}

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const REVIEW_EVAL_SET_PATH = resolve(CURRENT_DIR, "..", "..", "..", "..", "eval", "contract-review-eval-set.json");

export async function buildReviewEvaluationReport(): Promise<ReviewEvaluationReport> {
  const cases = await loadReviewEvalCases();
  const results = cases.map(evaluateReviewCase);
  const passed = results.filter((result) => result.passed).length;
  const expectedRiskCount = results.reduce((sum, result) => sum + result.expectedRisks.length, 0);
  const matchedRiskCount = results.reduce((sum, result) => sum + result.matchedRisks.length, 0);

  return {
    generatedAt: new Date().toISOString(),
    total: results.length,
    passed,
    failed: results.length - passed,
    expectedRiskCount,
    matchedRiskCount,
    recall: ratio(matchedRiskCount, expectedRiskCount),
    results
  };
}

export async function loadReviewEvalCases(reviewEvalSetPath = REVIEW_EVAL_SET_PATH): Promise<ReviewEvalCase[]> {
  try {
    return JSON.parse(await readFile(reviewEvalSetPath, "utf8")) as ReviewEvalCase[];
  } catch (error) {
    if (isMissingFileError(error)) {
      console.warn(`[quality] Contract review eval set missing at ${reviewEvalSetPath}; returning an unavailable evaluation report.`);
      return [];
    }

    throw error;
  }
}

function evaluateReviewCase(item: ReviewEvalCase): ReviewEvaluationResult {
  const chunks = splitIntoChunks({
    documentId: item.id,
    title: item.title,
    text: item.text
  });
  const review = reviewContract(chunks);
  const actualRisks = review.risks.map((risk) => risk.clause);
  const matchedRisks = item.expectedRisks.filter((expectedRisk) =>
    actualRisks.some((actualRisk) => actualRisk.includes(expectedRisk))
  );
  const missingRisks = item.expectedRisks.filter((expectedRisk) => !matchedRisks.includes(expectedRisk));

  return {
    id: item.id,
    title: item.title,
    passed: missingRisks.length === 0,
    expectedRisks: item.expectedRisks,
    matchedRisks,
    missingRisks,
    actualRisks,
    markdown: review.markdown
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
