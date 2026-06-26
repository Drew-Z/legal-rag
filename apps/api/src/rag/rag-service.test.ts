import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentChunk, ScoredChunk } from "@legal-rag/shared";
import type { EmbeddingProvider } from "../embeddings/provider.js";
import type { ChatProvider } from "../model-providers/openai-compatible.js";
import type { VectorStore } from "../vector-store/types.js";
import { RagService } from "./rag-service.js";

test("RagService falls back to local answer when chat provider fails", async () => {
  const chunk = scoredChunk({
    section: "第五百八十五条",
    content: "第五百八十五条 约定的违约金过分高于造成的损失的，当事人可以请求适当减少。"
  });
  const embeddings: EmbeddingProvider = {
    async embedText() {
      return [1, 0, 0];
    },
    async embedBatch() {
      return [[1, 0, 0]];
    }
  };
  const vectorStore: VectorStore = {
    async upsertChunks() {},
    async similaritySearch() {
      return [{ ...chunk, vectorScore: 0.9 }];
    },
    async keywordSearch() {
      return [{ ...chunk, keywordScore: 0.9 }];
    }
  };
  const chatProvider: ChatProvider = {
    async generateAnswer() {
      throw new Error("model unavailable");
    }
  };

  const answer = await new RagService(embeddings, vectorStore, chatProvider).answerQuestion("违约金过高怎么办？");

  assert.match(answer.answer, /根据当前资料/);
  assert.equal(answer.citations.length, 1);
});

function scoredChunk(overrides: Pick<DocumentChunk, "section" | "content">): ScoredChunk {
  return {
    id: "chunk_1",
    documentId: "doc_1",
    title: "民法典合同编公开知识片段",
    content: overrides.content,
    chunkIndex: 0,
    page: 1,
    section: overrides.section,
    tokenEstimate: 20,
    metadata: {
      source: "民法典合同编公开知识片段",
      projectId: "project_default",
      page: 1,
      section: overrides.section,
      chunkIndex: 0,
      tokenEstimate: 20
    },
    score: 0.9
  };
}
