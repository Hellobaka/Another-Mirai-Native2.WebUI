import http from './client'
import type { ApiResponse, LoginRequest, LoginResponseData } from '@/models'

export function login(password: string) {
  return http.post<ApiResponse<LoginResponseData>>('/auth/login', {
    password,
  } as LoginRequest)
}

export function refresh() {
  return http.get<ApiResponse<{ valid: boolean }>>('/auth/refresh')
}
