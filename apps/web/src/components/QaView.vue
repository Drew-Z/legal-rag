<script setup lang="ts">
import type { RagAnswer } from "@legal-rag/shared";
import type { AnswerSource, QaHistoryItem } from "../types";

defineProps<{
  selectedDocumentTitle: string;
  question: string;
  ragAnswer: RagAnswer | null;
  qaHistory: QaHistoryItem[];
  busy: boolean;
}>();

defineEmits<{
  "update:question": [value: string];
  askQuestion: [];
  restoreHistory: [item: QaHistoryItem];
  focusCitation: [documentId: string, chunkIndex: number];
}>();

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
  <section class="qa-layout">
    <div class="panel">
      <div class="panel-heading">
        <h2>智能问答</h2>
        <span>{{ selectedDocumentTitle }}</span>
      </div>
      <label>
        问题
        <textarea
          :value="question"
          class="question-box"
          placeholder="例如：违约责任是否合理？"
          @input="$emit('update:question', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
      <button class="primary" :disabled="busy" @click="$emit('askQuestion')">提问</button>

      <div class="history-list">
        <h3>问答历史</h3>
        <button v-for="item in qaHistory" :key="item.id" @click="$emit('restoreHistory', item)">
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
          <button class="source-button" @click="$emit('focusCitation', citation.documentId, citation.chunkIndex)">
            {{ citation.title }} · {{ citation.section }}
          </button>
          <span>chunk {{ citation.chunkIndex + 1 }}</span>
          <p>{{ citation.quote }}</p>
        </article>
      </div>
      <div v-else class="empty-state">输入问题后，这里会显示 answer、citations 和 retrieved chunks。</div>
    </div>
  </section>
</template>

