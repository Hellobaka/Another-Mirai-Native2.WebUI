export const SignalREvents = {
  OnGroupMsg: 'OnGroupMsg',
  OnPrivateMsg: 'OnPrivateMsg',
  OnGroupAdded: 'OnGroupAdded',
  OnGroupLeft: 'OnGroupLeft',
  OnGroupBan: 'OnGroupBan',
  OnGroupMsgRecall: 'OnGroupMsgRecall',
  OnPrivateMsgRecall: 'OnPrivateMsgRecall',
  OnGroupMessageSend: 'OnGroupMessageSend',
  OnPrivateMessageSend: 'OnPrivateMessageSend',
  PluginEnableChanged: 'PluginEnableChanged',
  PluginAdded: 'PluginAdded',
  PluginRemoved: 'PluginRemoved',
  PluginConnectStatusChanged: 'PluginConnectStatusChanged',
  ProtocolOnline: 'ProtocolOnline',
  ProtocolOffline: 'ProtocolOffline',
  CurrentBotInfoChanged: 'CurrentBotInfoChanged',
  LogAdded: 'LogAdded',
  LogStatusUpdated: 'LogStatusUpdated',
  UsageUpdated: 'UsageUpdated',
  PluginUsageUpdated: 'PluginUsageUpdated',
} as const

export type SignalREventName = (typeof SignalREvents)[keyof typeof SignalREvents]
