import http from './client'
import type { ApiResponse, ProtocolStatusData } from '@/models'

export function getProtocolList() {
  return http.get<ApiResponse<string[]>>('/protocol/list')
}

export function getCurrentProtocol() {
  return http.get<ApiResponse<ProtocolStatusData>>('/protocol/current')
}

export function disconnectProtocol() {
  return http.post<ApiResponse>('/protocol/disconnect')
}

export function connectProtocol(name: string) {
  return http.post<ApiResponse>(`/protocol/connect/${name}`)
}

export function getProtocolConfig(name: string) {
  return http.get<ApiResponse<Record<string, string>>>(`/protocol/config/${name}`)
}

export function setProtocolConfig(name: string, config: Record<string, string>) {
  return http.post<ApiResponse>(`/protocol/config/${name}`, config)
}
