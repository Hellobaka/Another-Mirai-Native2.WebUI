export const SignalREvents = {
  OnGroupMessage: 'OnGroupMessage',
  OnPrivateMessage: 'OnPrivateMessage',
  OnGroupBan: 'OnGroupBan',
  OnGroupMemberAdded: 'OnGroupMemberAdded',
  OnGroupMemberLeft: 'OnGroupMemberLeft',
  OnFriendAdded: 'OnFriendAdded',
  OnMessageRecall: 'OnMessageRecall',
  OnMessageSent: 'OnMessageSent',
  OnPluginStatusChanged: 'OnPluginStatusChanged',
  OnPluginAdded: 'OnPluginAdded',
  OnLogAdded: 'OnLogAdded',
  OnLogStatusUpdated: 'OnLogStatusUpdated',
  OnQRCodeDisplay: 'OnQRCodeDisplay',
  OnQRCodeFinished: 'OnQRCodeFinished',
  OnTestInvoked: 'OnTestInvoked',
} as const

export type SignalREventName = (typeof SignalREvents)[keyof typeof SignalREvents]
