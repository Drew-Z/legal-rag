<script setup lang="ts">
defineProps<{
  selectedProjectName: string;
  busy: boolean;
}>();

defineEmits<{
  seedDataset: [];
  fillSample: [];
}>();
</script>

<template>
  <header class="topbar">
    <div class="topbar-copy">
      <p class="topbar-eyebrow">AI APPLICATION WORKBENCH</p>
      <h1>法律智能机器人与合同审查 RAG 应用</h1>
      <p>{{ selectedProjectName }} · 导入公开安全数据、上传文档、查看引用依据，并导出结构化风险报告。</p>
    </div>
    <div class="topbar-actions">
      <button class="secondary" :disabled="busy" @click="$emit('seedDataset')">初始化公开数据集</button>
      <button class="secondary" @click="$emit('fillSample')">填入示例合同</button>
    </div>
  </header>
</template>
