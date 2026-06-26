import type { ContractReviewResult, ContractRisk, DocumentChunk, RiskLevel } from "@legal-rag/shared";
import { toCitation } from "../citations/citations.js";

interface RiskRule {
  clause: string;
  level: RiskLevel;
  pattern: RegExp;
  issue: string;
  suggestion: string;
  requiresHumanReview: boolean;
}

const RULES: RiskRule[] = [
  {
    clause: "付款条件",
    level: "medium",
    pattern: /项目完成后一次性支付|一次性支付|完成后.*支付|验收后.*支付/,
    issue: "付款节点集中在项目完成后，缺少预付款、阶段款或验收后的明确付款期限，可能导致履约资金压力和回款不确定。",
    suggestion: "建议拆分为预付款、阶段验收款和尾款，并明确每一笔款项的触发条件、付款期限和逾期责任。",
    requiresHumanReview: true
  },
  {
    clause: "交付标准",
    level: "medium",
    pattern: /具体功能以双方沟通为准|交付甲方使用|沟通为准|另行沟通/,
    issue: "交付范围和验收标准较模糊，后续容易围绕是否完成交付产生争议。",
    suggestion: "建议列明功能清单、验收材料、验收期限、缺陷等级和整改周期。",
    requiresHumanReview: false
  },
  {
    clause: "违约责任",
    level: "high",
    pattern: /100%|全部损失|合同总金额.*违约金|违约金.*合同总金额/,
    issue: "违约金比例过高，且可能与全部损失赔偿叠加，缺少责任上限。",
    suggestion: "建议设置违约责任上限，例如合同总金额的 20%-30%，并区分一般违约、重大违约和故意侵权。",
    requiresHumanReview: true
  },
  {
    clause: "知识产权",
    level: "medium",
    pattern: /项目成果归甲方所有|不得再次使用|知识产权.*甲方/,
    issue: "知识产权归属过于绝对，未区分定制成果、乙方既有技术、通用组件和第三方依赖。",
    suggestion: "建议明确甲方取得定制成果权利，乙方保留既有工具和通用能力，并列明第三方依赖授权边界。",
    requiresHumanReview: true
  },
  {
    clause: "争议解决",
    level: "medium",
    pattern: /甲方所在地人民法院|甲方所在地|一方所在地/,
    issue: "争议管辖地偏向甲方，可能增加乙方维权成本。",
    suggestion: "建议改为被告所在地、合同履行地，或双方协商选择中立仲裁机构。",
    requiresHumanReview: false
  },
  {
    clause: "解除条款",
    level: "low",
    pattern: /解除/,
    issue: "解除条款需要确认是否约定触发条件、通知期限和结算方式。",
    suggestion: "建议补充可解除情形、提前通知期、已完成工作结算和资料返还安排。",
    requiresHumanReview: false
  }
];

export function reviewContract(chunks: DocumentChunk[]): ContractReviewResult {
  const risks: ContractRisk[] = [];

  for (const rule of RULES) {
    const matched = chunks.find((chunk) => rule.pattern.test(chunk.content) || rule.pattern.test(chunk.section));
    if (!matched) {
      continue;
    }

    risks.push({
      clause: matched.section.includes(rule.clause) ? matched.section : rule.clause,
      riskLevel: rule.level,
      issue: rule.issue,
      suggestion: rule.suggestion,
      citation: toCitation(matched),
      requiresHumanReview: rule.requiresHumanReview
    });
  }

  return {
    risks,
    markdown: toMarkdown(risks)
  };
}

function toMarkdown(risks: ContractRisk[]): string {
  if (risks.length === 0) {
    return "未在当前合同中识别到高频规则覆盖的明显风险，建议继续进行人工复核。";
  }

  return risks
    .map((risk, index) => {
      return [
        `### ${index + 1}. ${risk.clause}（${risk.riskLevel}）`,
        `- 问题：${risk.issue}`,
        `- 建议：${risk.suggestion}`,
        `- 引用：${risk.citation.section} / chunk ${risk.citation.chunkIndex + 1}`,
        `- 建议人工复核：${risk.requiresHumanReview ? "是" : "否"}`
      ].join("\n");
    })
    .join("\n\n");
}
