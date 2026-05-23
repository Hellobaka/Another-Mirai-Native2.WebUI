// ============================================================
// SignalR 事件载荷类型（服务端 → 客户端推送）
// 对照 API_SPEC.md #SignalR Hub 章节
// ============================================================

/** OnGroupMessage — 群消息 */
export interface GroupMessagePayload {
  pluginAppId: string
  type: number
  subType: number
  groupId: number
  qqId: number
  message: string
  rawMessage: string
  messageId: number
}

/** OnPrivateMessage — 私聊消息 */
export interface PrivateMessagePayload {
  pluginAppId: string
  type: number
  subType: number
  qqId: number
  message: string
  messageId: number
}

/** OnGroupBan — 群禁言 */
export interface GroupBanPayload {
  pluginAppId: string
  groupId: number
  qqId: number
  duration: number
}

/** OnGroupMemberAdded / OnGroupMemberLeft — 群成员变动 */
export interface GroupMemberChangedPayload {
  pluginAppId: string
  groupId: number
  qqId: number
}

/** OnFriendAdded — 新增好友 */
export interface FriendAddedPayload {
  pluginAppId: string
  qqId: number
}

/** OnMessageRecall — 消息撤回 */
export interface MessageRecallPayload {
  type: 'group' | 'private'
  targetId: number
  messageId: number
}

/** OnMessageSent — 消息发送回执 (CQP 回调) */
export interface MessageSentPayload {
  type: 'group' | 'private'
  targetId: number
  qqId: number
  message: string
  messageId: number
}

/** OnPluginStatusChanged — 插件状态变更 */
export interface PluginStatusChangedPayload {
  appId: string
  enabled: boolean
  hasConnection: boolean
}

/** OnPluginAdded — 新插件加载 */
export interface PluginAddedPayload {
  appId: string
  pluginName: string
  author: string
  version: string
  description: string
  authCode: number
  pid: number
}

/** OnLogAdded — 新日志 */
export interface LogAddedPayload {
  id: number
  time: string
  level: string
  source: string
  name: string
  detail: string
  status: string
}

/** OnLogStatusUpdated — 日志状态更新 */
export interface LogStatusUpdatedPayload {
  id: number
  status: string
}

/** OnQRCodeDisplay — 登录二维码 */
export interface QRCodeDisplayPayload {
  url: string
  imageBase64: string
}

/** OnQRCodeFinished — 扫码完成 (空载荷) */
export type QRCodeFinishedPayload = null

/** OnTestInvoked — 插件测试事件 */
export interface TestInvokedPayload {
  pluginAppId: string
  message: string
  response: string
}

/** 所有 SignalR 事件名 → 载荷类型映射 */
export interface SignalREventPayloadMap {
  OnGroupMessage: GroupMessagePayload
  OnPrivateMessage: PrivateMessagePayload
  OnGroupBan: GroupBanPayload
  OnGroupMemberAdded: GroupMemberChangedPayload
  OnGroupMemberLeft: GroupMemberChangedPayload
  OnFriendAdded: FriendAddedPayload
  OnMessageRecall: MessageRecallPayload
  OnMessageSent: MessageSentPayload
  OnPluginStatusChanged: PluginStatusChangedPayload
  OnPluginAdded: PluginAddedPayload
  OnLogAdded: LogAddedPayload
  OnLogStatusUpdated: LogStatusUpdatedPayload
  OnQRCodeDisplay: QRCodeDisplayPayload
  OnQRCodeFinished: QRCodeFinishedPayload
  OnTestInvoked: TestInvokedPayload
}
