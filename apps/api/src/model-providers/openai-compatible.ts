import type { ScoredChunk } from "@legal-rag/shared";
import type { EmbeddingProvider } from "../embeddings/provider.js";

interface OpenAICompatibleOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}

interface EmbeddingOptions extends OpenAICompatibleOptions {
  dimensions: number;
}

interface GenerateAnswerInput {
  question: string;
  chunks: Array<Pick<ScoredChunk, "section" | "content">>;
}

export interface ChatProvider {
  generateAnswer(input: GenerateAnswerInput): Promise<string>;
}

export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly options: EmbeddingOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
  }

  async embedText(text: string): Promise<number[]> {
    const [embedding] = await this.embedBatch([text]);
    if (!embedding) {
      throw new Error("Embedding response did not include a vector");
    }
    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.fetchImpl(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.options.model,
        input: texts.length === 1 ? texts[0] : texts
      })
    });
    const body = await parseJsonResponse<EmbeddingResponse>(response, "embedding");
    const embeddings = body.data.map((item) => item.embedding);

    for (const embedding of embeddings) {
      if (embedding.length !== this.options.dimensions) {
        throw new Error(`Embedding model ${this.options.model} expected ${this.options.dimensions} dimensions, got ${embedding.length}`);
      }
    }

    return embeddings;
  }

  private headers(): Headers {
    return new Headers({
      authorization: `Bearer ${this.options.apiKey}`,
      "content-type": "application/json"
    });
  }
}

export class OpenAICompatibleChatProvider implements ChatProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly options: OpenAICompatibleOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
  }

  async generateAnswer(input: GenerateAnswerInput): Promise<string> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.options.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "你是法律合同 RAG 助手。只能基于用户提供的资料回答；不要编造资料外事实；回答要简洁，并提醒用户关键法律判断需专业复核。"
          },
          {
            role: "user",
            content: buildGroundedPrompt(input)
          }
        ]
      })
    });
    const body = await parseJsonResponse<ChatCompletionResponse>(response, "chat completion");
    return body.choices[0]?.message?.content?.trim() ?? "根据当前资料无法确认。";
  }

  private headers(): Headers {
    return new Headers({
      authorization: `Bearer ${this.options.apiKey}`,
      "content-type": "application/json"
    });
  }
}

function buildGroundedPrompt(input: GenerateAnswerInput): string {
  const evidence = input.chunks
    .map((chunk, index) => `资料 ${index + 1}｜${chunk.section}\n${chunk.content}`)
    .join("\n\n");

  return [
    `问题：${input.question}`,
    "可用资料：",
    evidence,
    "请基于可用资料回答。若资料不足，请说“根据当前资料无法确认”。"
  ].join("\n\n");
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI-compatible ${label} request failed: ${response.status} ${text.slice(0, 300)}`);
  }

  return JSON.parse(text) as T;
}

interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
  }>;
}

interface ChatCompletionResponse {
  choices: Array<{
    message?: {
      content?: string;
    };
  }>;
}
