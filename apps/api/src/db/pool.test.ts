import assert from "node:assert/strict";
import test from "node:test";
import { createPool } from "./pool.js";

test("createPool keeps Supabase sslmode=require compatible with self-signed chains", async () => {
  const pool = createPool("postgresql://postgres:secret@example.test:5432/postgres?sslmode=require");

  try {
    assert.deepEqual(pool.options.ssl, { rejectUnauthorized: false });
    assert.equal(pool.options.connectionString, "postgresql://postgres:secret@example.test:5432/postgres");
  } finally {
    await pool.end();
  }
});

test("createPool enables SSL for Supabase pooler URLs even when sslmode is omitted", async () => {
  const pool = createPool("postgresql://postgres.project-ref:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres");

  try {
    assert.deepEqual(pool.options.ssl, { rejectUnauthorized: false });
    assert.equal(
      pool.options.connectionString,
      "postgresql://postgres.project-ref:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
    );
  } finally {
    await pool.end();
  }
});
