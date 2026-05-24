import http from './client'
import type { ApiResponse, CoreConfigMap, ProtocolConfigMap, SetConfigRequest } from '@/models'

export function getCoreConfig() {
  return http.get<ApiResponse<CoreConfigMap>>('/config/core')
}

export function setCoreConfig(key: string, value: unknown) {
  return http.post<ApiResponse>('/config/core', { key, value } as SetConfigRequest)
}

export function getProtocolConfig(name: string) {
  return http.get<ApiResponse<ProtocolConfigMap>>(`/config/protocol/${name}`)
}

export function setProtocolConfig(name: string, key: string, value: unknown) {
  return http.post<ApiResponse>(`/config/protocol/${name}`, { key, value } as SetConfigRequest)
}

export function getWebUIConfig() {
  return http.get<ApiResponse<CoreConfigMap>>('/config/webui')
}

export function setWebUIConfig(key: string, value: unknown) {
  return http.post<ApiResponse>('/config/webui', { key, value } as SetConfigRequest)
}
