// Message item types from parsed message chain (API_SPEC.md 附录：消息链格式)

export const MessageItemType = {
  Unknown: 0,
  Face: 1,
  Bface: 2,
  Image: 3,
  Record: 4,
  Video: 5,
  At: 6,
  Rps: 7,
  Shake: 8,
  Dice: 9,
  Poke: 10,
  Rich: 11,
  Reply: 12,
  Text: 13,
} as const

export type MessageItemTypeValue = (typeof MessageItemType)[keyof typeof MessageItemType]

export interface MessageItemBase {
  messageItemType: number
}

export interface TextItem extends MessageItemBase {
  messageItemType: typeof MessageItemType.Text
  content: string
}

export interface FaceItem extends MessageItemBase {
  messageItemType: typeof MessageItemType.Face
  id: number
}

export interface BFaceItem extends MessageItemBase {
  messageItemType: typeof MessageItemType.Bface
  id: number
}

export interface ImageItem extends MessageItemBase {
  messageItemType: typeof MessageItemType.Image
  hash: string
  filePath: string | null
  isFlash: boolean
  isEmoji: boolean
}

export interface RecordItem extends MessageItemBase {
  messageItemType: typeof MessageItemType.Record
  hash: string
  filePath: string | null
}

export interface AtItem extends MessageItemBase {
  messageItemType: typeof MessageItemType.At
  qq: number
  isAtAll: boolean
}

export interface ReplyItem extends MessageItemBase {
  messageItemType: typeof MessageItemType.Reply
  id: number
}

export interface DiceItem extends MessageItemBase {
  messageItemType: typeof MessageItemType.Dice
  type: number
}

export interface RpsItem extends MessageItemBase {
  messageItemType: typeof MessageItemType.Rps
  // no extra fields
}

export interface ShakeItem extends MessageItemBase {
  messageItemType: typeof MessageItemType.Shake
}

export interface PokeItem extends MessageItemBase {
  messageItemType: typeof MessageItemType.Poke
}

export type MessageItem =
  | TextItem
  | FaceItem
  | BFaceItem
  | ImageItem
  | RecordItem
  | AtItem
  | ReplyItem
  | DiceItem
  | RpsItem
  | ShakeItem
  | PokeItem
  | MessageItemBase

// ChatHistoryType enum
export const ChatHistoryType = {
  Group: 0,
  Private: 1,
  Notice: 2,
} as const
export type ChatHistoryTypeValue = (typeof ChatHistoryType)[keyof typeof ChatHistoryType]

// Chat conversation list item
export interface ChatConversation {
  id: number
  parentID: number   // group ID or QQ number for history queries
  senderID: number
  type: number       // ChatHistoryType: 0=Group, 1=Private, 2=Notice
  name: string       // display name (may be empty; fallback to parentID)
  time: number       // unix timestamp (seconds)
  message: MessageItemBase[]  // last message preview (parsed chain)
  unreadCount: number
  isPinned: boolean
}

// Chat history message
export interface ChatMessage {
  id: number
  time: string            // ISO datetime
  type: number            // ChatHistoryType
  parentID: number
  senderID: number        // sender QQ number
  message: MessageItemBase[]  // parsed message chain
  msgId: number
  recalled: boolean
}

// Send message request
export interface SendMessageRequest {
  chatType: number   // 0=Private, 1=Group
  parentId: number
  message: string
}
