/** 登录请求 */
export interface LoginRequest {
  password: string
}

/** 登录 / Token 刷新响应 */
export interface LoginResponseData {
  /** JWT Token 字符串 */
  token: string
  /** Token 过期时间（UTC ISO 字符串） */
  expiresAt: string
}
