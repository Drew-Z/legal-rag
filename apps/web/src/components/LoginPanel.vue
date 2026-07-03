<script setup lang="ts">
defineProps<{
  loginEmail: string;
  loginPassword: string;
  loginLoading: boolean;
  notice: string;
  demoEmail: string;
  demoPassword: string;
  demoNote: string;
}>();

defineEmits<{
  "update:loginEmail": [value: string];
  "update:loginPassword": [value: string];
  fillDemoCredentials: [];
  login: [];
}>();
</script>

<template>
  <div class="login-shell">
    <form class="login-panel" @submit.prevent="$emit('login')">
      <div class="brand login-brand">
        <div class="brand-mark">BL</div>
        <div>
          <strong>Biau Labs</strong>
          <span>Legal RAG 工作台</span>
        </div>
      </div>
      <div v-if="demoPassword" class="demo-access">
        <div>
          <strong>公开演示凭据</strong>
          <span>仅用于体验公开安全数据集，不是后台管理员账号。</span>
        </div>
        <dl>
          <div>
            <dt>邮箱</dt>
            <dd>{{ demoEmail }}</dd>
          </div>
          <div>
            <dt>密码</dt>
            <dd>{{ demoPassword }}</dd>
          </div>
        </dl>
        <p>{{ demoNote || "登录后可初始化公开安全数据集，体验引用溯源问答、合同审查和质量面板。" }}</p>
        <button type="button" class="secondary demo-fill" @click="$emit('fillDemoCredentials')">填入演示凭据</button>
      </div>
      <p v-else class="login-hint">当前工作台是受控演示入口；公开试用需部署环境显式配置低权限 demo 凭据。</p>
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
