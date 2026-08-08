/** 文件管理器中的单个条目 (GET /api/files) */
export interface FileEntry {
  /** 名称 */
  name: string
  /** 相对文件管理器根目录的路径 */
  path: string
  /** 是否为目录 */
  isDirectory: boolean
  /** 文件大小（字节），目录通常为 0 */
  size: number
  /** 最后写入时间 */
  lastWriteTime: string
}

/** 目录列表响应 (GET /api/files) */
export interface FileListData {
  /** 文件管理器根目录的绝对路径（仅用于展示） */
  root: string
  /** 当前浏览的相对路径 */
  path: string
  /** 父目录相对路径，根目录为 "" */
  parent: string
  /** 当前目录下的条目 */
  items: FileEntry[]
}

/** 复制/移动请求 (POST /api/files/copy, POST /api/files/move) */
export interface CopyMoveRequest {
  /** 源路径列表 */
  sources: string[]
  /** 目标目录 */
  targetDir: string
}

/** 删除请求 (POST /api/files/delete) */
export interface DeleteRequest {
  /** 要删除的路径列表 */
  paths: string[]
}

/** 读取文本文件响应 (GET /api/files/text) */
export interface TextFileData {
  /** 文件相对路径 */
  path: string
  /** 文本内容 */
  content: string
  /** 识别的编码 */
  encoding: string
}

/** 文件夹大小统计 (GET /api/files/size) */
export interface FolderSizeData {
  /** 文件夹总大小（字节） */
  size: number
}

/** 搜索文件/文件夹结果 (GET /api/files/search) */
export interface SearchResultData {
  /** 匹配的条目 */
  items: FileEntry[]
  /** 全部命中数（可能大于返回条数） */
  total: number
}

/** 写入文本文件请求 (POST /api/files/text) */
export interface WriteTextRequest {
  /** 文件相对路径 */
  path: string
  /** 新内容 */
  content: string
  /** 指定编码（utf-8 / gbk / gb18030 / ansi / utf-16 / utf-16be），留空按原文件识别编码写回 */
  encoding?: string
}
