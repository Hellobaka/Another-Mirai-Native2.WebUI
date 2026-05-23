/** 单条日志记录 */
export interface LogDto {
  /** 日志 ID */
  id: number
  /** 记录时间（ISO 字符串） */
  time: string
  /** 日志等级：0=Debug, 10=Info, 11=InfoSuccess, 12=InfoReceive, 13=InfoSend, 20=Warning, 30=Error, 40=Fatal */
  priority: number
  /** 产生日志的组件或插件名 */
  source: string
  /** 处理状态：unread / read */
  status: string
  /** 日志分类名 */
  name: string
  /** 日志详细内容 */
  detail: string
}

/** 日志分页查询结果 (GET /api/log) */
export interface LogQueryResultData {
  /** 当前页日志条目 */
  items: LogDto[]
  /** 符合条件的总记录数 */
  totalCount: number
  /** 总页数 */
  totalPage: number
}

/** 日志等级枚举 */
export const LogLevel = {
  Debug: 0,
  Info: 10,
  InfoSuccess: 11,
  InfoReceive: 12,
  InfoSend: 13,
  Warning: 20,
  Error: 30,
  Fatal: 40,
} as const

export type LogLevelValue = (typeof LogLevel)[keyof typeof LogLevel]
