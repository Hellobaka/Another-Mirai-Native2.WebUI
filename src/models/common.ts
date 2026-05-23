/** API 统一响应体 */
export interface ApiResponse<T = unknown> {
  /** 状态码，0 表示成功 */
  code: number
  /** 响应数据 */
  data: T
  /** 错误或提示信息 */
  message: string | null
}

/** 标准分页响应 */
export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
