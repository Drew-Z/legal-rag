import type { ContractRisk, DocumentChunk, ScoredChunk } from "@legal-rag/shared";
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

export interface ContractRiskModelExplanation {
  clause: string;
  issue: string;
  suggestion: string;
  requiresHumanReview?: boolean;
}

interface GenerateContractRiskExplanationsInput {
  chunks: Array<Pick<DocumentChunk, "section" | "content" | "chunkIndex">>;
  risks: Array<Pick<ContractRisk, "clause" | "riskLevel" | "issue" | "suggestion" | "requiresHumanReview">>;
}

export interface ChatProvider {
  generateAnswer(input: GenerateAnswerInput): Promise<string>;
  generateContractRiskExplanations?(
    input: GenerateContractRiskExplanationsInput
  ): Promise<ContractRiskModelExplanation[]>;
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

  async generateContractRiskExplanations(
    input: GenerateContractRiskExplanationsInput
  ): Promise<ContractRiskModelExplanation[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.options.model,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "你是合同审查助手。只能基于已召回的规则风险和合同片段补充解释。必须输出严格 JSON，不要输出 Markdown，不要新增未召回的风险。"
          },
          {
            role: "user",
            content: buildContractReviewPrompt(input)
          }
        ]
      })
    });
    const body = await parseJsonResponse<ChatCompletionResponse>(response, "contract review");
    const content = body.choices[0]?.message?.content ?? "{}";
    return parseContractReviewJson(content);
  }

  private headers(): Headers {
    return new Headers({
      authorization: `Bearer ${this.options.apiKey}`,
      "content-type": "application/json"
    });
  }
}

function buildContractReviewPrompt(input: GenerateContractRiskExplanationsInput): string {
  const risks = input.risks
    .map(
      (risk, index) =>
        `${index + 1}. ${risk.clause}｜${risk.riskLevel}\n规则问题：${risk.issue}\n规则建议：${risk.suggestion}`
    )
    .join("\n\n");
  const evidence = input.chunks
    .slice(0, 8)
    .map((chunk) => `chunk ${chunk.chunkIndex + 1}｜${chunk.section}\n${chunk.content}`)
    .join("\n\n");

  return [
    "请仅针对下列已召回风险补充更自然、专业但简洁的 issue 和 suggestion。",
    "输出 JSON schema：",
    `{"risks":[{"clause":"付款条件","issue":"...","suggestion":"...","requiresHumanReview":true}]}`,
    "要求：clause 必须与输入风险 clause 一致；不要新增风险；不要输出资料外事实。",
    "已召回风险：",
    risks,
    "合同片段：",
    evidence
  ].join("\n\n");
}

function parseContractReviewJson(content: string): ContractRiskModelExplanation[] {
  const text = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const parsed = JSON.parse(text) as { risks?: unknown };
  if (!Array.isArray(parsed.risks)) {
    throw new Error("contract review response must include risks array");
  }

  return parsed.risks.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("contract review risk must be an object");
    }
    const risk = item as Record<string, unknown>;
    return {
      clause: requireString(risk.clause, "clause"),
      issue: requireString(risk.issue, "issue"),
      suggestion: requireString(risk.suggestion, "suggestion"),
      requiresHumanReview:
        typeof risk.requiresHumanReview === "boolean" ? risk.requiresHumanReview : undefined
    };
  });
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`contract review risk ${field} must be a non-empty string`);
  }
  return value.trim();
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
