import http from './client'
import type { ApiResponse, PluginDto, PluginDetail } from '@/models'

export function getPluginList() {
  return http.get<ApiResponse<PluginDto[]>>('/plugin/list')
}

export function getPluginInfo(authCode: number) {
  return http.get<ApiResponse<PluginDetail>>(`/plugin/${authCode}/info`)
}

export function enablePlugin(authCode: number) {
  return http.post<ApiResponse<PluginDto>>(`/plugin/${authCode}/enable`)
}

export function disablePlugin(authCode: number) {
  return http.post<ApiResponse<PluginDto>>(`/plugin/${authCode}/disable`)
}

export function reloadPlugin(authCode: number) {
  return http.post<ApiResponse<PluginDto>>(`/plugin/${authCode}/reload`)
}

export function reloadAllPlugins() {
  return http.post<ApiResponse<PluginDto[]>>('/plugin/reload-all')
}
