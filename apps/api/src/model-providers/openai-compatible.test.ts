import assert from "node:assert/strict";
import test from "node:test";
import {
  OpenAICompatibleChatProvider,
  OpenAICompatibleEmbeddingProvider
} from "./openai-compatible.js";

test("OpenAICompatibleEmbeddingProvider reads embedding vectors", async () => {
  const requests: Array<{ url: string; body: unknown; authorization?: string }> = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    requests.push({
      url: String(url),
      body: JSON.parse(String(init?.body)),
      authorization: init?.headers instanceof Headers ? init.headers.get("authorization") ?? undefined : undefined
    });

    return jsonResponse({
      data: [
        {
          embedding: [0.1, 0.2, 0.3]
        }
      ]
    });
  };

  const provider = new OpenAICompatibleEmbeddingProvider({
    baseUrl: "https://models.example.test/v1",
    apiKey: "secret",
    model: "Qwen/Qwen3-Embedding-0.6B",
    dimensions: 3,
    fetchImpl
  });

  const embedding = await provider.embedText("合同违约责任");

  assert.deepEqual(embedding, [0.1, 0.2, 0.3]);
  assert.equal(requests[0]?.url, "https://models.example.test/v1/embeddings");
  assert.equal(requests[0]?.authorization, "Bearer secret");
  assert.deepEqual(requests[0]?.body, {
    model: "Qwen/Qwen3-Embedding-0.6B",
    input: "合同违约责任"
  });
});

test("OpenAICompatibleEmbeddingProvider rejects unexpected dimensions", async () => {
  const fetchImpl: typeof fetch = async () =>
    jsonResponse({
      data: [
        {
          embedding: [0.1, 0.2]
        }
      ]
    });

  const provider = new OpenAICompatibleEmbeddingProvider({
    baseUrl: "https://models.example.test/v1",
    apiKey: "secret",
    model: "Qwen/Qwen3-Embedding-0.6B",
    dimensions: 3,
    fetchImpl
  });

  await assert.rejects(() => provider.embedText("合同"), /expected 3 dimensions, got 2/);
});

test("OpenAICompatibleChatProvider generates grounded answers", async () => {
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { messages: Array<{ role: string; content: string }> };
    assert.match(body.messages.at(-1)?.content ?? "", /第五百八十五条/);

    return jsonResponse({
      choices: [
        {
          message: {
            content: "根据第五百八十五条，违约金过高时可以请求适当减少。"
          }
        }
      ]
    });
  };

  const provider = new OpenAICompatibleChatProvider({
    baseUrl: "https://models.example.test/v1",
    apiKey: "secret",
    model: "gemini-3.5-flash",
    fetchImpl
  });

  const answer = await provider.generateAnswer({
    question: "违约金过高怎么办？",
    chunks: [
      {
        section: "第五百八十五条",
        content: "约定的违约金过分高于造成的损失的，当事人可以请求适当减少。"
      }
    ]
  });

  assert.match(answer, /违约金过高/);
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}
