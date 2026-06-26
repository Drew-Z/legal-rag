<script setup lang="ts">
import type { ContractReviewResult, ContractRisk, LegalDocument } from "@legal-rag/shared";

defineProps<{
  documents: LegalDocument[];
  selectedDocumentId: string;
  reviewResult: ContractReviewResult | null;
  busy: boolean;
}>();

defineEmits<{
  "update:selectedDocumentId": [value: string];
  selectDocument: [documentId: string];
  runReview: [];
  exportReview: [format: "markdown" | "json"];
  focusRisk: [risk: ContractRisk];
}>();
</script>

<template>
  <section class="review-layout">
    <div class="panel">
      <div class="panel-heading">
        <h2>合同审查</h2>
        <span>结构化风险报告</span>
      </div>
      <label>
        选择文档
        <select
          :value="selectedDocumentId"
          @change="$emit('update:selectedDocumentId', ($event.target as HTMLSelectElement).value); $emit('selectDocument', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">使用粘贴文本</option>
          <option v-for="document in documents" :key="document.id" :value="document.id">
            {{ document.title }}
          </option>
        </select>
      </label>
      <button class="primary" :disabled="busy" @click="$emit('runReview')">开始审查</button>
      <div class="export-actions">
        <button class="secondary" :disabled="!reviewResult" @click="$emit('exportReview', 'markdown')">导出 Markdown</button>
        <button class="secondary" :disabled="!reviewResult" @click="$emit('exportReview', 'json')">导出 JSON</button>
      </div>
    </div>

    <div class="panel result-panel">
      <div class="panel-heading">
        <h2>风险列表</h2>
        <span v-if="reviewResult">{{ reviewResult.risks.length }} 项</span>
      </div>
      <div v-if="reviewResult" class="risk-list">
        <div class="review-source">
          <span :class="['review-source-badge', reviewResult.reviewSource ?? 'rules']">
            {{ reviewResult.reviewSource ?? "rules" }}
          </span>
          <span>{{ reviewResult.schemaValid === false ? "Schema fallback" : "Schema valid" }}</span>
        </div>
        <article v-for="risk in reviewResult.risks" :key="risk.clause" class="risk-row">
          <div class="risk-title">
            <button class="risk-link" @click="$emit('focusRisk', risk)">{{ risk.clause }}</button>
            <span :class="['risk-badge', risk.riskLevel]">{{ risk.riskLevel }}</span>
          </div>
          <p>{{ risk.issue }}</p>
          <p><b>修改建议：</b>{{ risk.suggestion }}</p>
          <footer>
            {{ risk.citation.section }} · chunk {{ risk.citation.chunkIndex + 1 }}
            <span v-if="risk.analysisSource === 'model-assisted'">模型辅助说明</span>
            <span v-if="risk.requiresHumanReview">建议人工复核</span>
          </footer>
        </article>
      </div>
      <div v-else class="empty-state">选择已导入文档或使用粘贴文本，点击开始审查。</div>
    </div>
  </section>
</template>
