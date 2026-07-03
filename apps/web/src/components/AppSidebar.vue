<script setup lang="ts">
import type { ProjectSpace } from "@legal-rag/shared";
import type { View } from "../types";

defineProps<{
  activeView: View;
  projects: ProjectSpace[];
  selectedProjectId: string;
  projectName: string;
  busy: boolean;
  apiStatus: string;
  authEnabled: boolean;
}>();

defineEmits<{
  "update:activeView": [value: View];
  "update:selectedProjectId": [value: string];
  "update:projectName": [value: string];
  changeProject: [];
  createProject: [];
  logout: [];
}>();
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark"><img src="/biau-port-icon.svg" alt="" aria-hidden="true" /></div>
      <div>
        <strong>BIAU Port / 泊岸</strong>
        <span>Legal RAG 工作台</span>
      </div>
    </div>

    <nav class="nav">
      <button :class="{ active: activeView === 'knowledge' }" @click="$emit('update:activeView', 'knowledge')">
        <span class="nav-icon">▦</span>
        知识库
      </button>
      <button :class="{ active: activeView === 'qa' }" @click="$emit('update:activeView', 'qa')">
        <span class="nav-icon">?</span>
        智能问答
      </button>
      <button :class="{ active: activeView === 'review' }" @click="$emit('update:activeView', 'review')">
        <span class="nav-icon">!</span>
        合同审查
      </button>
      <button :class="{ active: activeView === 'quality' }" @click="$emit('update:activeView', 'quality')">
        <span class="nav-icon">✓</span>
        质量面板
      </button>
    </nav>

    <div class="project-switcher">
      <label>
        项目空间
        <select
          :value="selectedProjectId"
          @change="$emit('update:selectedProjectId', ($event.target as HTMLSelectElement).value); $emit('changeProject')"
        >
          <option v-for="project in projects" :key="project.id" :value="project.id">
            {{ project.name }}
          </option>
        </select>
      </label>
      <div class="project-create">
        <input
          :value="projectName"
          placeholder="新建项目"
          @input="$emit('update:projectName', ($event.target as HTMLInputElement).value)"
          @keyup.enter="$emit('createProject')"
        />
        <button :disabled="busy" @click="$emit('createProject')">+</button>
      </div>
    </div>

    <div class="status">
      <span>API</span>
      <strong>{{ apiStatus }}</strong>
    </div>
    <button v-if="authEnabled" class="logout-button" @click="$emit('logout')">退出登录</button>
  </aside>
</template>
