<script setup lang="ts">
defineProps<{
  loginEmail: string;
  loginPassword: string;
  loginLoading: boolean;
  notice: string;
}>();

defineEmits<{
  "update:loginEmail": [value: string];
  "update:loginPassword": [value: string];
  login: [];
}>();
</script>

<template>
  <div class="login-shell">
    <form class="login-panel" @submit.prevent="$emit('login')">
      <div class="brand login-brand">
        <div class="brand-mark">LR</div>
        <div>
          <strong>Legal RAG</strong>
          <span>合同审查工作台</span>
        </div>
      </div>
      <label>
        邮箱
        <input :value="loginEmail" autocomplete="username" @input="$emit('update:loginEmail', ($event.target as HTMLInputElement).value)" />
      </label>
      <label>
        密码
        <input
          :value="loginPassword"
          type="password"
          autocomplete="current-password"
          @input="$emit('update:loginPassword', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <button class="primary" :disabled="loginLoading">
        {{ loginLoading ? "登录中" : "登录" }}
      </button>
      <p v-if="notice" class="notice">{{ notice }}</p>
    </form>
  </div>
</template>

