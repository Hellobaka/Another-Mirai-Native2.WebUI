import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getConversations, getHistory, sendMessage, getFriendNick, getGroupName, clearUnread as clearUnreadApi } from '@/api/chat'
import { useHubStore } from './hub'
import { SignalREvents } from '@/signalr/events'
import { ChatHistoryType } from '@/models'
import type { ChatConversation, ChatMessage, SendMessageRequest, GroupMsgPayload, PrivateMsgPayload, MsgRecallPayload, GroupMemberChangedPayload, GroupBanPayload, MessageItemBase } from '@/models'

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<ChatConversation[]>([])
  const messages = ref<ChatMessage[]>([])
  const currentChat = ref<{ type: number; parentId: number } | null>(null)
  const loading = ref(false)
  const msgLoading = ref(false)
  const sending = ref(false)
  const hasMore = ref(true)

  // ── Nickname cache (localStorage backed) ──
  const NICK_CACHE_KEY = 'amn_nick_cache'
  const NICK_CACHE_TTL = 3600000 // 1 hour

  function loadNickCache(): Record<number, string> {
    try {
      const raw = localStorage.getItem(NICK_CACHE_KEY)
      if (raw) {
        const { data, ts } = JSON.parse(raw)
        if (Date.now() - ts < NICK_CACHE_TTL) return data
      }
    } catch { /* */ }
    return {}
  }

  function saveNickCache(map: Record<number, string>) {
    localStorage.setItem(NICK_CACHE_KEY, JSON.stringify({ data: map, ts: Date.now() }))
  }

  const nickCache = ref<Record<number, string>>(loadNickCache())
  const botQQ = ref(0)

  function setBotQQ(qq: number) { botQQ.value = qq }

  function getCachedNick(qq: number): string {
    return nickCache.value[qq] || ''
  }

  async function fetchNick(qq: number): Promise<string> {
    if (nickCache.value[qq]) return nickCache.value[qq]
    try {
      const r = await getFriendNick(qq)
      if (r.data.code === 0) {
        nickCache.value[qq] = r.data.data.nick
        saveNickCache(nickCache.value)
        return r.data.data.nick
      }
    } catch { /* */ }
    return String(qq)
  }

  function msgItemsToPreview(raw: MessageItemBase[] | string): string {
    if (!raw) return '[消息]'
    // Legacy: string from old API
    if (typeof raw === 'string') return raw || '[消息]'
    // New: MessageItemBase[]
    if (!Array.isArray(raw) || raw.length === 0) return '[消息]'
    return raw.map((m: Record<string, unknown>) => {
      if (m.messageItemType === 13) return String(m.content ?? '')
      if (m.messageItemType === 3) return '[图片]'
      if (m.messageItemType === 4) return '[语音]'
      if (m.messageItemType === 1 || m.messageItemType === 2) return '[表情]'
      if (m.messageItemType === 6) return '@' + String((m as Record<string, unknown>).target ?? '')
      if (m.messageItemType === 14) return `[文件] ${String((m as Record<string, unknown>).fileName ?? '')}`
      return ''
    }).filter(Boolean).join('') || '[消息]'
  }

  function convPreview(conv: ChatConversation): string {
    const nick = nickCache.value[conv.senderID] || ''
    const isSelf = botQQ.value > 0 && conv.senderID === botQQ.value
    const prefix = nick && !isSelf ? `${nick}: ` : ''
    const body = msgItemsToPreview(conv.message)
    return `${prefix}${body}`
  }

  // ── Unread persistence ──
  const UNREAD_KEY = 'amn_chat_unread'

  function loadUnreadCache(): Record<string, number> {
    try { return JSON.parse(localStorage.getItem(UNREAD_KEY) || '{}') } catch { return {} }
  }

  function saveUnreadCache(map: Record<string, number>) {
    localStorage.setItem(UNREAD_KEY, JSON.stringify(map))
  }

  function unreadCacheKey(type: number, parentId: number) {
    return `${type}:${parentId}`
  }

  function syncUnreadFromCache() {
    const cache = loadUnreadCache()
    for (const conv of conversations.value) {
      const k = unreadCacheKey(conv.type, conv.parentID)
      if (cache[k] !== undefined) conv.unreadCount = cache[k]
    }
  }

  function flushUnreadToCache() {
    const cache: Record<string, number> = {}
    for (const conv of conversations.value) {
      if (conv.unreadCount > 0) {
        cache[unreadCacheKey(conv.type, conv.parentID)] = conv.unreadCount
      }
    }
    saveUnreadCache(cache)
  }

  const currentChatType = computed(() =>
    currentChat.value?.type ?? ChatHistoryType.Group,
  )

  async function fetchConversations() {
    loading.value = true
    try {
      const res = await getConversations()
      if (res.data.code === 0) {
        conversations.value = res.data.data
        // Server unread overwrites local cache for synced conversations
        flushUnreadToCache()
        // Preload sender nicks
        for (const conv of conversations.value) {
          if (conv.senderID && !nickCache.value[conv.senderID]) {
            fetchNick(conv.senderID) // fire-and-forget
          }
        }
        // Fetch names for conversations that don't have one
        for (const conv of conversations.value) {
          if (conv.name) continue
          try {
            if (conv.type === ChatHistoryType.Group) {
              const r = await getGroupName(conv.parentID)
              if (r.data.code === 0) conv.name = r.data.data.groupName
            } else if (conv.type === ChatHistoryType.Private) {
              const r = await getFriendNick(conv.parentID)
              if (r.data.code === 0) conv.name = r.data.data.nick
            }
          } catch { /* skip failed name fetch */ }
        }
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchMessages(chatType: number, parentId: number, page = 1) {
    msgLoading.value = true
    try {
      const res = await getHistory(chatType, parentId, page)
      if (res.data.code === 0) {
        // Response is ChatMessage[], oldest first
        if (page === 1) {
          messages.value = res.data.data
        } else {
          messages.value = [...res.data.data, ...messages.value]
        }
        hasMore.value = res.data.data.length >= 50
      }
    } finally {
      msgLoading.value = false
    }
  }

  function selectConversation(conv: ChatConversation) {
    currentChat.value = { type: conv.type, parentId: conv.parentID }
    fetchMessages(conv.type, conv.parentID)
    if (conv.unreadCount > 0) {
      conv.unreadCount = 0
      flushUnreadToCache()
      clearUnreadApi(conv.type, conv.parentID).catch(() => { /* fire and forget */ })
    }
  }

  function closeConversation() {
    currentChat.value = null
    messages.value = []
  }

  async function sendMsg(text: string) {
    if (!currentChat.value || !text.trim()) return
    sending.value = true
    try {
      const body: SendMessageRequest = {
        chatType: currentChatType.value,
        parentId: currentChat.value.parentId,
        message: text,
      }
      await sendMessage(body)
    } finally {
      sending.value = false
    }
  }

  function ensureConversation(
    chatType: number,
    parentId: number,
    senderID: number,
  ): ChatConversation {
    let conv = conversations.value.find(
      (c) => c.type === chatType && c.parentID === parentId,
    )
    if (!conv) {
      conv = {
        parentID: parentId,
        senderID,
        type: chatType,
        name: '',
        time: '',
        message: [],
        unreadCount: 0,
        isPinned: false,
      }
      conversations.value.unshift(conv)
      // Fetch name async
      if (chatType === ChatHistoryType.Group || chatType === ChatHistoryType.Notice) {
        getGroupName(parentId).then((r) => {
          if (r.data.code === 0) conv!.name = r.data.data.groupName
        })
      } else {
        getFriendNick(parentId).then((r) => {
          if (r.data.code === 0) conv!.name = r.data.data.nick
        })
      }
    }
    return conv
  }

  function clearUnread(conv: ChatConversation) {
    conv.unreadCount = 0
    flushUnreadToCache()
    clearUnreadApi(conv.type, conv.parentID).catch(() => { /* fire and forget */ })
  }

  function touchConversation(chatType: number, parentId: number, message: MessageItemBase[], time: string, senderID: number) {
    const conv = ensureConversation(chatType, parentId, senderID)
    if (!nickCache.value[senderID]) fetchNick(senderID)
    conv.message = message
    conv.time = time
    conv.senderID = senderID
    // Re-sort: move to top
    const idx = conversations.value.indexOf(conv)
    if (idx > 0) {
      conversations.value.splice(idx, 1)
      conversations.value.unshift(conv)
    }
  }

  function appendRealTimeMessage(item: ChatMessage, chatType: number, parentId: number) {
    const conv = ensureConversation(chatType, parentId, item.senderID)
    if (!nickCache.value[item.senderID]) fetchNick(item.senderID)
    conv.message = item.message
    conv.time = item.time
    conv.senderID = item.senderID

    // Re-sort: move updated conversation to top
    const idx = conversations.value.indexOf(conv)
    if (idx > 0) {
      conversations.value.splice(idx, 1)
      conversations.value.unshift(conv)
    }

    if (!currentChat.value || currentChat.value.parentId !== parentId) {
      conv.unreadCount++
      flushUnreadToCache()
    }

    if (
      currentChat.value &&
      currentChat.value.type === chatType &&
      currentChat.value.parentId === parentId
    ) {
      messages.value.push(item)
    }
  }

  // Register SignalR handlers
  const hub = useHubStore()
  hub.on(SignalREvents.OnGroupMsg, (data: GroupMsgPayload) => {
    appendRealTimeMessage(
      {
        id: 0, msgId: data.msgId,
        type: ChatHistoryType.Group,
        parentID: data.group,
        senderID: data.qq,
        message: data.msg,
        time: data.time,
        recalled: false,
      },
      ChatHistoryType.Group,
      data.group,
    )
  })
  hub.on(SignalREvents.OnPrivateMsg, (data: PrivateMsgPayload) => {
    appendRealTimeMessage(
      {
        id: 0, msgId: data.msgId,
        type: ChatHistoryType.Private,
        parentID: data.qq,
        senderID: data.qq,
        message: data.msg,
        time: data.time,
        recalled: false,
      },
      ChatHistoryType.Private,
      data.qq,
    )
  })

  function markRecalled(msgId: number) {
    const msg = messages.value.find((m) => m.msgId === msgId)
    if (msg) msg.recalled = true
  }

  hub.on(SignalREvents.OnGroupMsgRecall, (data: MsgRecallPayload) => {
    markRecalled(data.msgId)
  })
  hub.on(SignalREvents.OnPrivateMsgRecall, (data: MsgRecallPayload) => {
    markRecalled(data.msgId)
  })

  // ── Notice events ──
  function makeNoticeText(content: string): MessageItemBase[] {
    return [{ messageItemType: 13, content } as MessageItemBase]
  }

  hub.on(SignalREvents.OnGroupAdded, async (data: GroupMemberChangedPayload) => {
    let nick = String(data.qq)
    try { nick = await fetchNick(data.qq) } catch { /* */ }
    appendRealTimeMessage(
      { id: 0, msgId: 0, type: ChatHistoryType.Notice, parentID: data.group, senderID: data.qq, message: makeNoticeText(`${nick} 加入了本群`), time: new Date().toISOString(), recalled: false },
      ChatHistoryType.Notice, data.group,
    )
  })

  hub.on(SignalREvents.OnGroupLeft, async (data: GroupMemberChangedPayload) => {
    let nick = String(data.qq)
    try { nick = await fetchNick(data.qq) } catch { /* */ }
    appendRealTimeMessage(
      { id: 0, msgId: 0, type: ChatHistoryType.Notice, parentID: data.group, senderID: data.qq, message: makeNoticeText(`${nick} 离开了群`), time: new Date().toISOString(), recalled: false },
      ChatHistoryType.Notice, data.group,
    )
  })

  hub.on(SignalREvents.OnGroupBan, async (data: GroupBanPayload) => {
    let banNick = String(data.qq)
    let targetNick = String(data.operatedQQ)
    try { banNick = await fetchNick(data.qq) } catch { /* */ }
    try { targetNick = await fetchNick(data.operatedQQ) } catch { /* */ }
    const duration = Number(data.time)
    const timeStr = duration > 0 ? `${duration}秒` : '永久'
    appendRealTimeMessage(
      { id: 0, msgId: 0, type: ChatHistoryType.Notice, parentID: data.group, senderID: data.qq, message: makeNoticeText(`${banNick} 禁言了 ${targetNick} ${timeStr}`), time: new Date().toISOString(), recalled: false },
      ChatHistoryType.Notice, data.group,
    )
  })

  return {
    conversations, messages, currentChat, loading, msgLoading,
    sending, hasMore, currentChatType, convPreview,
    fetchConversations, fetchMessages, selectConversation, closeConversation,
    sendMsg, clearUnread, touchConversation, botQQ, setBotQQ, getCachedNick, fetchNick,
  }
})
