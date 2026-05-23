import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import http from '@/api/client'
import type { LoginRequest, LoginResponseData } from '@/models'

const TOKEN_KEY = 'amn_token'
const EXPIRES_KEY = 'amn_expires'

function loadToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY)
  const expires = localStorage.getItem(EXPIRES_KEY)
  if (token && expires) {
    if (new Date(expires).getTime() > Date.now()) {
      return token
    }
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EXPIRES_KEY)
  }
  return null
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(loadToken())
  const isAuthenticated = computed(() => token.value !== null)

  async function login(password: string): Promise<void> {
    const { data } = await http.post<{
      code: number
      data: LoginResponseData
    }>('/auth/login', { password } as LoginRequest)

    if (data.code !== 0) throw new Error(data.message ?? '登录失败')

    token.value = data.data.token
    localStorage.setItem(TOKEN_KEY, data.data.token)
    localStorage.setItem(EXPIRES_KEY, data.data.expiresAt)
  }

  function logout(): void {
    token.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EXPIRES_KEY)
  }

  return { token, isAuthenticated, login, logout }
})
