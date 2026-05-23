import http from './client'
import type {
  ApiResponse,
  DashboardInfoData,
  UsageData,
  PluginUsageData,
} from '@/models'

export function getBaseInformation() {
  return http.get<ApiResponse<DashboardInfoData>>('/dashboard/base-information')
}

export function getUsages() {
  return http.get<ApiResponse<UsageData>>('/dashboard/usages')
}

export function getPluginUsages() {
  return http.get<ApiResponse<PluginUsageData>>('/dashboard/plugin-usages')
}
