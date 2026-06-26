import { loadConfig } from "../config/env.js";
import { createPool } from "./pool.js";
import { createPgVectorSchemaSql } from "./schema.js";

const config = loadConfig();

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required to run database migrations");
}

const pool = createPool(config.databaseUrl);

try {
  await pool.query(createPgVectorSchemaSql(config.embedding.dimensions));
  console.log(`Database migration completed with vector(${config.embedding.dimensions})`);
} finally {
  await pool.end();
}
