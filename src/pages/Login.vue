<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/api/client'

const auth = useAuthStore()
const router = useRouter()

const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!password.value) return
  loading.value = true
  error.value = ''
  try {
    await auth.login(password.value)
    router.push({ name: 'Dashboard' })
  } catch (e) {
    error.value = getErrorMessage(e, '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-bg fill-height d-flex align-center justify-center">
    <v-card class="glass-card pa-8 login-card" max-width="420" width="100%">
      <div class="text-center mb-6">
        <div class="text-h5 font-weight-bold mt-1">
          Another-Mirai-Native2
        </div>
        <div class="text-caption text-medium-emphasis mt-1">管理面板</div>
      </div>

      <v-text-field
        v-model="password"
        label="密码"
        type="password"
        variant="outlined"
        prepend-inner-icon="mdi-lock"
        :disabled="loading"
        @keyup.enter="handleLogin"
      />

      <v-alert v-if="error" type="error" variant="tonal" class="mb-4" density="compact" closable>
        {{ error }}
      </v-alert>

      <v-btn block color="primary" size="large" :loading="loading" @click="handleLogin">
        登录
      </v-btn>
    </v-card>
  </div>
</template>

<style scoped>
.login-bg {
  background: radial-gradient(ellipse at 50% 40%, rgba(var(--v-theme-primary), 0.07) 0%, transparent 65%);
}

.login-card {
  backdrop-filter: blur(32px);
  border: 1px solid rgba(var(--v-theme-primary), 0.45) !important;
  box-shadow:
    0 0 0 1px rgba(var(--v-theme-primary), 0.15),
    0 0 24px rgba(var(--v-theme-primary), 0.2),
    0 0 64px rgba(var(--v-theme-primary), 0.1),
    0 16px 48px rgba(0, 0, 0, 0.3) !important;
  animation: border-pulse 4s ease-in-out infinite;
}

@keyframes border-pulse {
  0%, 100% { box-shadow: 0 0 0 1px rgba(var(--v-theme-primary), 0.15), 0 0 24px rgba(var(--v-theme-primary), 0.2), 0 0 64px rgba(var(--v-theme-primary), 0.1), 0 16px 48px rgba(0, 0, 0, 0.3); }
  50%       { box-shadow: 0 0 0 1px rgba(var(--v-theme-primary), 0.25), 0 0 32px rgba(var(--v-theme-primary), 0.32), 0 0 80px rgba(var(--v-theme-primary), 0.16), 0 16px 48px rgba(0, 0, 0, 0.3); }
}
</style>
