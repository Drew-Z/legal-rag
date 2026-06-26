<script setup lang="ts">
import type { DocumentChunk, IngestionJob, LegalDocument } from "@legal-rag/shared";

defineProps<{
  documents: LegalDocument[];
  ingestionJobs: IngestionJob[];
  chunks: DocumentChunk[];
  selectedDocument: LegalDocument | undefined;
  selectedDocumentId: string;
  selectedChunk: DocumentChunk | undefined;
  selectedChunkKey: string;
  title: string;
  text: string;
  busy: boolean;
  uploadProgress: number;
}>();

defineEmits<{
  "update:title": [value: string];
  "update:text": [value: string];
  "update:selectedChunkKey": [value: string];
  importDocument: [];
  uploadDocument: [event: Event];
  selectDocument: [documentId: string];
}>();

function chunkKey(documentId: string, chunkIndex: number) {
  return `${documentId}-chunk-${chunkIndex}`;
}
</script>

<template>
  <section class="three-column">
    <div class="panel import-panel">
      <div class="panel-heading">
        <h2>导入文档</h2>
        <span>TXT / PDF / DOCX / 粘贴文本</span>
      </div>
      <label>
        文档标题
        <input :value="title" placeholder="请输入文档标题" @input="$emit('update:title', ($event.target as HTMLInputElement).value)" />
      </label>
      <div class="upload-box">
        <input
          id="file-upload"
          class="file-input"
          type="file"
          accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          :disabled="busy"
          @change="$emit('uploadDocument', $event)"
        />
        <label class="file-label" for="file-upload">上传文件并解析</label>
        <div v-if="uploadProgress > 0" class="progress">
          <span :style="{ width: `${uploadProgress}%` }"></span>
        </div>
      </div>
      <label class="grow">
        合同文本
        <textarea :value="text" placeholder="粘贴合同或法律文档文本" @input="$emit('update:text', ($event.target as HTMLTextAreaElement).value)" />
      </label>
      <button class="primary" :disabled="busy" @click="$emit('importDocument')">导入并向量化</button>
      <div v-if="ingestionJobs.length > 0" class="job-list">
        <article v-for="job in ingestionJobs.slice(0, 4)" :key="job.id" class="job-row">
          <div>
            <strong>{{ job.title }}</strong>
            <span :class="['job-badge', job.status]">{{ job.status }}</span>
          </div>
          <p>{{ job.message }}</p>
          <div class="progress">
            <span :style="{ width: `${job.progress}%` }"></span>
          </div>
        </article>
      </div>
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
          @click="$emit('selectDocument', document.id)"
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
          @click="$emit('update:selectedChunkKey', chunkKey(chunk.documentId, chunk.chunkIndex))"
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
</template>
