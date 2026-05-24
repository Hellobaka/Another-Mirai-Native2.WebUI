import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import http from '@/api/client'
import { refresh } from '@/api/auth'
import type { LoginRequest, LoginResponseData } from '@/models'

const TOKEN_KEY = 'amn_token'
const EXPIRES_KEY = 'amn_expires'
const LAST_REFRESH_KEY = 'amn_last_refresh'
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours

function loadToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(loadToken())
  const isAuthenticated = computed(() => token.value !== null)
  const lastRefreshedAt = ref<number>(
    Number(localStorage.getItem(LAST_REFRESH_KEY) ?? 0)
  )

  async function login(password: string): Promise<void> {
    const { data } = await http.post<{
      code: number
      data: LoginResponseData
    }>('/auth/login', { password } as LoginRequest)

    if (data.code !== 0) throw new Error(data.message ?? '登录失败')

    token.value = data.data.token
    localStorage.setItem(TOKEN_KEY, data.data.token)
    localStorage.setItem(EXPIRES_KEY, data.data.expiresAt)
    _recordRefresh()
  }

  function logout(): void {
    token.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EXPIRES_KEY)
    localStorage.removeItem(LAST_REFRESH_KEY)
    lastRefreshedAt.value = 0
  }

  function _recordRefresh(): void {
    const now = Date.now()
    lastRefreshedAt.value = now
    localStorage.setItem(LAST_REFRESH_KEY, String(now))
  }

  async function tryRefreshIfNeeded(): Promise<void> {
    if (!token.value) return
    if (Date.now() - lastRefreshedAt.value < REFRESH_INTERVAL_MS) return
    try {
      const { data } = await refresh()
      if (data.code === 0) {
        token.value = data.data.token
        localStorage.setItem(TOKEN_KEY, data.data.token)
        localStorage.setItem(EXPIRES_KEY, data.data.expiresAt)
        _recordRefresh()
      } else {
        logout()
      }
    } catch (e: any) {
      if (e?.response?.status === 401) {
        logout()
      }
    }
  }

  return { token, isAuthenticated, lastRefreshedAt, login, logout, tryRefreshIfNeeded }
})
