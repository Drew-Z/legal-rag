<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import type {
  AuthStatus,
  ContractReviewResult,
  ContractRisk,
  DocumentChunk,
  EvaluationReport,
  LegalDocument,
  ProjectSpace,
  QualityReport,
  RagAnswer,
  ReviewEvaluationReport
} from "@legal-rag/shared";
import { api } from "./api/client";
import AppSidebar from "./components/AppSidebar.vue";
import KnowledgeView from "./components/KnowledgeView.vue";
import LoginPanel from "./components/LoginPanel.vue";
import QaView from "./components/QaView.vue";
import QualityView from "./components/QualityView.vue";
import ReviewView from "./components/ReviewView.vue";
import Topbar from "./components/Topbar.vue";
import { sampleContract } from "./data/sampleContract";
import type { QaHistoryItem, View } from "./types";

const activeView = ref<View>("knowledge");
const authStatus = ref<AuthStatus | null>(null);
const loginEmail = ref("demo@legal-rag.local");
const loginPassword = ref("");
const loginLoading = ref(false);
const projects = ref<ProjectSpace[]>([]);
const selectedProjectId = ref("project_default");
const projectName = ref("");
const documents = ref<LegalDocument[]>([]);
const chunks = ref<DocumentChunk[]>([]);
const selectedDocumentId = ref("");
const selectedChunkKey = ref("");
const title = ref("示例技术服务合同");
const text = ref(sampleContract);
const question = ref("违约责任是否合理？");
const ragAnswer = ref<RagAnswer | null>(null);
const qaHistory = ref<QaHistoryItem[]>([]);
const reviewResult = ref<ContractReviewResult | null>(null);
const qualityReport = ref<QualityReport | null>(null);
const evaluationReport = ref<EvaluationReport | null>(null);
const reviewEvaluationReport = ref<ReviewEvaluationReport | null>(null);
const qualityLoading = ref(false);
const apiStatus = ref("连接中");
const apiWakeMessage = ref("");
const busy = ref(false);
const uploadProgress = ref(0);
const notice = ref("");

const selectedDocument = computed(() =>
  documents.value.find((document) => document.id === selectedDocumentId.value)
);

const selectedProject = computed(() =>
  projects.value.find((project) => project.id === selectedProjectId.value)
);

const authRequired = computed(() => authStatus.value?.enabled === true && !authStatus.value.authenticated);

const selectedChunk = computed(() =>
  chunks.value.find((chunk) => chunkKey(chunk.documentId, chunk.chunkIndex) === selectedChunkKey.value)
);

onMounted(async () => {
  const healthy = await checkHealth();
  if (!healthy) {
    await waitForApiWake();
  }
  await loadAuthStatus();
  if (!authRequired.value) {
    await bootstrapWorkspace();
  }
});

async function bootstrapWorkspace() {
  await refreshProjects();
  await refreshDocuments();
  await loadQualityReport();
  await loadEvaluationReport();
  await loadReviewEvaluationReport();
}

async function checkHealth(): Promise<boolean> {
  try {
    const health = await api.health();
    apiStatus.value = `${health.modelProvider} / ${health.vectorStore}`;
    apiWakeMessage.value = "";
    return true;
  } catch {
    apiStatus.value = "API 正在唤醒";
    apiWakeMessage.value = "API 暂时不可用，Render 免费实例首次访问可能需要 30-60 秒唤醒。";
    return false;
  }
}

async function waitForApiWake() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await sleep(3000);
    if (await checkHealth()) {
      return;
    }
  }
}

async function loadAuthStatus() {
  try {
    authStatus.value = await api.authStatus();
    if (authStatus.value.user?.email) {
      loginEmail.value = authStatus.value.user.email;
    }
  } catch {
    authStatus.value = {
      enabled: false,
      authenticated: true
    };
  }
}

async function login() {
  loginLoading.value = true;
  notice.value = "";
  try {
    authStatus.value = await api.login(loginEmail.value.trim(), loginPassword.value);
    loginPassword.value = "";
    await bootstrapWorkspace();
  } catch (error) {
    notice.value = friendlyError(error, "登录失败");
  } finally {
    loginLoading.value = false;
  }
}

async function logout() {
  try {
    authStatus.value = await api.logout();
  } finally {
    documents.value = [];
    chunks.value = [];
    selectedDocumentId.value = "";
    selectedChunkKey.value = "";
    ragAnswer.value = null;
    qaHistory.value = [];
    reviewResult.value = null;
    qualityReport.value = null;
    evaluationReport.value = null;
    reviewEvaluationReport.value = null;
  }
}

async function refreshDocuments() {
  const result = await api.listDocuments(selectedProjectId.value);
  documents.value = result.documents;
  chunks.value = [];
  selectedChunkKey.value = "";
  if (!selectedDocumentId.value && result.documents[0]) {
    await selectDocument(result.documents[0].id);
  }
  if (selectedDocumentId.value && !result.documents.some((document) => document.id === selectedDocumentId.value)) {
    selectedDocumentId.value = "";
  }
}

async function refreshProjects() {
  const result = await api.listProjects();
  projects.value = result.projects;
  if (!projects.value.some((project) => project.id === selectedProjectId.value) && projects.value[0]) {
    selectedProjectId.value = projects.value[0].id;
  }
}

async function createProject() {
  const name = projectName.value.trim();
  if (!name) {
    notice.value = "请输入项目名称";
    return;
  }

  busy.value = true;
  notice.value = "";
  try {
    const result = await api.createProject(name);
    await refreshProjects();
    selectedProjectId.value = result.project.id;
    projectName.value = "";
    selectedDocumentId.value = "";
    ragAnswer.value = null;
    await refreshDocuments();
    await loadQualityReport();
    notice.value = `已创建项目：${result.project.name}`;
  } catch (error) {
    notice.value = friendlyError(error, "创建项目失败");
  } finally {
    busy.value = false;
  }
}

async function changeProject() {
  selectedDocumentId.value = "";
  selectedChunkKey.value = "";
  chunks.value = [];
  ragAnswer.value = null;
  qaHistory.value = [];
  reviewResult.value = null;
  await refreshDocuments();
}

async function loadQualityReport() {
  qualityLoading.value = true;
  try {
    qualityReport.value = await api.qualityReport();
  } catch (error) {
    notice.value = friendlyError(error, "质量报告加载失败");
  } finally {
    qualityLoading.value = false;
  }
}

async function loadEvaluationReport() {
  try {
    evaluationReport.value = await api.evaluationReport();
  } catch (error) {
    notice.value = friendlyError(error, "评测报告加载失败");
  }
}

async function loadReviewEvaluationReport() {
  try {
    reviewEvaluationReport.value = await api.reviewEvaluationReport();
  } catch (error) {
    notice.value = friendlyError(error, "合同审查评测加载失败");
  }
}

async function refreshQualityReports() {
  qualityLoading.value = true;
  try {
    const [quality, evaluation, reviewEvaluation] = await Promise.all([
      api.qualityReport(),
      api.evaluationReport(),
      api.reviewEvaluationReport()
    ]);
    qualityReport.value = quality;
    evaluationReport.value = evaluation;
    reviewEvaluationReport.value = reviewEvaluation;
  } catch (error) {
    notice.value = friendlyError(error, "质量报告加载失败");
  } finally {
    qualityLoading.value = false;
  }
}

async function selectDocument(documentId: string, chunkIndex?: number) {
  if (!documentId) {
    selectedDocumentId.value = "";
    chunks.value = [];
    selectedChunkKey.value = "";
    return;
  }

  selectedDocumentId.value = documentId;
  const result = await api.getChunks(selectedProjectId.value, documentId);
  chunks.value = result.chunks;
  selectedChunkKey.value =
    typeof chunkIndex === "number" ? chunkKey(documentId, chunkIndex) : selectedChunkKey.value;
}

async function importDocument() {
  busy.value = true;
  notice.value = "";
  try {
    const result = await api.importText(selectedProjectId.value, title.value, text.value);
    notice.value = result.duplicate
      ? `检测到重复文档，已复用 ${result.chunkCount} 个 chunk`
      : `已导入 ${result.chunkCount} 个 chunk`;
    await refreshDocuments();
    await selectDocument(result.documentId);
    activeView.value = "knowledge";
  } catch (error) {
    notice.value = friendlyError(error, "导入失败");
  } finally {
    busy.value = false;
  }
}

async function seedDataset() {
  busy.value = true;
  notice.value = "";
  try {
    const result = await api.seedDataset(selectedProjectId.value);
    notice.value = `公开安全数据集已就绪：新增 ${result.imported} 份，复用 ${result.duplicates} 份`;
    await refreshDocuments();
    if (result.documents[0]) {
      await selectDocument(result.documents[0].id);
    }
  } catch (error) {
    notice.value = friendlyError(error, "初始化数据集失败");
  } finally {
    busy.value = false;
  }
}

async function uploadDocument(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  busy.value = true;
  uploadProgress.value = 0;
  notice.value = "";
  try {
    const result = await api.uploadDocument(selectedProjectId.value, file, title.value || file.name, (percent) => {
      uploadProgress.value = percent;
    });
    const warningText = result.warnings.length > 0 ? `，解析提示 ${result.warnings.length} 条` : "";
    notice.value = result.duplicate
      ? `检测到重复上传，已复用 ${result.chunkCount} 个 chunk${warningText}`
      : `已通过 ${result.parser.toUpperCase()} 解析并导入 ${result.chunkCount} 个 chunk${warningText}`;
    await refreshDocuments();
    await selectDocument(result.documentId);
    activeView.value = "knowledge";
  } catch (error) {
    notice.value = friendlyError(error, "上传失败");
  } finally {
    busy.value = false;
    uploadProgress.value = 0;
    input.value = "";
  }
}

async function askQuestion() {
  busy.value = true;
  notice.value = "";
  try {
    const answer = await api.query(selectedProjectId.value, question.value, 5);
    ragAnswer.value = answer;
    qaHistory.value = [
      {
        id: `${Date.now()}`,
        question: question.value,
        answer,
        createdAt: new Date().toISOString()
      },
      ...qaHistory.value
    ].slice(0, 8);
    if (answer.retrievedChunks[0]) {
      await focusChunk(answer.retrievedChunks[0].documentId, answer.retrievedChunks[0].chunkIndex, false);
    }
  } catch (error) {
    notice.value = friendlyError(error, "提问失败");
  } finally {
    busy.value = false;
  }
}

async function runReview() {
  busy.value = true;
  notice.value = "";
  try {
    reviewResult.value = await api.review(
      selectedDocumentId.value
        ? { projectId: selectedProjectId.value, documentId: selectedDocumentId.value }
        : { projectId: selectedProjectId.value, text: text.value }
    );
  } catch (error) {
    notice.value = friendlyError(error, "审查失败");
  } finally {
    busy.value = false;
  }
}

async function focusCitation(documentId: string, chunkIndex: number) {
  await focusChunk(documentId, chunkIndex, true);
}

async function focusRisk(risk: ContractRisk) {
  await focusChunk(risk.citation.documentId, risk.citation.chunkIndex, true);
}

async function focusChunk(documentId: string, chunkIndex: number, openKnowledge: boolean) {
  if (openKnowledge) {
    activeView.value = "knowledge";
  }
  await selectDocument(documentId, chunkIndex);
  selectedChunkKey.value = chunkKey(documentId, chunkIndex);
  await nextTick();
  document.getElementById(selectedChunkKey.value)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function restoreHistory(item: QaHistoryItem) {
  question.value = item.question;
  ragAnswer.value = item.answer;
}

function exportReview(format: "markdown" | "json") {
  if (!reviewResult.value) {
    return;
  }

  const content =
    format === "markdown" ? reviewResult.value.markdown : JSON.stringify(reviewResult.value, null, 2);
  const type = format === "markdown" ? "text/markdown" : "application/json";
  const extension = format === "markdown" ? "md" : "json";
  downloadFile(`contract-review.${extension}`, content, type);
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function chunkKey(documentId: string, chunkIndex: number) {
  return `${documentId}-chunk-${chunkIndex}`;
}

function friendlyError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (/fetch|network|Upload failed|Failed to fetch/i.test(error.message)) {
    return "API 暂时不可用，可能正在冷启动或网络不稳定，请稍后重试。";
  }

  if (/authentication required|invalid email or password/i.test(error.message)) {
    return "登录信息无效或登录状态已过期，请重新登录。";
  }

  if (/model|LLM|EMBEDDING|API key|provider/i.test(error.message)) {
    return "模型服务暂时不可用，请检查模型网关配置或稍后重试。";
  }

  if (/DATABASE|pgvector|postgres|connection/i.test(error.message)) {
    return "知识库数据库暂时不可用，请检查 Supabase pgvector 连接状态。";
  }

  return error.message || fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
</script>

<template>
  <LoginPanel
    v-if="authRequired"
    v-model:login-email="loginEmail"
    v-model:login-password="loginPassword"
    :login-loading="loginLoading"
    :notice="notice"
    @login="login"
  />

  <div v-else class="app-shell">
    <AppSidebar
      v-model:active-view="activeView"
      v-model:selected-project-id="selectedProjectId"
      v-model:project-name="projectName"
      :projects="projects"
      :busy="busy"
      :api-status="apiStatus"
      :auth-enabled="authStatus?.enabled === true"
      @change-project="changeProject"
      @create-project="createProject"
      @logout="logout"
    />

    <main class="workspace">
      <Topbar
        :selected-project-name="selectedProject?.name ?? '默认项目'"
        :busy="busy"
        @seed-dataset="seedDataset"
        @fill-sample="text = sampleContract"
      />

      <p v-if="apiWakeMessage" class="notice api-wake">{{ apiWakeMessage }}</p>
      <p v-if="notice" class="notice">{{ notice }}</p>

      <KnowledgeView
        v-if="activeView === 'knowledge'"
        v-model:title="title"
        v-model:text="text"
        v-model:selected-chunk-key="selectedChunkKey"
        :documents="documents"
        :chunks="chunks"
        :selected-document="selectedDocument"
        :selected-document-id="selectedDocumentId"
        :selected-chunk="selectedChunk"
        :busy="busy"
        :upload-progress="uploadProgress"
        @import-document="importDocument"
        @upload-document="uploadDocument"
        @select-document="selectDocument"
      />

      <QaView
        v-if="activeView === 'qa'"
        v-model:question="question"
        :selected-document-title="selectedDocument?.title ?? '导入文档后提问'"
        :rag-answer="ragAnswer"
        :qa-history="qaHistory"
        :busy="busy"
        @ask-question="askQuestion"
        @restore-history="restoreHistory"
        @focus-citation="focusCitation"
      />

      <ReviewView
        v-if="activeView === 'review'"
        v-model:selected-document-id="selectedDocumentId"
        :documents="documents"
        :review-result="reviewResult"
        :busy="busy"
        @select-document="selectDocument"
        @run-review="runReview"
        @export-review="exportReview"
        @focus-risk="focusRisk"
      />

      <QualityView
        v-if="activeView === 'quality'"
        :quality-report="qualityReport"
        :evaluation-report="evaluationReport"
        :review-evaluation-report="reviewEvaluationReport"
        :quality-loading="qualityLoading"
        @refresh-quality-reports="refreshQualityReports"
      />
    </main>
  </div>
</template>
