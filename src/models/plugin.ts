/** 插件列表项 (GET /api/plugin 及 启用/禁用/重载 响应) */
export interface PluginDto {
  authCode: number
  enabled: boolean
  pluginId: string
  pluginName: string
  author: string
  description: string
  version: string
  auth: number[]
}

/** 插件详细信息 (POST /api/plugin/{authCode}/info) */
export interface PluginDetail extends PluginDto {
  pluginType: number
}

/** PluginType 枚举 */
export const PluginTypeLabels: Record<number, string> = {
  0: '酷Q插件',
  1: '小栗子插件',
  2: '原生插件',
}

/** Auth 权限码 → 文本 */
export const AuthLabels: Record<number, string> = {
  20: '取Cookies',
  30: '接收语音',
  101: '发送群消息',
  103: '发送讨论组消息',
  106: '发送私聊消息',
  110: '发送赞',
  120: '置群员移除',
  121: '置群员禁言',
  122: '置群管理员',
  123: '置全群禁言',
  124: '置匿名群员禁言',
  125: '置群匿名设置',
  126: '置群成员名片',
  127: '置群退出',
  128: '置群成员专属头衔',
  130: '取群成员信息',
  131: '取陌生人信息',
  132: '取群信息',
  140: '置讨论组退出',
  150: '置好友添加请求',
  151: '置群添加请求',
  160: '取群成员列表',
  161: '取群列表',
  162: '取好友列表',
  180: '撤回消息',
}

export function authLabel(code: number): string {
  return AuthLabels[code] ?? `权限 ${code}`
}
