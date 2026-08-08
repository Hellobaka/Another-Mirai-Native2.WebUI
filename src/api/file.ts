import http from './client'
import type {
  ApiResponse,
  CopyMoveRequest,
  DeleteRequest,
  FileListData,
  FolderSizeData,
  SearchResultData,
  TextFileData,
  WriteTextRequest,
} from '@/models'

/** 浏览目录 (GET /api/files) */
export function listDirectory(path = '') {
  return http.get<ApiResponse<FileListData>>('/files', { params: { path } })
}

/** 新建文件夹 (POST /api/files/mkdir) */
export function createDirectory(path: string) {
  return http.post<ApiResponse<null>>('/files/mkdir', { path })
}

/** 新建文件 (POST /api/files/mkfile) */
export function createFile(path: string, content = '') {
  return http.post<ApiResponse<null>>('/files/mkfile', { path, content })
}

/** 重命名 (POST /api/files/rename) */
export function renameEntry(path: string, newName: string) {
  return http.post<ApiResponse<null>>('/files/rename', { path, newName })
}

/** 复制 (POST /api/files/copy) */
export function copyEntries(sources: string[], targetDir: string) {
  return http.post<ApiResponse<null>>('/files/copy', { sources, targetDir } satisfies CopyMoveRequest)
}

/** 移动 (POST /api/files/move) */
export function moveEntries(sources: string[], targetDir: string) {
  return http.post<ApiResponse<null>>('/files/move', { sources, targetDir } satisfies CopyMoveRequest)
}

/** 删除到回收站 (POST /api/files/delete) */
export function deleteEntries(paths: string[]) {
  return http.post<ApiResponse<null>>('/files/delete', { paths } satisfies DeleteRequest)
}

/** 读取文本文件 (GET /api/files/text)，encoding 留空按自动探测 */
export function readTextFile(path: string, encoding = '') {
  return http.get<ApiResponse<TextFileData>>('/files/text', {
    params: encoding ? { path, encoding } : { path },
  })
}

/** 写入文本文件 (POST /api/files/text)，encoding 留空按原文件识别编码写回 */
export function writeTextFile(path: string, content: string, encoding = '') {
  return http.post<ApiResponse<null>>('/files/text', {
    path,
    content,
    ...(encoding ? { encoding } : {}),
  } satisfies WriteTextRequest)
}

/** 下载文件/文件夹 (GET /api/files/download)；传多个 path 时后端流式打包为 ZIP */
export function downloadFiles(paths: string[]) {
  return http.get<Blob>('/files/download', {
    params: { path: paths },
    paramsSerializer: { indexes: null },
    responseType: 'blob',
    // 文件夹打包为大 ZIP 时耗时较长，放宽超时
    timeout: 300000,
  })
}

/** 下载单个文件/文件夹 (GET /api/files/download) */
export function downloadFile(path: string) {
  return downloadFiles([path])
}

/** 统计文件夹大小 (GET /api/files/size) */
export function getFolderSize(path: string) {
  return http.get<ApiResponse<FolderSizeData>>('/files/size', { params: { path } })
}

/** 搜索文件/文件夹 (GET /api/files/search)，pattern 必填，path 为起始目录（默认根目录），limit 最多返回条数（默认 200） */
export function searchFiles(pattern: string, path = '', limit = 200) {
  return http.get<ApiResponse<SearchResultData>>('/files/search', {
    params: path ? { pattern, path, limit } : { pattern, limit },
  })
}

/** 上传文件 (POST /api/files/upload) */
export function uploadFiles(files: File[], targetDir: string) {
  const form = new FormData()
  for (const file of files) form.append('files', file)
  form.append('targetDir', targetDir)
  // 显式指定 multipart，避免实例默认的 application/json 覆盖导致后端解析不到文件
  return http.post<ApiResponse<null>>('/files/upload', form, {
    timeout: 600000,
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
