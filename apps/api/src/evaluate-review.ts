import { buildReviewEvaluationReport } from "./review/review-eval-service.js";

const summary = await buildReviewEvaluationReport();

for (const result of summary.results.filter((item) => !item.passed)) {
  console.error(`[FAIL] ${result.id}: missing risks ${result.missingRisks.join(", ")}`);
  console.error(`  expected: ${result.expectedRisks.join(", ")}`);
  console.error(`  actual: ${result.actualRisks.join(", ") || "(none)"}`);
}

console.log(`Contract review eval passed ${summary.passed}/${summary.total}`);

if (summary.failed > 0) {
  process.exitCode = 1;
}
