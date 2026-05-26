import { getApiBaseUrl } from './baseUrl'

function token(): string {
  return localStorage.getItem('amn_token') || ''
}

export function cacheUrl(type: 'image' | 'record' | 'video', file: string): string {
  if (!file) return ''
  if (file.startsWith('http')) {
    const sep = file.includes('?') ? '&' : '?'
    return `${file}${sep}access_token=${token()}`
  }
  const base = getApiBaseUrl()
  const sep = '?'
  return `${base}/api/cache/${type}/${file}${sep}access_token=${token()}`
}
