<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import type {
  ContractReviewResult,
  ContractRisk,
  DocumentChunk,
  LegalDocument,
  QualityReport,
  RagAnswer
} from "@legal-rag/shared";
import { api } from "./api/client";
import { sampleContract } from "./data/sampleContract";

type View = "knowledge" | "qa" | "review" | "quality";
type AnswerSource = NonNullable<RagAnswer["diagnostics"]>["answerSource"];

interface QaHistoryItem {
  id: string;
  question: string;
  answer: RagAnswer;
  createdAt: string;
}

const activeView = ref<View>("knowledge");
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
const qualityLoading = ref(false);
const apiStatus = ref("连接中");
const busy = ref(false);
const uploadProgress = ref(0);
const notice = ref("");

const selectedDocument = computed(() =>
  documents.value.find((document) => document.id === selectedDocumentId.value)
);

const selectedChunk = computed(() =>
  chunks.value.find((chunk) => chunkKey(chunk.documentId, chunk.chunkIndex) === selectedChunkKey.value)
);

onMounted(async () => {
  await checkHealth();
  await refreshDocuments();
  await loadQualityReport();
});

async function checkHealth() {
  try {
    const health = await api.health();
    apiStatus.value = `${health.modelProvider} / ${health.vectorStore}`;
  } catch {
    apiStatus.value = "API 未连接";
  }
}

async function refreshDocuments() {
  const result = await api.listDocuments();
  documents.value = result.documents;
  if (!selectedDocumentId.value && result.documents[0]) {
    await selectDocument(result.documents[0].id);
  }
}

async function loadQualityReport() {
  qualityLoading.value = true;
  try {
    qualityReport.value = await api.qualityReport();
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "质量报告加载失败";
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
  const result = await api.getChunks(documentId);
  chunks.value = result.chunks;
  selectedChunkKey.value =
    typeof chunkIndex === "number" ? chunkKey(documentId, chunkIndex) : selectedChunkKey.value;
}

async function importDocument() {
  busy.value = true;
  notice.value = "";
  try {
    const result = await api.importText(title.value, text.value);
    notice.value = result.duplicate
      ? `检测到重复文档，已复用 ${result.chunkCount} 个 chunk`
      : `已导入 ${result.chunkCount} 个 chunk`;
    await refreshDocuments();
    await selectDocument(result.documentId);
    activeView.value = "knowledge";
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "导入失败";
  } finally {
    busy.value = false;
  }
}

async function seedDataset() {
  busy.value = true;
  notice.value = "";
  try {
    const result = await api.seedDataset();
    notice.value = `公开安全数据集已就绪：新增 ${result.imported} 份，复用 ${result.duplicates} 份`;
    await refreshDocuments();
    if (result.documents[0]) {
      await selectDocument(result.documents[0].id);
    }
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "初始化数据集失败";
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
    const result = await api.uploadDocument(file, title.value || file.name, (percent) => {
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
    notice.value = error instanceof Error ? error.message : "上传失败";
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
    const answer = await api.query(question.value, 5);
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
    notice.value = error instanceof Error ? error.message : "提问失败";
  } finally {
    busy.value = false;
  }
}

async function runReview() {
  busy.value = true;
  notice.value = "";
  try {
    reviewResult.value = await api.review(
      selectedDocumentId.value ? { documentId: selectedDocumentId.value } : { text: text.value }
    );
  } catch (error) {
    notice.value = error instanceof Error ? error.message : "审查失败";
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

function answerSourceLabel(source: AnswerSource) {
  const labels: Record<AnswerSource, string> = {
    model: "真实模型",
    fallback: "本地回退",
    refusal: "资料不足"
  };

  return labels[source];
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">LR</div>
        <div>
          <strong>Legal RAG</strong>
          <span>合同审查工作台</span>
        </div>
      </div>

      <nav class="nav">
        <button :class="{ active: activeView === 'knowledge' }" @click="activeView = 'knowledge'">
          <span class="nav-icon">▦</span>
          知识库
        </button>
        <button :class="{ active: activeView === 'qa' }" @click="activeView = 'qa'">
          <span class="nav-icon">?</span>
          智能问答
        </button>
        <button :class="{ active: activeView === 'review' }" @click="activeView = 'review'">
          <span class="nav-icon">!</span>
          合同审查
        </button>
        <button :class="{ active: activeView === 'quality' }" @click="activeView = 'quality'">
          <span class="nav-icon">✓</span>
          质量面板
        </button>
      </nav>

      <div class="status">
        <span>API</span>
        <strong>{{ apiStatus }}</strong>
      </div>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <div>
          <h1>法律智能机器人与合同审查 RAG 应用</h1>
          <p>导入公开安全数据、上传文档、查看引用依据，并导出结构化风险报告。</p>
        </div>
        <div class="topbar-actions">
          <button class="secondary" :disabled="busy" @click="seedDataset">初始化公开数据集</button>
          <button class="secondary" @click="text = sampleContract">填入示例合同</button>
        </div>
      </header>

      <p v-if="notice" class="notice">{{ notice }}</p>

      <section v-if="activeView === 'knowledge'" class="three-column">
        <div class="panel import-panel">
          <div class="panel-heading">
            <h2>导入文档</h2>
            <span>TXT / PDF / DOCX / 粘贴文本</span>
          </div>
          <label>
            文档标题
            <input v-model="title" placeholder="请输入文档标题" />
          </label>
          <div class="upload-box">
            <input
              id="file-upload"
              class="file-input"
              type="file"
              accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              :disabled="busy"
              @change="uploadDocument"
            />
            <label class="file-label" for="file-upload">上传文件并解析</label>
            <div v-if="uploadProgress > 0" class="progress">
              <span :style="{ width: `${uploadProgress}%` }"></span>
            </div>
          </div>
          <label class="grow">
            合同文本
            <textarea v-model="text" placeholder="粘贴合同或法律文档文本" />
          </label>
          <button class="primary" :disabled="busy" @click="importDocument">导入并向量化</button>
        </div>

        <div class="panel">
          <div class="panel-heading">
            <h2>文档列表</h2>
            <span>{{ documents.length }} 份</span>
          </div>
          <div class="doc-list">
            <button
              v-for="document in documents"
              :key="document.id"
              :class="{ selected: selectedDocumentId === document.id }"
              @click="selectDocument(document.id)"
            >
              <strong>{{ document.title }}</strong>
              <span>{{ document.chunkCount }} chunks · {{ document.docType ?? document.sourceType }}</span>
              <small>{{ document.sourceLabel ?? new Date(document.createdAt).toLocaleString() }}</small>
            </button>
          </div>
        </div>

        <div class="panel">
          <div class="panel-heading">
            <h2>知识详情</h2>
            <span>{{ chunks.length }} 条</span>
          </div>
          <div v-if="selectedDocument" class="document-detail">
            <strong>{{ selectedDocument.title }}</strong>
            <span>{{ selectedDocument.sourceLabel ?? selectedDocument.sourceType }}</span>
            <a v-if="selectedDocument.sourceUrl?.startsWith('http')" :href="selectedDocument.sourceUrl" target="_blank">
              查看公开来源
            </a>
            <code v-if="selectedDocument.contentHash">{{ selectedDocument.contentHash.slice(0, 16) }}</code>
          </div>
          <div v-if="selectedChunk" class="source-highlight">
            <strong>{{ selectedChunk.section }}</strong>
            <p>{{ selectedChunk.content }}</p>
          </div>
          <div class="chunk-list">
            <article
              v-for="chunk in chunks"
              :id="chunkKey(chunk.documentId, chunk.chunkIndex)"
              :key="chunk.id"
              :class="['chunk-row', { focused: selectedChunkKey === chunkKey(chunk.documentId, chunk.chunkIndex) }]"
              @click="selectedChunkKey = chunkKey(chunk.documentId, chunk.chunkIndex)"
            >
              <div>
                <strong>#{{ chunk.chunkIndex + 1 }} {{ chunk.section }}</strong>
                <span>page {{ chunk.page }} · {{ chunk.tokenEstimate }} tokens</span>
              </div>
              <p>{{ chunk.content }}</p>
            </article>
          </div>
        </div>
      </section>

      <section v-if="activeView === 'qa'" class="qa-layout">
        <div class="panel">
          <div class="panel-heading">
            <h2>智能问答</h2>
            <span>{{ selectedDocument?.title ?? "导入文档后提问" }}</span>
          </div>
          <label>
            问题
            <textarea v-model="question" class="question-box" placeholder="例如：违约责任是否合理？" />
          </label>
          <button class="primary" :disabled="busy" @click="askQuestion">提问</button>

          <div class="history-list">
            <h3>问答历史</h3>
            <button v-for="item in qaHistory" :key="item.id" @click="restoreHistory(item)">
              <strong>{{ item.question }}</strong>
              <span>{{ new Date(item.createdAt).toLocaleTimeString() }}</span>
            </button>
          </div>
        </div>

        <div class="panel result-panel">
          <div class="panel-heading">
            <h2>回答与引用来源</h2>
            <span v-if="ragAnswer">{{ ragAnswer.retrievedChunks.length }} 个命中片段</span>
          </div>
          <div v-if="ragAnswer" class="answer">
            <p>{{ ragAnswer.answer }}</p>
            <div class="diagnostics" v-if="ragAnswer.diagnostics">
              <span :class="['answer-source', ragAnswer.diagnostics.answerSource]">
                {{ answerSourceLabel(ragAnswer.diagnostics.answerSource) }}
              </span>
              <span>向量 {{ ragAnswer.diagnostics.vectorCandidates }}</span>
              <span>关键词 {{ ragAnswer.diagnostics.keywordCandidates }}</span>
              <span>过滤 {{ ragAnswer.diagnostics.filteredCandidates }}</span>
              <span>重排 {{ ragAnswer.diagnostics.rerankedCandidates }}</span>
            </div>
            <h3>引用来源</h3>
            <article v-for="citation in ragAnswer.citations" :key="`${citation.documentId}-${citation.chunkIndex}`">
              <button class="source-button" @click="focusCitation(citation.documentId, citation.chunkIndex)">
                {{ citation.title }} · {{ citation.section }}
              </button>
              <span>chunk {{ citation.chunkIndex + 1 }}</span>
              <p>{{ citation.quote }}</p>
            </article>
          </div>
          <div v-else class="empty-state">输入问题后，这里会显示 answer、citations 和 retrieved chunks。</div>
        </div>
      </section>

      <section v-if="activeView === 'review'" class="review-layout">
        <div class="panel">
          <div class="panel-heading">
            <h2>合同审查</h2>
            <span>结构化风险报告</span>
          </div>
          <label>
            选择文档
            <select v-model="selectedDocumentId" @change="selectDocument(selectedDocumentId)">
              <option value="">使用粘贴文本</option>
              <option v-for="document in documents" :key="document.id" :value="document.id">
                {{ document.title }}
              </option>
            </select>
          </label>
          <button class="primary" :disabled="busy" @click="runReview">开始审查</button>
          <div class="export-actions">
            <button class="secondary" :disabled="!reviewResult" @click="exportReview('markdown')">导出 Markdown</button>
            <button class="secondary" :disabled="!reviewResult" @click="exportReview('json')">导出 JSON</button>
          </div>
        </div>

        <div class="panel result-panel">
          <div class="panel-heading">
            <h2>风险列表</h2>
            <span v-if="reviewResult">{{ reviewResult.risks.length }} 项</span>
          </div>
          <div v-if="reviewResult" class="risk-list">
            <article v-for="risk in reviewResult.risks" :key="risk.clause" class="risk-row">
              <div class="risk-title">
                <button class="risk-link" @click="focusRisk(risk)">{{ risk.clause }}</button>
                <span :class="['risk-badge', risk.riskLevel]">{{ risk.riskLevel }}</span>
              </div>
              <p>{{ risk.issue }}</p>
              <p><b>修改建议：</b>{{ risk.suggestion }}</p>
              <footer>
                {{ risk.citation.section }} · chunk {{ risk.citation.chunkIndex + 1 }}
                <span v-if="risk.requiresHumanReview">建议人工复核</span>
              </footer>
            </article>
          </div>
          <div v-else class="empty-state">选择已导入文档或使用粘贴文本，点击开始审查。</div>
        </div>
      </section>

      <section v-if="activeView === 'quality'" class="quality-layout">
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
          </div>
          <div v-else class="empty-state">点击刷新后显示运行时和评测摘要。</div>
          <button class="primary" :disabled="qualityLoading" @click="loadQualityReport">
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
      </section>
    </main>
  </div>
</template>
