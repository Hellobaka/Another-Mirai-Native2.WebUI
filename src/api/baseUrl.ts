const STORAGE_KEY = 'amn_api_base_url'

export function getApiBaseUrl(): string {
  const envRaw = import.meta.env.VITE_API_BASE_URL || ''
  const envUrl = normalizeUrl(envRaw)
  // In production, if env has a real absolute URL, it's locked — ignore localStorage
  if (!import.meta.env.DEV && envUrl && envUrl.startsWith('http')) {
    return envUrl
  }
  // Otherwise (dev or configurable), localStorage takes priority
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    return normalizeUrl(stored)
  }
  return envUrl
}

export function setApiBaseUrl(url: string): void {
  const normalized = normalizeUrl(url)
  if (normalized) {
    localStorage.setItem(STORAGE_KEY, normalized)
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '')
  return trimmed === '/' ? '' : trimmed
}
