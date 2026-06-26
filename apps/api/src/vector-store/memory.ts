import type { DocumentChunk, ScoredChunk } from "@legal-rag/shared";
import type { SearchFilter, StoredChunk, VectorStore } from "./types.js";

export class MemoryVectorStore implements VectorStore {
  private readonly chunks = new Map<string, StoredChunk>();

  async upsertChunks(items: StoredChunk[]): Promise<void> {
    for (const item of items) {
      this.chunks.set(item.chunk.id, item);
    }
  }

  async similaritySearch(queryEmbedding: number[], topK: number, filter?: SearchFilter): Promise<ScoredChunk[]> {
    return [...this.chunks.values()]
      .filter((item) => matchesFilter(item.chunk, filter))
      .map((item) => ({
        ...item.chunk,
        score: cosineSimilarity(queryEmbedding, item.embedding),
        vectorScore: cosineSimilarity(queryEmbedding, item.embedding)
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, topK);
  }

  async keywordSearch(query: string, topK: number, filter?: SearchFilter): Promise<ScoredChunk[]> {
    const queryTerms = extractTerms(query);
    if (queryTerms.length === 0) {
      return [];
    }

    return [...this.chunks.values()]
      .filter((item) => matchesFilter(item.chunk, filter))
      .map((item) => {
        const haystack = `${item.chunk.title}\n${item.chunk.section}\n${item.chunk.content}`;
        const keywordScore = scoreKeywords(queryTerms, haystack);
        return {
          ...item.chunk,
          score: keywordScore,
          keywordScore
        };
      })
      .filter((chunk) => (chunk.keywordScore ?? 0) > 0)
      .sort((left, right) => (right.keywordScore ?? 0) - (left.keywordScore ?? 0))
      .slice(0, topK);
  }
}

function matchesFilter(chunk: DocumentChunk, filter?: SearchFilter): boolean {
  return !filter?.projectId || chunk.metadata.projectId === filter.projectId;
}

function cosineSimilarity(left: number[], right: number[]): number {
  const size = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < size; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function extractTerms(query: string): string[] {
  const normalized = query.toLowerCase();
  const rawTerms = normalized.match(/[\u4e00-\u9fff]{2,8}|[a-z0-9]+/gi) ?? [];
  const legalTerms = [
    "合同",
    "履行",
    "诚信原则",
    "通知",
    "协助",
    "违约责任",
    "违约金",
    "付款",
    "支付",
    "费用",
    "结算",
    "交付",
    "验收",
    "知识产权",
    "保密",
    "争议解决",
    "管辖",
    "竞业限制",
    "试用期",
    "服务期",
    "数据安全",
    "服务可用性",
    "数据与隐私",
    "隐私",
    "数据",
    "泄露通知",
    "采购标的",
    "授权限制",
    "维护服务",
    "服务范围",
    "服务内容",
    "履行期限",
    "报酬",
    "人员管理",
    "劳务外包",
    "外包",
    "劳动关系",
    "社保责任",
    "合规用工",
    "解除条款",
    "费用结算",
    "争议金额",
    "责任上限",
    "书面劳动合同",
    "商业秘密"
  ].filter((term) => normalized.includes(term));

  return [...new Set([...rawTerms, ...legalTerms])];
}

function scoreKeywords(terms: string[], haystack: string): number {
  let score = 0;
  for (const term of terms) {
    const matches = haystack.match(new RegExp(escapeRegExp(term), "gi"))?.length ?? 0;
    if (matches > 0) {
      score += Math.min(matches, 3) * (term.length >= 4 ? 0.18 : 0.1);
    }
  }
  return Number(score.toFixed(4));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
