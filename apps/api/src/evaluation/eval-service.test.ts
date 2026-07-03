import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { loadEvalCases } from "./eval-service.js";

test("loadEvalCases returns an empty set when the deployed eval file is missing", async () => {
  const cases = await loadEvalCases(resolve("eval", "missing-rag-eval-set.json"));

  assert.deepEqual(cases, []);
});
