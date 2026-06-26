import assert from "node:assert/strict";
import test from "node:test";
import { toPgVectorLiteral } from "./pgvector.js";

test("toPgVectorLiteral serializes finite vectors for pgvector", () => {
  assert.equal(toPgVectorLiteral([0.1, -0.2, 3]), "[0.1,-0.2,3]");
});

test("toPgVectorLiteral rejects non-finite values", () => {
  assert.throws(() => toPgVectorLiteral([0.1, Number.NaN]), /finite numbers/);
  assert.throws(() => toPgVectorLiteral([Number.POSITIVE_INFINITY]), /finite numbers/);
});
