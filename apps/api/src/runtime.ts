import type { AppConfig } from "./config/env.js";
import { createPool } from "./db/pool.js";
import { createPgVectorSchemaSql } from "./db/schema.js";
import type { EmbeddingProvider } from "./embeddings/provider.js";
import { MockEmbeddingProvider } from "./embeddings/provider.js";
import {
  OpenAICompatibleChatProvider,
  OpenAICompatibleEmbeddingProvider,
  type ChatProvider
} from "./model-providers/openai-compatible.js";
import {
  MemoryEvaluationHistoryStore,
  PgEvaluationHistoryStore,
  type EvaluationHistoryStore
} from "./quality/evaluation-history.js";
import { PgRepository } from "./store/pg-repository.js";
import { DEFAULT_PROJECT, type DocumentRepository, Repository } from "./store/repository.js";
import { MemoryVectorStore } from "./vector-store/memory.js";
import { PgVectorStore } from "./vector-store/pgvector.js";
import type { VectorStore } from "./vector-store/types.js";

export interface AppRuntime {
  repository: DocumentRepository;
  embeddings: EmbeddingProvider;
  vectorStore: VectorStore;
  chatProvider?: ChatProvider;
  evaluationHistory: EvaluationHistoryStore;
}

export async function createRuntime(config: AppConfig): Promise<AppRuntime> {
  const embeddings =
    config.modelProvider === "openai-compatible" && config.llm
      ? new OpenAICompatibleEmbeddingProvider({
          baseUrl: config.embedding.baseUrl ?? config.llm.baseUrl,
          apiKey: config.embedding.apiKey ?? config.llm.apiKey,
          model: config.embedding.model,
          dimensions: config.embedding.dimensions
        })
      : new MockEmbeddingProvider();

  const chatProvider =
    config.modelProvider === "openai-compatible" && config.llm
      ? new OpenAICompatibleChatProvider({
          baseUrl: config.llm.baseUrl,
          apiKey: config.llm.apiKey,
          model: config.llm.model
        })
      : undefined;

  if (config.vectorStore === "pgvector") {
    if (!config.databaseUrl) {
      throw new Error("DATABASE_URL is required when VECTOR_STORE=pgvector");
    }
    const pool = createPool(config.databaseUrl);
    await pool.query(createPgVectorSchemaSql(config.embedding.dimensions));
    const repository = new PgRepository(pool);
    await repository.addProject(DEFAULT_PROJECT);
    return {
      repository,
      embeddings,
      vectorStore: new PgVectorStore(pool),
      chatProvider,
      evaluationHistory: new PgEvaluationHistoryStore(pool)
    };
  }

  return {
    repository: new Repository(),
    embeddings,
    vectorStore: new MemoryVectorStore(),
    chatProvider,
    evaluationHistory: new MemoryEvaluationHistoryStore()
  };
}
