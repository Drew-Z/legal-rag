import { runMockRagEvaluation } from "./evaluation/eval-service.js";

const summary = await runMockRagEvaluation();

for (const result of summary.results.filter((item) => !item.passed)) {
  console.error(`[FAIL] ${result.id}: ${result.reason}`);
  console.error(`  answer: ${result.answer}`);
  console.error(`  citations: ${result.citationText || "(none)"}`);
}

console.log(`RAG eval passed ${summary.passed}/${summary.total}`);

if (summary.failed > 0) {
  process.exitCode = 1;
}
