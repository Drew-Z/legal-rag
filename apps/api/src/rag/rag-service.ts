import type { RagAnswer, ScoredChunk } from "@legal-rag/shared";
import { toCitation } from "../citations/citations.js";
import type { EmbeddingProvider } from "../embeddings/provider.js";
import type { ChatProvider } from "../model-providers/openai-compatible.js";
import type { VectorStore } from "../vector-store/types.js";
import { rerankChunks } from "./rerank-service.js";
import { rewriteQuestion } from "./query-rewriter.js";

const MIN_SIMILARITY_SCORE = 0.12;
const RECALL_CANDIDATES = 20;
const MIN_ANSWER_SCORE = 0.18;
const DOMAIN_TERMS = [
  "合同",
  "履行",
  "诚信原则",
  "劳动",
  "劳务外包",
  "外包",
  "试用期",
  "竞业限制",
  "服务期",
  "商业秘密",
  "付款",
  "支付",
  "交付",
  "验收",
  "违约",
  "违约金",
  "赔偿",
  "责任",
  "知识产权",
  "保密",
  "争议",
  "管辖",
  "解除",
  "服务",
  "人员管理",
  "劳动关系",
  "社保责任",
  "合规用工",
  "软件",
  "采购",
  "数据",
  "隐私",
  "个人信息",
  "数据处理",
  "泄露通知",
  "安全审计",
  "分包",
  "SaaS",
  "股权",
  "股权转让",
  "尽职调查",
  "定金",
  "陈述与保证",
  "排他期",
  "租赁",
  "租金",
  "押金",
  "维修",
  "修缮",
  "提前解约",
  "交还验收"
];
const OUT_OF_SCOPE_TERMS = [
  "盗窃罪",
  "量刑",
  "增值税",
  "发票抵扣",
  "delaware",
  "corporation",
  "merger",
  "腰椎",
  "治疗",
  "胜诉"
];

export class RagService {
  constructor(
    private readonly embeddings: EmbeddingProvider,
    private readonly vectorStore: VectorStore,
    private readonly chatProvider?: ChatProvider
  ) {}

  async answerQuestion(question: string, topK = 5, projectId?: string): Promise<RagAnswer> {
    const rewrittenQuestion = rewriteQuestion(question);
    const queryEmbedding = await this.embeddings.embedText(rewrittenQuestion);
    const filter = projectId ? { projectId } : undefined;
    const vectorCandidates = await this.vectorStore.similaritySearch(queryEmbedding, RECALL_CANDIDATES, filter);
    const keywordCandidates = await this.vectorStore.keywordSearch(rewrittenQuestion, RECALL_CANDIDATES, filter);
    const hybridCandidates = mergeCandidates(vectorCandidates, keywordCandidates);
    const filteredChunks = hybridCandidates.filter(
      (chunk) => (chunk.vectorScore ?? 0) >= MIN_SIMILARITY_SCORE || (chunk.keywordScore ?? 0) > 0
    );
    const retrievedChunks = rerankChunks(rewrittenQuestion, filteredChunks, topK);
    const answerable = isAnswerable(rewrittenQuestion, retrievedChunks);
    const answerChunks = answerable ? retrievedChunks : [];
    const citations = answerChunks.slice(0, 3).map(toCitation);
    const { answer, source } = await this.buildAnswerWithFallback(rewrittenQuestion, answerChunks);

    return {
      answer,
      citations,
      retrievedChunks: answerChunks,
      rewrittenQuestion,
      diagnostics: {
        vectorCandidates: vectorCandidates.length,
        keywordCandidates: keywordCandidates.length,
        filteredCandidates: filteredChunks.length,
        rerankedCandidates: retrievedChunks.length,
        minSimilarityScore: MIN_SIMILARITY_SCORE,
        answerSource: source
      }
    };
  }

  private async buildAnswerWithFallback(
    question: string,
    chunks: ScoredChunk[]
  ): Promise<{ answer: string; source: "model" | "fallback" | "refusal" }> {
    if (chunks.length === 0) {
      return {
        answer: buildAnswer(question, chunks),
        source: "refusal"
      };
    }

    if (!this.chatProvider || chunks.length === 0) {
      return {
        answer: buildAnswer(question, chunks),
        source: "fallback"
      };
    }

    try {
      return {
        answer: await this.chatProvider.generateAnswer({ question, chunks }),
        source: "model"
      };
    } catch {
      return {
        answer: buildAnswer(question, chunks),
        source: "fallback"
      };
    }
  }
}

function mergeCandidates(vectorCandidates: ScoredChunk[], keywordCandidates: ScoredChunk[]): ScoredChunk[] {
  const byId = new Map<string, ScoredChunk>();

  for (const chunk of vectorCandidates) {
    byId.set(chunk.id, {
      ...chunk,
      vectorScore: chunk.vectorScore ?? chunk.score,
      keywordScore: 0
    });
  }

  for (const chunk of keywordCandidates) {
    const existing = byId.get(chunk.id);
    if (existing) {
      byId.set(chunk.id, {
        ...existing,
        keywordScore: chunk.keywordScore ?? chunk.score,
        score: Math.max(existing.score, chunk.score)
      });
    } else {
      byId.set(chunk.id, {
        ...chunk,
        vectorScore: 0,
        keywordScore: chunk.keywordScore ?? chunk.score
      });
    }
  }

  return [...byId.values()];
}

function buildAnswer(question: string, chunks: ScoredChunk[]): string {
  if (chunks.length === 0 || chunks.every((chunk) => chunk.score < MIN_ANSWER_SCORE)) {
    return "根据当前资料无法确认。请先导入相关合同或法律文档，再重新提问。";
  }

  const topic = inferTopic(question);
  const strongest = chunks[0];
  const evidence = chunks
    .slice(0, 3)
    .map((chunk) => `「${chunk.section}」中提到：${chunk.content.replace(/\s+/g, " ").slice(0, 90)}...`)
    .join(" ");

  if (topic === "breach") {
    return `根据当前资料，违约责任条款存在偏重风险。${evidence} 建议重点关注违约金比例、赔偿范围是否叠加，以及是否设置责任上限。`;
  }

  if (topic === "payment") {
    return `根据当前资料，付款安排需要进一步明确。${evidence} 建议补充分期节点、验收条件、付款期限和逾期付款责任。`;
  }

  if (topic === "delivery") {
    return `根据当前资料，交付标准表述仍偏笼统。${evidence} 建议把“沟通为准”等表述改成可验收的功能清单、质量标准和验收流程。`;
  }

  if (topic === "ip") {
    return `根据当前资料，知识产权归属约定可能过于绝对。${evidence} 建议区分项目成果、乙方既有工具、通用组件和第三方开源依赖。`;
  }

  return `根据当前资料，最相关的依据来自「${strongest.section}」。${evidence} 以上结论仅基于已导入文档，关键法律判断建议结合完整合同由专业人员复核。`;
}

function isAnswerable(question: string, chunks: ScoredChunk[]): boolean {
  if (chunks.length === 0) {
    return false;
  }

  const normalized = question.toLowerCase();
  if (OUT_OF_SCOPE_TERMS.some((term) => normalized.includes(term))) {
    return false;
  }

  const hasDomainTerm = DOMAIN_TERMS.some((term) => normalized.includes(term.toLowerCase()));
  const strongest = chunks[0];
  const strongestScore = strongest.rerankScore ?? strongest.score;
  const hasKeywordSignal = chunks.some((chunk) => (chunk.keywordScore ?? 0) > 0);

  return hasDomainTerm && (strongestScore >= MIN_ANSWER_SCORE || hasKeywordSignal);
}

function inferTopic(question: string): "breach" | "payment" | "delivery" | "ip" | "general" {
  if (/违约|赔偿|责任|违约金/.test(question)) {
    return "breach";
  }
  if (/付款|支付|金额|款项/.test(question)) {
    return "payment";
  }
  if (/交付|验收|标准|完成/.test(question)) {
    return "delivery";
  }
  if (/知识产权|成果|复用|版权/.test(question)) {
    return "ip";
  }
  return "general";
}
