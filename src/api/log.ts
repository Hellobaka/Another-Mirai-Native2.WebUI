import http from './client'
import type { ApiResponse, LogQueryResultData } from '@/models'

export interface LogQueryParams {
  priority: number
  pageIndex: number
  pageSize: number
  search?: string
  start?: string
  end?: string
  asc?: boolean
}

export function queryLogs(params: LogQueryParams) {
  return http.get<ApiResponse<LogQueryResultData>>('/log', { params })
}
