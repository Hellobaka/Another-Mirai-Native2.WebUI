/** 单个配置项 (GET /api/config/core, GET /api/config/protocol/{name}) */
export interface GetConfigResponseItem {
  /** 配置项显示名称 */
  title: string
  /** 配置项说明 */
  description: string
  /** 值的数据类型（C# 类型名字符串） */
  type: string
  /** 当前值 */
  value: unknown
}

/** 修改配置请求 (POST /api/config/core, POST /api/config/protocol/{name}) */
export interface SetConfigRequest {
  /** 配置项键名 */
  key: string
  /** 新值 */
  value: unknown
}

/** 核心配置项键名 → 值的映射 */
export type CoreConfigMap = Record<string, GetConfigResponseItem>

/** 协议配置项键名 → 值的映射 */
export type ProtocolConfigMap = Record<string, GetConfigResponseItem>
