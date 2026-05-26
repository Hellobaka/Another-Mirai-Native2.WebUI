const STORAGE_KEY = 'amn_api_base_url'

export function getApiBaseUrl(): string {
  return localStorage.getItem(STORAGE_KEY) || import.meta.env.VITE_API_BASE_URL || ''
}

export function setApiBaseUrl(url: string): void {
  if (url) {
    localStorage.setItem(STORAGE_KEY, url)
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}
