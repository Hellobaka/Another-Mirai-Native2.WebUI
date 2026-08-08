import axios from 'axios'
import { getApiBaseUrl } from './baseUrl'

const TOKEN_KEY = 'amn_token'
const EXPIRES_KEY = 'amn_expires'

function resolveBaseURL(): string {
  const base = getApiBaseUrl()
  return base ? `${base}/api` : '/api'
}

const http = axios.create({
  baseURL: resolveBaseURL(),
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
    if (
      error.response?.status === 401 &&
      !isRefreshCall &&
      !window.location.pathname.startsWith('/login')
    ) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(EXPIRES_KEY)
      window.location.replace('/login')
    }
    error.apiMessage = error.response?.data?.message || null
    const errorData = error.response?.data as { data?: { errorType?: string } } | null
    error.apiErrorType = errorData?.data?.errorType || null
    const retryAfter = error.response?.headers?.['retry-after']
    error.retryAfter = retryAfter ? Number(retryAfter) : null
    return Promise.reject(error)
  },
)

/** Extract the best available error message from a failed request */
export function getErrorMessage(e: unknown, fallback: string): string {
  const err = e as {
    apiMessage?: string | null
    apiErrorType?: string | null
    retryAfter?: number | null
    message?: string
    code?: string
    response?: { status?: number; data?: { message?: string }; headers?: Record<string, string> }
    request?: unknown
  }

  // 429: rate-limited by server (sliding window)
  if (err.response?.status === 429) {
    const seconds = err.retryAfter ?? (Number(err.response?.headers?.['retry-after']) || 0)
    const friendly = seconds >= 60 ? `${Math.ceil(seconds / 60)} 分钟` : `${seconds} 秒`
    return seconds > 0
      ? `请求过于频繁，请 ${friendly}后再试`
      : err.response?.data?.message || '请求过于频繁，请稍后再试'
  }

  // API returned an error with a server message
  // 文件被其他程序占用：统一友好提示（即使后端 message 缺失）
  if (err.apiErrorType === 'file_in_use') return '文件被其他程序占用，请稍后重试'
  if (err.apiMessage) return err.apiMessage
  if (err.response?.data?.message) return err.response.data.message

  // Network error: request sent but no response received
  if (err.request && !err.response) return '网络错误，请检查后端是否可达'
  if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED')
    return '网络错误，请检查后端是否可达'

  // Plain Error thrown with a message (e.g. auth store business-logic errors)
  if (err.message) return err.message

  return fallback
}

/** 提取后端返回的业务错误类型（如 file_in_use / sql_syntax_error） */
export function getApiErrorType(e: unknown): string {
  return (e as { apiErrorType?: string | null })?.apiErrorType || ''
}

export default http
