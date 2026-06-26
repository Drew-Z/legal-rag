import { createServer } from "node:http";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";

const config = loadConfig();
type PgvectorRagResponse = {
  answer: string;
  citations: unknown[];
  diagnostics?: { vectorCandidates?: number; answerSource?: "model" | "fallback" | "refusal" };
};

if (config.vectorStore !== "pgvector") {
  throw new Error("VECTOR_STORE=pgvector is required for validate:pgvector");
}

const first = await startServer();
try {
  const health = await first.getJson<{ ok: boolean; vectorStore: string; embeddingModel: string }>("/api/health");
  assert(health.ok, "health check failed");
  assert(health.vectorStore === "pgvector", "expected pgvector store");

  const seeded = await first.postJson<{ imported: number; duplicates: number; documents: unknown[] }>("/api/datasets/seed", {});
  assert(seeded.imported + seeded.duplicates > 0, "expected seeded or duplicate documents");

  const imported = await first.postJson<{
    documentId: string;
    chunkCount: number;
    document: { id: string; title: string };
  }>("/api/documents/import-text", {
    title: `pgvector restart validation ${Date.now()}`,
    text: "第一条 服务内容\n甲方应支付服务费。\n\n第二条 违约责任\n任一方违约应承担赔偿责任。"
  });
  assert(imported.chunkCount > 0, "expected imported chunks");

  const answer = await queryUntilModelAnswer(first, "违约金过高时能否请求减少？");
  assert(answer.answer.length > 0, "expected answer text");
  assert(answer.citations.length > 0, "expected citations");
  assert((answer.diagnostics?.vectorCandidates ?? 0) > 0, "expected vector candidates");

  await first.close();

  const second = await startServer();
  try {
    const documents = await second.getJson<{ documents: Array<{ id: string; title: string; chunkCount: number }> }>(
      "/api/documents"
    );
    const persisted = documents.documents.find((document) => document.id === imported.documentId);
    assert(persisted, "expected imported document to persist after restart");
    assert(persisted.chunkCount === imported.chunkCount, "persisted chunk count mismatch");

    const chunks = await second.getJson<{ chunks: unknown[] }>(`/api/documents/${imported.documentId}/chunks`);
    assert(chunks.chunks.length === imported.chunkCount, "expected persisted chunks after restart");

    const restartedAnswer = await queryUntilModelAnswer(second, "违约责任是否合理？");
    assert(restartedAnswer.answer.length > 0, "expected answer text after restart");
    assert(restartedAnswer.citations.length > 0, "expected citations after restart");

    console.log("pgvector validation passed");
  } finally {
    await second.close();
  }
} finally {
  await first.close().catch(() => {});
}

async function queryUntilModelAnswer(
  client: Awaited<ReturnType<typeof startServer>>,
  question: string
): Promise<PgvectorRagResponse> {
  let latest: PgvectorRagResponse | undefined;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    latest = await client.postJson<PgvectorRagResponse>("/api/rag/query", {
      question,
      topK: 5
    });
    if (latest.diagnostics?.answerSource === "model") {
      return latest;
    }
    await delay(700 * attempt);
  }

  throw new Error(`expected real chat model answer, got ${latest?.diagnostics?.answerSource ?? "unknown"}`);
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function startServer() {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const app = await createApp(config);
    const server = createServer(app);

    await new Promise<void>((resolveReady) => {
      server.listen(0, "127.0.0.1", resolveReady);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      await closeServer(server);
      throw new Error("Failed to start pgvector validation server");
    }

    if (isFetchBlockedPort(address.port)) {
      await closeServer(server);
      continue;
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    return {
      getJson: async <T>(path: string): Promise<T> => {
        const response = await fetch(`${baseUrl}${path}`);
        return response.json() as Promise<T>;
      },
      postJson: async <T>(path: string, body: unknown): Promise<T> => {
        const response = await fetch(`${baseUrl}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });
        return response.json() as Promise<T>;
      },
      close: async () => closeServer(server)
    };
  }

  throw new Error("Failed to start pgvector validation server on a fetch-safe port");
}

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
}

function isFetchBlockedPort(port: number): boolean {
  return port === 6000 || (port >= 6665 && port <= 6669) || port === 6697 || port === 10080;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
