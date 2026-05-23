/** 插件列表项 (GET /api/plugin/list 及 启用/禁用/重载 响应) */
export interface PluginDto {
  /** 插件授权码，用于 API 路由中标识插件 */
  authCode: number
  /** 是否已启用 */
  enabled: boolean
  /** 插件标识符（未启用时显示占位文本） */
  pluginId: string
  /** 插件名称 */
  pluginName: string
  /** 插件作者 */
  author: string
  /** 插件描述 */
  description: string
  /** 插件版本 */
  version: string
  /** 插件申请的 API 权限列表 */
  auth: number[]
}

/** 插件事件处理函数 (GET /api/plugin/{authCode}/info) */
export interface PluginEvent {
  id: number
  type: number
  name: string
  function: string
  priority: number
  address: number
}

/** 插件详细信息 (GET /api/plugin/{authCode}/info) */
export interface PluginDetail extends PluginDto {
  appId: string
  loaderType: number
  ret: number
  apiver: number
  version_id: number
  _event: PluginEvent[]
  menu: unknown[]
  status: unknown[]
}
