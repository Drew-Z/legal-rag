import assert from "node:assert/strict";
import test from "node:test";
import { parseConfig } from "./env.js";

test("parseConfig enables OpenAI-compatible model and pgvector store", () => {
  const config = parseConfig({
    PORT: "4100",
    WEB_ORIGIN: "http://127.0.0.1:5173",
    MODEL_PROVIDER: "openai-compatible",
    LLM_BASE_URL: "https://models.example.test/v1",
    LLM_API_KEY: "secret",
    LLM_MODEL: "gemini-3.5-flash",
    EMBEDDING_MODEL: "Qwen/Qwen3-Embedding-0.6B",
    EMBEDDING_DIM: "1024",
    VECTOR_STORE: "pgvector",
    DATABASE_URL: "postgresql://postgres:secret@example.test:5432/postgres?sslmode=require"
  });

  assert.equal(config.port, 4100);
  assert.equal(config.webOrigin, "http://127.0.0.1:5173");
  assert.equal(config.modelProvider, "openai-compatible");
  assert.equal(config.vectorStore, "pgvector");
  assert.ok(config.llm);
  assert.equal(config.llm.baseUrl, "https://models.example.test/v1");
  assert.equal(config.llm.model, "gemini-3.5-flash");
  assert.equal(config.embedding.baseUrl, "https://models.example.test/v1");
  assert.equal(config.embedding.apiKey, "secret");
  assert.equal(config.embedding.model, "Qwen/Qwen3-Embedding-0.6B");
  assert.equal(config.embedding.dimensions, 1024);
  assert.ok(config.databaseUrl?.startsWith("postgresql://"));
});

test("parseConfig supports separate embedding gateway credentials", () => {
  const config = parseConfig({
    MODEL_PROVIDER: "openai-compatible",
    LLM_BASE_URL: "https://chat.example.test/v1",
    LLM_API_KEY: "chat-secret",
    LLM_MODEL: "gemini-3.5-flash",
    EMBEDDING_BASE_URL: "https://embedding.example.test/v1",
    EMBEDDING_API_KEY: "embedding-secret",
    EMBEDDING_MODEL: "Qwen3-Embedding-0.6B",
    EMBEDDING_DIM: "1024"
  });

  assert.equal(config.llm?.baseUrl, "https://chat.example.test/v1");
  assert.equal(config.llm?.apiKey, "chat-secret");
  assert.equal(config.embedding.baseUrl, "https://embedding.example.test/v1");
  assert.equal(config.embedding.apiKey, "embedding-secret");
  assert.equal(config.embedding.model, "Qwen3-Embedding-0.6B");
});

test("parseConfig rejects partial embedding gateway overrides", () => {
  assert.throws(
    () =>
      parseConfig({
        MODEL_PROVIDER: "openai-compatible",
        LLM_BASE_URL: "https://chat.example.test/v1",
        LLM_API_KEY: "chat-secret",
        EMBEDDING_API_KEY: "embedding-secret"
      }),
    /EMBEDDING_BASE_URL is required/
  );

  assert.throws(
    () =>
      parseConfig({
        MODEL_PROVIDER: "openai-compatible",
        LLM_BASE_URL: "https://chat.example.test/v1",
        LLM_API_KEY: "chat-secret",
        EMBEDDING_BASE_URL: "https://embedding.example.test/v1"
      }),
    /EMBEDDING_API_KEY is required/
  );
});

test("parseConfig keeps mock defaults without secrets", () => {
  const config = parseConfig({});

  assert.equal(config.modelProvider, "mock");
  assert.equal(config.vectorStore, "memory");
  assert.equal(config.llm, undefined);
  assert.equal(config.embedding.model, "mock");
  assert.equal(config.embedding.dimensions, 96);
  assert.equal(config.databaseUrl, undefined);
});
