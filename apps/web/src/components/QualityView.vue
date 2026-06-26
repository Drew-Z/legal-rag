<script setup lang="ts">
import type {
  AuditLogEntry,
  EvaluationReport,
  QualityReport,
  QualityTrendReport,
  ReviewEvaluationReport
} from "@legal-rag/shared";

defineProps<{
  qualityReport: QualityReport | null;
  qualityTrendReport: QualityTrendReport | null;
  evaluationReport: EvaluationReport | null;
  reviewEvaluationReport: ReviewEvaluationReport | null;
  auditLogs: AuditLogEntry[];
  qualityLoading: boolean;
}>();

defineEmits<{
  refreshQualityReports: [];
}>();

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}
</script>

<template>
  <section class="quality-layout">
    <div class="panel">
      <div class="panel-heading">
        <h2>运行时状态</h2>
        <span v-if="qualityReport">{{ new Date(qualityReport.generatedAt).toLocaleString() }}</span>
      </div>
      <div v-if="qualityReport" class="quality-metrics">
        <article>
          <span>模型提供商</span>
          <strong>{{ qualityReport.runtime.modelProvider }}</strong>
          <small>{{ qualityReport.runtime.chatModel ?? "mock answer" }}</small>
        </article>
        <article>
          <span>向量库</span>
          <strong>{{ qualityReport.runtime.vectorStore }}</strong>
          <small>{{ qualityReport.runtime.embeddingModel }}</small>
        </article>
        <article>
          <span>知识库</span>
          <strong>{{ qualityReport.runtime.documentCount }} 份</strong>
          <small>{{ qualityReport.runtime.chunkCount }} chunks</small>
        </article>
        <article>
          <span>评测通过率</span>
          <strong>{{ qualityReport.eval.passed }}/{{ qualityReport.eval.total }}</strong>
          <small>{{ qualityReport.eval.answerableCases }} 可答 · {{ qualityReport.eval.refusalCases }} 拒答</small>
        </article>
        <article>
          <span>Citation 命中率</span>
          <strong>{{ formatPercent(qualityReport.eval.citationAccuracy) }}</strong>
          <small>可回答用例的引用命中</small>
        </article>
        <article>
          <span>可回答准确率</span>
          <strong>{{ formatPercent(qualityReport.eval.answerableAccuracy) }}</strong>
          <small>回答且引用正确</small>
        </article>
        <article>
          <span>拒答准确率</span>
          <strong>{{ formatPercent(qualityReport.eval.refusalAccuracy) }}</strong>
          <small>越界问题无引用拒答</small>
        </article>
        <article>
          <span>审查召回率</span>
          <strong>{{ formatPercent(qualityReport.reviewEval.recall) }}</strong>
          <small>{{ qualityReport.reviewEval.matchedRiskCount }}/{{ qualityReport.reviewEval.expectedRiskCount }} 个风险命中</small>
        </article>
      </div>
      <div v-else class="empty-state">点击刷新后显示运行时和评测摘要。</div>
      <button class="primary" :disabled="qualityLoading" @click="$emit('refreshQualityReports')">
        {{ qualityLoading ? "刷新中" : "刷新质量报告" }}
      </button>
    </div>

    <div class="panel result-panel">
      <div class="panel-heading">
        <h2>Readiness Checks</h2>
        <span v-if="qualityReport">{{ qualityReport.checks.length }} 项</span>
      </div>
      <div v-if="qualityReport" class="check-list">
        <article v-for="check in qualityReport.checks" :key="check.id" class="check-row">
          <div>
            <strong>{{ check.label }}</strong>
            <span :class="['check-badge', check.status]">{{ check.status }}</span>
          </div>
          <p>{{ check.detail }}</p>
        </article>
      </div>
      <div v-else class="empty-state">质量报告会汇总真实模型、pgvector、语料和评测护栏。</div>
    </div>

    <div class="panel result-panel eval-panel trend-panel">
      <div class="panel-heading">
        <h2>质量趋势</h2>
        <span v-if="qualityTrendReport">{{ qualityTrendReport.points.length }} 条记录</span>
      </div>
      <div v-if="qualityTrendReport && qualityTrendReport.points.length > 0" class="trend-list">
        <article v-for="point in qualityTrendReport.points" :key="point.id" class="trend-row">
          <div>
            <strong>{{ new Date(point.generatedAt).toLocaleString() }}</strong>
            <span>{{ point.modelProvider }} / {{ point.vectorStore }}</span>
          </div>
          <div class="trend-metrics">
            <span>RAG {{ point.ragPassed }}/{{ point.ragTotal }}</span>
            <span>Citation {{ formatPercent(point.citationAccuracy) }}</span>
            <span>拒答 {{ formatPercent(point.refusalAccuracy) }}</span>
            <span>审查 {{ point.reviewPassed }}/{{ point.reviewTotal }}</span>
            <span>召回 {{ formatPercent(point.reviewRecall) }}</span>
            <span>语料 {{ point.documentCount }} 份 / {{ point.chunkCount }} chunks</span>
          </div>
        </article>
      </div>
      <div v-else class="empty-state">刷新质量报告后，这里会保留最近的评测趋势。</div>
    </div>

    <div class="panel result-panel eval-panel audit-panel">
      <div class="panel-heading">
        <h2>审计日志</h2>
        <span>{{ auditLogs.length }} 条</span>
      </div>
      <div v-if="auditLogs.length > 0" class="audit-list">
        <article v-for="entry in auditLogs" :key="entry.id" class="audit-row">
          <div>
            <strong>{{ entry.action }}</strong>
            <span>{{ new Date(entry.createdAt).toLocaleString() }}</span>
          </div>
          <p>{{ entry.summary }}</p>
          <small>{{ entry.userEmail }} · {{ entry.targetType ?? "project" }}{{ entry.targetId ? ` / ${entry.targetId}` : "" }}</small>
        </article>
      </div>
      <div v-else class="empty-state">项目创建、导入、问答和审查后会显示最近操作记录。</div>
    </div>

    <div class="panel result-panel eval-panel">
      <div class="panel-heading">
        <h2>评测用例</h2>
        <span v-if="evaluationReport">
          {{ evaluationReport.passed }}/{{ evaluationReport.total }} 通过
        </span>
      </div>
      <div v-if="evaluationReport" class="eval-list">
        <article v-for="item in evaluationReport.results" :key="item.id" class="eval-row">
          <div>
            <strong>{{ item.id }}</strong>
            <span :class="['check-badge', item.passed ? 'pass' : 'fail']">
              {{ item.passed ? "pass" : "fail" }}
            </span>
          </div>
          <div class="eval-meta">
            <span>{{ item.kind }}</span>
            <span>{{ item.expectedTopic }}</span>
            <span>{{ item.kind === "answerable" ? (item.citationHit ? "citation hit" : "citation miss") : (item.refused ? "refused" : "not refused") }}</span>
          </div>
          <p>{{ item.reason }}</p>
          <small>{{ item.answer }}</small>
        </article>
      </div>
      <div v-else class="empty-state">评测报告会列出 citation 命中和拒答用例。</div>
    </div>

    <div class="panel result-panel eval-panel">
      <div class="panel-heading">
        <h2>合同审查用例</h2>
        <span v-if="reviewEvaluationReport">
          {{ reviewEvaluationReport.passed }}/{{ reviewEvaluationReport.total }} 通过
        </span>
      </div>
      <div v-if="reviewEvaluationReport" class="eval-list">
        <article v-for="item in reviewEvaluationReport.results" :key="item.id" class="eval-row">
          <div>
            <strong>{{ item.title }}</strong>
            <span :class="['check-badge', item.passed ? 'pass' : 'fail']">
              {{ item.passed ? "pass" : "fail" }}
            </span>
          </div>
          <div class="eval-meta">
            <span>expected {{ item.expectedRisks.join(" / ") }}</span>
            <span>matched {{ item.matchedRisks.join(" / ") || "none" }}</span>
          </div>
          <p v-if="item.missingRisks.length > 0">缺失：{{ item.missingRisks.join("、") }}</p>
          <small>{{ item.actualRisks.join("、") || "未识别风险" }}</small>
        </article>
      </div>
      <div v-else class="empty-state">合同审查评测会列出标注风险的命中情况。</div>
    </div>
  </section>
</template>
