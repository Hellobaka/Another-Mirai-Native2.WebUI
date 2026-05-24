import axios from 'axios'

const TOKEN_KEY = 'amn_token'
const EXPIRES_KEY = 'amn_expires'

const http = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    // Skip forced logout for the refresh endpoint — auth store handles that case
    const isRefreshCall = error.config?.url?.includes('/auth/refresh')
    if (error.response?.status === 401 && !isRefreshCall) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(EXPIRES_KEY)
      window.location.replace('/login')
    }
    error.apiMessage = error.response?.data?.message || null
    return Promise.reject(error)
  },
)

/** Extract the best available error message from a failed request */
export function getErrorMessage(e: unknown, fallback: string): string {
  const err = e as { apiMessage?: string | null; message?: string; response?: { data?: { message?: string } } }
  return err?.apiMessage || err?.response?.data?.message || fallback
}

export default http
