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
        <v-avatar size="64" color="primary" class="mb-4">
          <v-icon icon="mdi-robot" size="36" />
        </v-avatar>
        <div class="text-h4 font-weight-bold">AMN2</div>
        <div class="text-body-2 text-medium-emphasis mt-1">Another-Mirai-Native 管理面板</div>
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

      <v-btn
        block
        color="primary"
        size="large"
        :loading="loading"
        @click="handleLogin"
      >
        登录
      </v-btn>
    </v-card>
  </div>
</template>

<style scoped>
.login-bg {
  background: radial-gradient(ellipse at top, rgba(var(--v-theme-primary), 0.08), transparent 60%);
}
.login-card {
  backdrop-filter: blur(24px);
}
</style>
