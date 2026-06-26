import type { ScoredChunk } from "@legal-rag/shared";

const LEGAL_TERMS = [
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
  "数据处理",
  "个人信息",
  "数据泄露",
  "分包",
  "争议",
  "管辖",
  "解除",
  "股权转让",
  "尽职调查",
  "定金",
  "陈述与保证",
  "排他期",
  "租赁",
  "押金",
  "维修",
  "提前解约",
  "交还验收"
];

export function rerankChunks(question: string, chunks: ScoredChunk[], limit: number): ScoredChunk[] {
  const queryTerms = extractTerms(question);

  return chunks
    .map((chunk) => {
      const haystack = `${chunk.section}\n${chunk.content}`;
      const lexicalHits = queryTerms.filter((term) => haystack.includes(term)).length;
      const sectionBoost = queryTerms.some((term) => chunk.section.includes(term)) ? 0.08 : 0;
      const legalBoost = LEGAL_TERMS.filter((term) => question.includes(term) && haystack.includes(term)).length * 0.04;
      const articleBoost = /^第[零〇一二三四五六七八九十百千两0-9]+条/.test(chunk.section) ? 0.03 : 0;
      const vectorScore = chunk.vectorScore ?? 0;
      const keywordScore = chunk.keywordScore ?? 0;
      const rerankScore =
        vectorScore * 0.55 + keywordScore * 0.35 + lexicalHits * 0.03 + sectionBoost + legalBoost + articleBoost;

      return {
        ...chunk,
        rerankScore: Number(rerankScore.toFixed(4)),
        score: Number(rerankScore.toFixed(4))
      };
    })
    .sort((left, right) => (right.rerankScore ?? 0) - (left.rerankScore ?? 0))
    .slice(0, limit);
}

function extractTerms(question: string): string[] {
  const terms = question.match(/[\u4e00-\u9fff]{2,6}|[a-z0-9]+/gi) ?? [];
  return [...new Set([...terms, ...LEGAL_TERMS.filter((term) => question.includes(term))])];
}
