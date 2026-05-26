const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

function token(): string {
  return localStorage.getItem('amn_token') || ''
}

export function cacheUrl(type: 'image' | 'record' | 'video', file: string): string {
  if (!file) return ''
  if (file.startsWith('http')) {
    const sep = file.includes('?') ? '&' : '?'
    return `${file}${sep}access_token=${token()}`
  }
  const sep = '?'
  return `${API_BASE}/api/cache/${type}/${file}${sep}access_token=${token()}`
}
