export interface ApiErrorPayload {
  message: string | null
  errorType: string | null
}

/** 从任意响应体提取后端业务错误信息（{ message, data: { errorType } }） */
export function parseApiErrorPayload(data: unknown): ApiErrorPayload {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return { message: null, errorType: null }
  const body = data as { message?: unknown; data?: unknown }
  const inner =
    body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? (body.data as { errorType?: unknown })
      : null
  return {
    message: typeof body.message === 'string' ? body.message : null,
    errorType: inner && typeof inner.errorType === 'string' ? inner.errorType : null,
  }
}

/** 下载等 blob 响应出错时，把响应体按 JSON 解析以还原后端错误信息 */
export async function parseBlobError(blob: Blob): Promise<ApiErrorPayload> {
  try {
    return parseApiErrorPayload(JSON.parse(await blob.text()))
  } catch {
    return { message: null, errorType: null }
  }
}
