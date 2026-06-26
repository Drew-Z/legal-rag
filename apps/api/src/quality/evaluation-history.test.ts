import assert from "node:assert/strict";
import test from "node:test";
import type { QualityReport } from "@legal-rag/shared";
import { MemoryEvaluationHistoryStore } from "./evaluation-history.js";

test("MemoryEvaluationHistoryStore records recent quality reports", () => {
  const store = new MemoryEvaluationHistoryStore();
  const first = sampleReport("2026-06-26T00:00:00.000Z", 10);
  const second = sampleReport("2026-06-26T00:01:00.000Z", 11);

  store.record(first);
  store.record(second);

  const points = store.list();
  assert.equal(points.length, 2);
  assert.equal(points[0]?.generatedAt, second.generatedAt);
  assert.equal(points[0]?.documentCount, 11);
  assert.equal(points[0]?.ragPassed, 50);
  assert.equal(points[0]?.reviewRecall, 1);
});

function sampleReport(generatedAt: string, documentCount: number): QualityReport {
  return {
    generatedAt,
    runtime: {
      modelProvider: "mock",
      vectorStore: "memory",
      embeddingModel: "mock",
      documentCount,
      chunkCount: 40
    },
    eval: {
      total: 50,
      passed: 50,
      failed: 0,
      answerableCases: 45,
      refusalCases: 5,
      citationAccuracy: 1,
      answerableAccuracy: 1,
      refusalAccuracy: 1
    },
    reviewEval: {
      total: 5,
      passed: 5,
      failed: 0,
      expectedRiskCount: 5,
      matchedRiskCount: 5,
      recall: 1
    },
    checks: []
  };
}

