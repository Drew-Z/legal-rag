import assert from "node:assert/strict";
import test from "node:test";
import type { ChatProvider } from "../model-providers/openai-compatible.js";
import { splitIntoChunks } from "../chunks/splitter.js";
import { reviewContractWithModel } from "./review-service.js";

test("reviewContractWithModel merges schema-valid model explanations", async () => {
  const chunks = splitIntoChunks({
    documentId: "doc_review",
    title: "技术服务合同",
    text: "第一条 具体功能以双方沟通为准。第二条 项目完成后一次性支付。"
  });
  const chatProvider: ChatProvider = {
    async generateAnswer() {
      return "";
    },
    async generateContractRiskExplanations() {
      return [
        {
          clause: "交付标准",
          issue: "交付范围缺少可验收的功能清单，容易产生完成标准争议。",
          suggestion: "建议补充功能清单、验收期限、缺陷分级和整改周期。",
          requiresHumanReview: true
        }
      ];
    }
  };

  const review = await reviewContractWithModel(chunks, chatProvider);

  assert.equal(review.reviewSource, "model-assisted");
  assert.equal(review.schemaValid, true);
  assert.ok(review.risks.some((risk) => risk.analysisSource === "model-assisted"));
  assert.ok(review.markdown.includes("交付范围缺少可验收"));
});

test("reviewContractWithModel falls back when model output fails validation", async () => {
  const chunks = splitIntoChunks({
    documentId: "doc_review",
    title: "技术服务合同",
    text: "第一条 具体功能以双方沟通为准。"
  });
  const chatProvider: ChatProvider = {
    async generateAnswer() {
      return "";
    },
    async generateContractRiskExplanations() {
      return [
        {
          clause: "交付标准",
          issue: "",
          suggestion: "   "
        }
      ];
    }
  };

  const review = await reviewContractWithModel(chunks, chatProvider);

  assert.equal(review.reviewSource, "fallback");
  assert.equal(review.schemaValid, false);
  assert.match(review.modelError ?? "", /schema validation/);
  assert.ok(review.risks.every((risk) => risk.analysisSource === "rule"));
});
