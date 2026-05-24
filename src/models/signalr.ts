// ============================================================
// SignalR 事件载荷类型（服务端 → 客户端推送）
// 对照 API_SPEC.md #SignalR Hub 章节
// ============================================================

import type { PluginDto } from './plugin'
import type { LogDto } from './log'
import type { DashboardPluginItem } from './dashboard'

export interface GroupMsgPayload {
  msgId: number
  group: number
  qq: number
  msg: string
  time: string
}

export interface PrivateMsgPayload {
  msgId: number
  qq: number
  msg: string
  time: string
}

export interface GroupMemberChangedPayload {
  group: number
  qq: number
}

export interface GroupBanPayload {
  group: number
  qq: number
  operatedQQ: number
  time: string
}

export interface MsgRecallPayload {
  msgId: number
  qq: number
  msg: string
}

export interface GroupMessageSendPayload {
  msgId: number
  group: number
  msg: string
  plugin: PluginDto
}

export interface PrivateMessageSendPayload {
  msgId: number
  qq: number
  msg: string
  plugin: PluginDto
}

export interface PluginChangedPayload {
  plugin: PluginDto
}

export interface ProtocolStatusPayload {
  name: string
}

export interface CurrentBotInfoChangedPayload {
  nick: string
  qq: number
}

export interface LogAddedPayload {
  logId: number
  log: LogDto
}

export interface LogStatusUpdatedPayload {
  logId: number
  status: string
}

export interface UsageUpdatedPayload {
  cpuUsage: number
  memoryUsage: number
  cpuCurrentFrequency: number
  usedMemoryInMB: number
  totalMemoryInMB: number
}

export interface PluginUsageUpdatedPayload {
  totalProcessMemory: number
  totalProcessCPU: number
  processedMessageCount: number
  sentMessageCount: number
  pluginUsages: DashboardPluginItem[]
}

export interface SignalREventPayloadMap {
  OnGroupMsg: GroupMsgPayload
  OnPrivateMsg: PrivateMsgPayload
  OnGroupAdded: GroupMemberChangedPayload
  OnGroupLeft: GroupMemberChangedPayload
  OnGroupBan: GroupBanPayload
  OnGroupMsgRecall: MsgRecallPayload
  OnPrivateMsgRecall: MsgRecallPayload
  OnGroupMessageSend: GroupMessageSendPayload
  OnPrivateMessageSend: PrivateMessageSendPayload
  PluginEnableChanged: PluginChangedPayload
  PluginAdded: PluginChangedPayload
  PluginRemoved: PluginChangedPayload
  PluginConnectStatusChanged: PluginChangedPayload
  ProtocolOnline: ProtocolStatusPayload
  ProtocolOffline: ProtocolStatusPayload
  CurrentBotInfoChanged: CurrentBotInfoChangedPayload
  LogAdded: LogAddedPayload
  LogStatusUpdated: LogStatusUpdatedPayload
  UsageUpdated: UsageUpdatedPayload
  PluginUsageUpdated: PluginUsageUpdatedPayload
}

