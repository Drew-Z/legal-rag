import { readFileSync } from "node:fs";

export interface AppConfig {
  port: number;
  webOrigin: string;
  modelProvider: "mock" | "openai-compatible";
  vectorStore: "memory" | "pgvector";
  databaseUrl?: string;
  llm?: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  embedding: {
    baseUrl?: string;
    apiKey?: string;
    model: string;
    dimensions: number;
  };
}

export function loadConfig(): AppConfig {
  loadDotEnv();
  return parseConfig(process.env);
}

export function parseConfig(env: NodeJS.ProcessEnv): AppConfig {
  const modelProvider = env.MODEL_PROVIDER === "openai-compatible" ? "openai-compatible" : "mock";
  const vectorStore = env.VECTOR_STORE === "pgvector" ? "pgvector" : "memory";
  const embeddingDimensions = Number(env.EMBEDDING_DIM ?? (modelProvider === "mock" ? 96 : 1024));

  if (!Number.isFinite(embeddingDimensions) || embeddingDimensions <= 0) {
    throw new Error("EMBEDDING_DIM must be a positive number");
  }

  if (modelProvider === "openai-compatible") {
    const llm = requiredModelConfig(env);
    const embedding = requiredEmbeddingConfig(env, llm, embeddingDimensions);
    return {
      port: Number(env.PORT ?? 4000),
      webOrigin: env.WEB_ORIGIN ?? "http://localhost:5173",
      modelProvider,
      vectorStore,
      databaseUrl: env.DATABASE_URL,
      llm,
      embedding
    };
  }

  return {
    port: Number(env.PORT ?? 4000),
    webOrigin: env.WEB_ORIGIN ?? "http://localhost:5173",
    modelProvider,
    vectorStore,
    databaseUrl: env.DATABASE_URL,
    embedding: {
      model: "mock",
      dimensions: 96
    }
  };
}

function requiredModelConfig(env: NodeJS.ProcessEnv): NonNullable<AppConfig["llm"]> {
  const baseUrl = env.LLM_BASE_URL?.replace(/\/+$/, "");
  const apiKey = env.LLM_API_KEY;
  const model = env.LLM_MODEL ?? "gemini-3.5-flash-thinking";

  if (!baseUrl) {
    throw new Error("LLM_BASE_URL is required when MODEL_PROVIDER=openai-compatible");
  }

  if (!apiKey) {
    throw new Error("LLM_API_KEY is required when MODEL_PROVIDER=openai-compatible");
  }

  return {
    baseUrl,
    apiKey,
    model
  };
}

function requiredEmbeddingConfig(
  env: NodeJS.ProcessEnv,
  llm: NonNullable<AppConfig["llm"]>,
  dimensions: number
): AppConfig["embedding"] {
  const hasEmbeddingOverride = Boolean(env.EMBEDDING_BASE_URL || env.EMBEDDING_API_KEY);
  const baseUrl = env.EMBEDDING_BASE_URL?.replace(/\/+$/, "") ?? llm.baseUrl;
  const apiKey = env.EMBEDDING_API_KEY ?? llm.apiKey;

  if (hasEmbeddingOverride && !env.EMBEDDING_BASE_URL) {
    throw new Error("EMBEDDING_BASE_URL is required when EMBEDDING_API_KEY is set");
  }

  if (hasEmbeddingOverride && !env.EMBEDDING_API_KEY) {
    throw new Error("EMBEDDING_API_KEY is required when EMBEDDING_BASE_URL is set");
  }

  return {
    baseUrl,
    apiKey,
    model: env.EMBEDDING_MODEL ?? "Qwen/Qwen3-Embedding-0.6B",
    dimensions
  };
}

function loadDotEnv(): void {
  const envPath = new URL("../../.env", import.meta.url);

  try {
    const content = readFileSync(envPath, "utf8");
    const parsed: Record<string, string> = {};
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) {
        continue;
      }
      const [, key, rawValue] = match;
      if (!key) {
        continue;
      }
      parsed[key] = rawValue.replace(/^["']|["']$/g, "");
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env is optional; production deployments usually inject environment variables.
  }
}
