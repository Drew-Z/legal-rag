import assert from "node:assert/strict";
import test from "node:test";
import { buildReviewEvaluationReport } from "./review-eval-service.js";

test("buildReviewEvaluationReport summarizes labeled contract review recall", async () => {
  const report = await buildReviewEvaluationReport();

  assert.equal(report.total, 5);
  assert.equal(report.passed, 5);
  assert.equal(report.failed, 0);
  assert.equal(report.recall, 1);
  assert.ok(report.results.every((result) => result.matchedRisks.length > 0));
  assert.ok(report.results.some((result) => result.expectedRisks.includes("违约责任")));
});
