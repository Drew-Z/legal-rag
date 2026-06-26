import { readFileSync } from "node:fs";

export interface AppConfig {
  port: number;
  webOrigin: string;
  modelProvider: "mock" | "openai-compatible";
  vectorStore: "memory" | "pgvector";
  databaseUrl?: string;
  auth?: {
    enabled: boolean;
    email: string;
    name: string;
    password?: string;
    users: Array<{
      email: string;
      name: string;
      password?: string;
    }>;
    sessionSecret?: string;
    cookieName: string;
    secureCookie: boolean;
    cookieSameSite: "Lax" | "Strict" | "None";
    sessionTtlHours: number;
  };
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
  const auth = parseAuthConfig(env);

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
      auth,
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
    auth,
    embedding: {
      model: "mock",
      dimensions: 96
    }
  };
}

function parseAuthConfig(env: NodeJS.ProcessEnv): NonNullable<AppConfig["auth"]> {
  const enabled = env.AUTH_ENABLED === "true";
  const sessionTtlHours = Number(env.AUTH_SESSION_TTL_HOURS ?? 8);
  const cookieSameSite = parseCookieSameSite(env.AUTH_COOKIE_SAME_SITE);
  const users = parseAuthUsers(env);

  if (!Number.isFinite(sessionTtlHours) || sessionTtlHours <= 0) {
    throw new Error("AUTH_SESSION_TTL_HOURS must be a positive number");
  }

  if (enabled) {
    if (!env.AUTH_PASSWORD && !env.AUTH_USERS_JSON) {
      throw new Error("AUTH_PASSWORD or AUTH_USERS_JSON is required when AUTH_ENABLED=true");
    }

    if (users.some((user) => !user.password)) {
      throw new Error("All configured auth users must include password when AUTH_ENABLED=true");
    }

    if (!env.AUTH_SESSION_SECRET || env.AUTH_SESSION_SECRET.length < 16) {
      throw new Error("AUTH_SESSION_SECRET must be at least 16 characters when AUTH_ENABLED=true");
    }
  }

  return {
    enabled,
    email: env.AUTH_EMAIL ?? "demo@legal-rag.local",
    name: env.AUTH_NAME ?? "演示用户",
    password: env.AUTH_PASSWORD,
    users,
    sessionSecret: env.AUTH_SESSION_SECRET,
    cookieName: env.AUTH_COOKIE_NAME ?? "legal_rag_session",
    secureCookie: env.AUTH_COOKIE_SECURE === "true",
    cookieSameSite,
    sessionTtlHours
  };
}

function parseAuthUsers(env: NodeJS.ProcessEnv): NonNullable<AppConfig["auth"]>["users"] {
  if (env.AUTH_USERS_JSON) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(env.AUTH_USERS_JSON);
    } catch {
      throw new Error("AUTH_USERS_JSON must be valid JSON");
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("AUTH_USERS_JSON must be a non-empty JSON array");
    }
    return parsed.map((user) => {
      if (!user || typeof user !== "object") {
        throw new Error("AUTH_USERS_JSON users must be objects");
      }
      const rawUser = user as Record<string, unknown>;
      if (typeof rawUser.email !== "string" || typeof rawUser.name !== "string") {
        throw new Error("AUTH_USERS_JSON users must include email and name");
      }
      if (rawUser.password !== undefined && typeof rawUser.password !== "string") {
        throw new Error("AUTH_USERS_JSON user password must be a string");
      }
      return {
        email: rawUser.email,
        name: rawUser.name,
        password: rawUser.password
      };
    });
  }

  return [
    {
      email: env.AUTH_EMAIL ?? "demo@legal-rag.local",
      name: env.AUTH_NAME ?? "演示用户",
      password: env.AUTH_PASSWORD
    }
  ];
}

function parseCookieSameSite(value: string | undefined): "Lax" | "Strict" | "None" {
  if (!value) {
    return "Lax";
  }

  if (value === "Lax" || value === "Strict" || value === "None") {
    return value;
  }

  throw new Error("AUTH_COOKIE_SAME_SITE must be one of Lax, Strict, or None");
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
