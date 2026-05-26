<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { ChatHistoryType, MessageItemType } from '@/models'
import type { MessageItemBase, ChatMessage } from '@/models'
import { useChatStore } from '@/stores/chat'
import { getHistory, getMessage } from '@/api/chat'
import { cacheUrl } from '@/api/cache'
import { useNotifyStore } from '@/stores/notify'

const app = useAppStore()
const chat = useChatStore()
const notify = useNotifyStore()
app.setPageTitle('聊天')

const inputText = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const nickRequests = ref<Set<number>>(new Set())

function groupAvatar(uin: number) {
  return `https://p.qlogo.cn/gh/${uin}/${uin}/0/`
}

function privateAvatar(uin: number) {
  return `https://q1.qlogo.cn/g?b=qq&nk=${uin}&s=640`
}

function convAvatar(conv: { type: number; parentID: number }) {
  return conv.type === ChatHistoryType.Group
    ? groupAvatar(conv.parentID)
    : privateAvatar(conv.parentID)
}

function senderAvatar(senderID: number) {
  return `https://q1.qlogo.cn/g?b=qq&nk=${senderID}&s=640`
}

function onSelectConversation(conv: (typeof chat.conversations.value)[0]) {
  if (chat.currentChat?.parentId === conv.parentID && chat.currentChat?.type === conv.type) {
    chat.closeConversation()
  } else {
    chat.selectConversation(conv)
  }
}

async function handleSend() {
  if (!inputText.value.trim()) return
  const text = inputText.value
  inputText.value = ''
  await chat.sendMsg(text)
  await nextTick()
  scrollToBottom()
}

function scrollToBottom() {
  const el = messagesEl.value
  if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
}

// ── Image viewer ──
const viewerOpen = ref(false)
const viewerSrc = ref('')
const viewerScale = ref(1)
const viewerX = ref(0)
const viewerY = ref(0)
let dragStart = { x: 0, y: 0, vx: 0, vy: 0 }

function openViewer(url: string) {
  viewerSrc.value = url
  viewerScale.value = 1
  viewerX.value = 0
  viewerY.value = 0
  viewerOpen.value = true
}

function onViewerWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.15 : 0.15
  viewerScale.value = Math.max(0.2, Math.min(5, viewerScale.value + delta))
}

function onViewerDragStart(e: MouseEvent) {
  dragStart = { x: e.clientX, y: e.clientY, vx: viewerX.value, vy: viewerY.value }
  document.addEventListener('mousemove', onViewerDragMove)
  document.addEventListener('mouseup', onViewerDragEnd)
}

function onViewerDragMove(e: MouseEvent) {
  viewerX.value = dragStart.vx + (e.clientX - dragStart.x)
  viewerY.value = dragStart.vy + (e.clientY - dragStart.y)
}

function onViewerDragEnd() {
  document.removeEventListener('mousemove', onViewerDragMove)
  document.removeEventListener('mouseup', onViewerDragEnd)
}

function senderDisplay(msg: { senderID: number; pluginName?: string }): string {
  const nick = chat.getCachedNick(msg.senderID) || String(msg.senderID)
  if (msg.pluginName) return `${nick}[${msg.pluginName}]`
  return nick
}

// ── Message rendering helpers ──
function mediaUrl(item: MessageItemBase, type: 'image' | 'record'): string {
  const m = item as unknown as { hash?: string; filePath?: string | null }
  return cacheUrl(type, m.filePath || m.hash || '')
}

function isPureMedia(items: MessageItemBase[]): boolean {
  const filtered = trimmedItems(items)
  if (filtered.length === 0) return false
  return filtered.every(
    (m) => m.messageItemType === MessageItemType.Image || m.messageItemType === MessageItemType.Record,
  )
}

// ── At-block click → insert into input ──
async function atToInput(qq: number) {
  inputText.value += `[CQ:at,qq=${qq}] `
}

// ── Reply block ──
function formatReplyTime(ts: string | number): string {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000)
  const t = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 0) return t
  if (diffDays === 1) return `昨天 ${t}`
  return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')} ${t}`
}

function replyPreview(items: MessageItemBase[]): string {
  return items.map((m) => {
    if (m.messageItemType === MessageItemType.Text) return (m as unknown as { content: string }).content
    if (m.messageItemType === MessageItemType.At) {
      const at = m as unknown as { target: number; allTarget: boolean }
      return at.allTarget ? '@全体成员' : `@${at.target}`
    }
    if (m.messageItemType === MessageItemType.Image) return '[图片]'
    if (m.messageItemType === MessageItemType.Record) return '[语音]'
    if (m.messageItemType === MessageItemType.Face || m.messageItemType === MessageItemType.Bface) return '[表情]'
    if (m.messageItemType === MessageItemType.Reply) return '[回复]'
    return ''
  }).filter(Boolean).join('') || '[消息]'
}

const replySearching = ref(false)
const replyCache = ref<Record<number, ChatMessage | null>>({})

async function fetchReply(id: number) {
  if (replyCache.value[id] != null || !id) return
  if (!chat.currentChat) return
  replyCache.value[id] = null // mark in-flight
  try {
    const res = await getMessage(chat.currentChatType, chat.currentChat.parentId, id)
    replyCache.value[id] = res.data.code === 0 ? res.data.data : null
  } catch {
    replyCache.value[id] = null
  }
}

function getReplyData(id: number): ChatMessage | null {
  fetchReply(id)
  return replyCache.value[id] ?? null
}

async function jumpToMessage(msgId: number) {
  if (!chat.currentChat) return
  const chatType = chat.currentChatType
  const parentId = chat.currentChat.parentId

  // Search already-loaded messages first
  const existing = chat.messages.find((m) => m.msgId === msgId)
  if (existing) {
    scrollToMessage(existing.id || existing.msgId)
    return
  }

  replySearching.value = true
  try {
    // Page 1 is already loaded; start from page 2
    for (let page = 2; page <= 10; page++) {
      const res = await getHistory(chatType, parentId, page, 50)
      if (res.data.code !== 0 || !res.data.data.length) break

      const existingIds = new Set(chat.messages.map((m) => m.msgId))
      const fresh = (res.data.data as ChatMessage[]).filter((m) => !existingIds.has(m.msgId))

      const found = res.data.data.find((m: ChatMessage) => m.msgId === msgId)
      if (found) {
        if (fresh.length > 0) chat.messages = [...fresh, ...chat.messages]
        lazyPage.value = page
        await nextTick()
        scrollToMessage(found.id || found.msgId)
        return
      }

      if (fresh.length > 0) chat.messages = [...fresh, ...chat.messages]
      lazyPage.value = page

      if (res.data.data.length < 50) break
    }
    chat.fetchMessages(chatType, parentId)
    notify.error('无法定位到消息')
  } catch {
    chat.fetchMessages(chatType, parentId)
    notify.error('查找消息失败')
  } finally {
    replySearching.value = false
  }
}

function scrollToMessage(msgId: number) {
  nextTick(() => {
    const el = document.getElementById(`msg-${msgId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('msg-flash')
      setTimeout(() => el.classList.remove('msg-flash'), 1100)
    }
  })
}

function isTextOnly(items: MessageItemBase[]): boolean {
  return items.every((m) => m.messageItemType === MessageItemType.Text)
}

function itemText(m: MessageItemBase): string {
  return (m as unknown as { content?: string }).content ?? ''
}

/** Remove empty/whitespace-only text items around images in mixed content */
function trimmedItems(items: MessageItemBase[]): MessageItemBase[] {
  const result = items.map((m) => {
    if (m.messageItemType === MessageItemType.Text) {
      const trimmed = itemText(m).trim()
      return { ...m, content: trimmed } as unknown as MessageItemBase
    }
    return m
  })
  return result.filter((m) => {
    if (m.messageItemType !== MessageItemType.Text) return true
    return itemText(m).length > 0
  })
}

// ── Message grouping ──
const GROUP_WINDOW_MS = 3 * 60 * 1000 // 3 minutes

type GroupPos = 'first' | 'middle' | 'last' | null

const MAX_GROUP = 7

const msgGroupPos = computed<Record<number, GroupPos>>(() => {
  const map: Record<number, GroupPos> = {}
  const msgs = chat.messages
  let runStart = -1

  for (let i = 0; i < msgs.length; i++) {
    const prev = i > 0 ? msgs[i - 1] : null
    const next = i < msgs.length - 1 ? msgs[i + 1] : null
    const curr = msgs[i]
    const prevPos = prev ? map[prev.id || prev.msgId] : null

    // Continue from previous only if prev is in a group and hasn't ended it
    const canGroupWithPrev = prevPos && (prevPos === 'first' || prevPos === 'middle')

    if (!canGroupWithPrev) {
      runStart = i
    }

    const runLen = i - runStart + 1
    const groupableNext = next && next.senderID === curr.senderID && isGroupable(curr, next)
    const canGroupWithNext = groupableNext && runLen < MAX_GROUP

    if (runLen > 1) {
      if (!canGroupWithNext) {
        map[curr.id || curr.msgId] = 'last'
      } else if (runLen === 1) {
        map[curr.id || curr.msgId] = 'first'
      } else {
        map[curr.id || curr.msgId] = 'middle'
      }
    } else if (canGroupWithNext) {
      map[curr.id || curr.msgId] = 'first'
    }
  }
  return map
})

function isGroupable(
  a: { time: string; message: MessageItemBase[] },
  b: { time: string; message: MessageItemBase[] },
): boolean {
  const t1 = new Date(a.time).getTime()
  const t2 = new Date(b.time).getTime()
  if (Math.abs(t2 - t1) > GROUP_WINDOW_MS) return false
  return isTextOnly(a.message) && isTextOnly(b.message)
}

function formatConvTime(ts: number | string) {
  if (!ts) return ''
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000)

  if (diffDays === 0) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays === 1) return '昨天'
  if (diffDays === 2) return '前天'
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`
}

function formatMsgTime(ts: number | string) {
  if (!ts) return ''
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000)
  const t = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 0) return t
  if (diffDays === 1) return `昨天 ${t}`
  return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')} ${t}`
}

// Scroll to bottom on initial load (when loading finishes)
watch(
  () => chat.msgLoading,
  async (loading) => {
    if (!loading && chat.messages.length > 0) {
      await nextTick()
      scrollToBottom()
    }
  },
)

// ── Lazy load older messages on scroll-to-top ──
const lazyPage = ref(1)
const loadingMore = ref(false)
const loadCooldown = ref(false)
const showScrollBtn = ref(false)
let cooldownTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => chat.currentChat,
  () => {
    lazyPage.value = 1
    showScrollBtn.value = false
    if (cooldownTimer) clearTimeout(cooldownTimer)
    loadCooldown.value = false
  },
)

function onScrollMessages() {
  const el = messagesEl.value
  if (!el) return

  // Show scroll-to-bottom btn when scrolled up > 200px from bottom
  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  showScrollBtn.value = distFromBottom > 200

  // Trim old messages when at bottom to keep DOM light
  if (distFromBottom < 200 && chat.messages.length > 100) {
    trimOldMessages()
  }

  if (loadingMore.value || loadCooldown.value || !chat.hasMore) return
  if (el.scrollTop < 80) {
    loadOlder()
  }
}

const MAX_VISIBLE = 100
const KEEP_VISIBLE = 50

function trimOldMessages() {
  if (chat.messages.length <= MAX_VISIBLE) return
  const removeCount = chat.messages.length - KEEP_VISIBLE
  chat.messages = chat.messages.slice(removeCount)
  chat.hasMore = true
  lazyPage.value = 1
}

async function loadOlder() {
  if (!chat.currentChat || loadingMore.value || !chat.hasMore) return
  loadingMore.value = true
  const el = messagesEl.value
  const prevScrollTop = el?.scrollTop ?? 0
  const prevHeight = el?.scrollHeight ?? 0
  try {
    lazyPage.value++
    const res = await getHistory(chat.currentChatType, chat.currentChat.parentId, lazyPage.value)
    if (res.data.code === 0 && res.data.data.length > 0) {
      const existingIds = new Set(chat.messages.map((m) => m.msgId))
      const fresh = (res.data.data as ChatMessage[]).filter((m) => !existingIds.has(m.msgId))
      if (fresh.length > 0) {
        chat.messages = [...fresh, ...chat.messages]
      }
      chat.hasMore = res.data.data.length >= 50 && fresh.length > 0
      await nextTick()
      if (el) el.scrollTop = el.scrollHeight - prevHeight + prevScrollTop
    } else {
      chat.hasMore = false
    }
  } catch {
    lazyPage.value-- // rollback on error
  } finally {
    loadingMore.value = false
    loadCooldown.value = true
    cooldownTimer = setTimeout(() => {
      loadCooldown.value = false
      cooldownTimer = null
    }, 500)
  }
}

// Prefetch nicks + replies when messages change
watch(
  () => chat.messages.length,
  async () => {
    // Only auto-scroll if user was already near bottom
    const el = messagesEl.value
    const wasNearBottom = el
      ? el.scrollHeight - el.scrollTop - el.clientHeight < 200
      : true
    for (const msg of chat.messages) {
      const qq = msg.senderID
      if (!nickRequests.value.has(qq) && !chat.getCachedNick(qq)) {
        nickRequests.value.add(qq)
        chat.fetchNick(qq)
      }
      // Pre-fetch reply content
      for (const item of msg.message) {
        if (item.messageItemType === MessageItemType.Reply) {
          const replyId = (item as unknown as { id: number }).id
          if (replyId) {
            fetchReply(replyId)
          }
        }
      }
    }
    await nextTick()
    if (wasNearBottom) {
      scrollToBottom()
      trimOldMessages()
    }
  },
)

onMounted(async () => {
  await chat.fetchConversations()
})
</script>

<template>
  <div class="chat-shell">
    <!-- Conversation sidebar -->
    <div class="chat-sidebar">
      <v-card class="glass-card" height="100%" style="display: flex; flex-direction: column">
        <v-card-title class="text-body-1 pa-3 d-flex align-center" style="flex-shrink: 0">
          会话
          <v-spacer />
          <v-btn
            size="x-small"
            variant="text"
            icon="mdi-refresh"
            :loading="chat.loading"
            @click="chat.fetchConversations"
          />
        </v-card-title>
        <v-divider />

        <div class="conv-list" style="flex: 1; overflow-y: auto">
          <div
            v-for="conv in chat.conversations"
            :key="`${conv.type}-${conv.parentID}`"
            class="conv-item pa-2 mx-1"
            :class="{ 'conv-active': chat.currentChat?.parentId === conv.parentID }"
            @click="onSelectConversation(conv)"
          >
            <v-avatar size="44" class="flex-shrink-0">
              <v-img :src="convAvatar(conv)" cover />
            </v-avatar>

            <div class="flex-grow-1 mx-2" style="min-width: 0">
              <div class="d-flex align-center">
                <span class="conv-name text-truncate">{{ conv.name || conv.parentID }}</span>
                <v-spacer />
                <span class="conv-time flex-shrink-0 ml-1">{{ formatConvTime(conv.time) }}</span>
              </div>
              <div class="d-flex align-center mt-1">
                <span class="conv-preview text-truncate flex-grow-1">
                  {{ chat.convPreview(conv) || '暂无消息' }}
                </span>
                <span
                  v-if="conv.unreadCount > 0"
                  class="unread-badge flex-shrink-0 ml-2"
                  @click.stop="chat.clearUnread(conv)"
                >
                  {{ conv.unreadCount > 99 ? '99+' : conv.unreadCount }}
                </span>
              </div>
            </div>
          </div>

          <div
            v-if="!chat.loading && chat.conversations.length === 0"
            class="text-center text-medium-emphasis pa-8"
          >
            <v-icon icon="mdi-message-outline" size="40" class="mb-2" />
            <div class="text-caption">暂无会话</div>
          </div>
        </div>
      </v-card>
    </div>

    <!-- Message area -->
    <div class="chat-main">
      <v-card class="glass-card" height="100%" style="display: flex; flex-direction: column">
        <!-- Header -->
        <div v-if="chat.currentChat" class="pa-3 d-flex align-center" style="flex-shrink: 0">
          <v-avatar size="36" class="mr-2">
            <v-img
              :src="
                chat.currentChat.type === ChatHistoryType.Group
                  ? groupAvatar(chat.currentChat.parentId)
                  : privateAvatar(chat.currentChat.parentId)
              "
              cover
            />
          </v-avatar>
          <span class="text-body-2 font-weight-medium">
            {{
              chat.conversations.find((c) => c.parentID === chat.currentChat?.parentId)?.name ||
              chat.currentChat?.parentId
            }}
          </span>
        </div>
        <v-divider v-if="chat.currentChat" />

        <!-- Messages -->
        <div ref="messagesEl" class="msg-scroll flex-grow-1 pa-3" @scroll="onScrollMessages">
          <div v-if="loadingMore" class="text-center pa-2">
            <v-progress-circular indeterminate size="18" width="2" color="primary" />
          </div>
          <div v-if="chat.msgLoading" class="text-center pa-4">
            <v-progress-circular indeterminate size="24" width="2" color="primary" />
          </div>

          <div
            v-if="!chat.currentChat"
            class="d-flex flex-column align-center justify-center"
            style="height: 100%"
          >
            <v-icon icon="mdi-chat-outline" size="64" class="text-medium-emphasis mb-3" />
            <div class="text-body-1 text-medium-emphasis">选择一个会话开始聊天</div>
          </div>

          <template v-else>
            <div
              v-if="chat.messages.length === 0 && !chat.msgLoading"
              class="text-center text-medium-emphasis pa-8"
            >
              <div class="text-caption">暂无消息</div>
            </div>

            <template v-for="msg in chat.messages" :key="msg.id || msg.msgId">
              <div
                :id="'msg-' + (msg.id || msg.msgId)"
                :class="[
                  'msg-row',
                  msg.senderID === chat.botQQ ? 'msg-row--self' : '',
                  msgGroupPos[msg.id || msg.msgId] === 'first' || !msgGroupPos[msg.id || msg.msgId]
                    ? 'msg-row-gap'
                    : '',
                ]"
              >
                <div
                  class="d-flex align-start"
                  :class="{ 'flex-row-reverse': msg.senderID === chat.botQQ }"
                >
                  <!-- Avatar: hidden for middle/last -->
                  <v-avatar
                    v-if="
                      !msgGroupPos[msg.id || msg.msgId] ||
                      msgGroupPos[msg.id || msg.msgId] === 'first'
                    "
                    size="32"
                    class="flex-shrink-0"
                    :class="msg.senderID === chat.botQQ ? 'ml-2' : 'mr-2'"
                  >
                    <v-img :src="senderAvatar(msg.senderID)" cover />
                  </v-avatar>
                  <div
                    v-else
                    class="flex-shrink-0"
                    :class="msg.senderID === chat.botQQ ? 'ml-2' : 'mr-2'"
                    style="width: 32px"
                  />

                  <div class="flex-grow-1" style="min-width: 0">
                    <!-- Sender name: hidden for middle/last -->
                    <div
                      v-if="
                        !msgGroupPos[msg.id || msg.msgId] ||
                        msgGroupPos[msg.id || msg.msgId] === 'first'
                      "
                      class="d-flex align-center ga-1 mb-1"
                      :class="{ 'justify-end': msg.senderID === chat.botQQ }"
                    >
                      <template v-if="msg.senderID === chat.botQQ">
                        <span class="msg-time">{{ formatMsgTime(msg.time) }}</span>
                        <span class="msg-sender text-medium-emphasis">{{ senderDisplay(msg) }}</span>
                      </template>
                      <template v-else>
                        <span class="msg-sender text-medium-emphasis">{{ senderDisplay(msg) }}</span>
                        <span class="msg-time">{{ formatMsgTime(msg.time) }}</span>
                      </template>
                    </div>
                    <div
                      class="d-flex align-center ga-1"
                      :class="{ 'justify-end': msg.senderID === chat.botQQ }"
                    >
                      <!-- Self grouped time: left of bubble -->
                      <span
                        v-if="
                          msg.senderID === chat.botQQ &&
                          msgGroupPos[msg.id || msg.msgId] &&
                          msgGroupPos[msg.id || msg.msgId] !== 'first'
                        "
                        class="msg-group-time msg-group-time--self"
                        >{{ formatMsgTime(msg.time) }}</span
                      >
                      <!-- Pure image/record: no bubble frame -->
                      <template v-if="isPureMedia(msg.message)">
                        <div
                          v-for="(item, ii) in msg.message"
                          :key="ii"
                          :class="[
                            'msg-image-pure',
                            msgGroupPos[msg.id || msg.msgId]
                              ? msg.senderID === chat.botQQ
                                ? `msg-image-pure--self-${msgGroupPos[msg.id || msg.msgId]}`
                                : `msg-bubble--${msgGroupPos[msg.id || msg.msgId]}`
                              : '',
                          ]"
                        >
                          <img
                            v-if="item.messageItemType === MessageItemType.Image"
                            :src="mediaUrl(item, 'image')"
                            class="msg-image-inline"
                            loading="lazy"
                            @click="openViewer(mediaUrl(item, 'image'))"
                          />
                          <audio
                            v-else-if="item.messageItemType === MessageItemType.Record"
                            :src="mediaUrl(item, 'record')"
                            class="msg-audio"
                            controls
                            preload="metadata"
                          />
                        </div>
                      </template>
                      <!-- Mixed content: inside bubble -->
                      <div
                        v-else
                        :class="[
                          'msg-bubble',
                          msg.senderID === chat.botQQ ? 'msg-bubble--self' : '',
                          msgGroupPos[msg.id || msg.msgId]
                            ? msg.senderID === chat.botQQ
                              ? `msg-bubble--self-${msgGroupPos[msg.id || msg.msgId]}`
                              : `msg-bubble--${msgGroupPos[msg.id || msg.msgId]}`
                            : '',
                        ]"
                      >
                        <template v-for="(item, si) in trimmedItems(msg.message)" :key="si">
                          <!-- At block -->
                          <span
                            v-if="item.messageItemType === MessageItemType.At"
                            class="msg-at"
                            :class="{ 'msg-at--clickable': !(item as unknown as { allTarget: boolean }).allTarget }"
                            @click="!(item as unknown as { allTarget: boolean }).allTarget && atToInput((item as unknown as { target: number }).target)"
                          >
                            {{ (item as unknown as { allTarget: boolean }).allTarget ? '@全体成员' : '@' + (chat.getCachedNick((item as unknown as { target: number }).target) || (item as unknown as { target: number }).target) }}
                          </span>
                          <!-- Reply block -->
                          <div
                            v-else-if="item.messageItemType === MessageItemType.Reply"
                            class="msg-reply-card"
                            @click="jumpToMessage((item as unknown as { id: number }).id)"
                          >
                            <template v-if="getReplyData((item as unknown as { id: number }).id)">
                              <div class="msg-reply-header">
                                <span class="msg-reply-sender">{{ chat.getCachedNick(getReplyData((item as unknown as { id: number }).id)!.senderID) || getReplyData((item as unknown as { id: number }).id)!.senderID }}</span>
                                <span class="msg-reply-time"> · {{ formatReplyTime(getReplyData((item as unknown as { id: number }).id)!.time) }}</span>
                              </div>
                              <div class="msg-reply-body line-clamp-1">
                                {{ replyPreview(getReplyData((item as unknown as { id: number }).id)!.message) }}
                              </div>
                            </template>
                            <template v-else>
                              <div class="msg-reply-header">
                                <span class="msg-reply-sender">回复</span>
                              </div>
                              <div class="msg-reply-body line-clamp-1">加载中...</div>
                            </template>
                          </div>
                          <!-- Text -->
                          <span
                            v-else-if="item.messageItemType === MessageItemType.Text"
                            class="msg-text-block"
                          >{{ itemText(item) }}</span>
                          <!-- Image -->
                          <img
                            v-else-if="item.messageItemType === MessageItemType.Image"
                            :src="mediaUrl(item, 'image')"
                            class="msg-image-inline"
                            loading="lazy"
                            @click="openViewer(mediaUrl(item, 'image'))"
                          />
                          <!-- Record / Audio -->
                          <audio
                            v-else-if="item.messageItemType === MessageItemType.Record"
                            :src="mediaUrl(item, 'record')"
                            class="msg-audio"
                            controls
                            preload="metadata"
                          />
                          <!-- Other -->
                          <span v-else class="msg-misc-inline">{{ itemText(item) || '' }}</span>
                        </template>
                      </div>
                      <!-- Other grouped time: right of bubble -->
                      <span
                        v-if="
                          msg.senderID !== chat.botQQ &&
                          msgGroupPos[msg.id || msg.msgId] &&
                          msgGroupPos[msg.id || msg.msgId] !== 'first'
                        "
                        class="msg-group-time"
                        >{{ formatMsgTime(msg.time) }}</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </template>

          <!-- Scroll-to-bottom button -->
          <div class="scroll-bottom-wrap">
            <v-btn
              v-if="showScrollBtn"
              icon="mdi-chevron-down"
              size="small"
              variant="tonal"
              color="primary"
              @click="scrollToBottom"
            />
          </div>
        </div>

        <!-- Input -->
        <div v-if="chat.currentChat" class="pa-3" style="flex-shrink: 0">
          <v-divider class="mb-3" />
          <div class="d-flex ga-2">
            <v-text-field
              v-model="inputText"
              placeholder="输入消息..."
              variant="outlined"
              density="compact"
              hide-details
              @keyup.enter="handleSend"
            />
            <v-btn
              variant="tonal"
              color="primary"
              icon="mdi-send"
              :loading="chat.sending"
              @click="handleSend"
            />
          </div>
        </div>
      </v-card>
    </div>

    <!-- Image viewer modal -->
    <v-dialog v-model="viewerOpen" fullscreen content-class="viewer-dialog">
      <div
        class="viewer-backdrop"
        @click="viewerOpen = false"
        @wheel="onViewerWheel"
      >
        <v-btn
          icon="mdi-close"
          variant="text"
          size="large"
          class="viewer-close"
          @click="viewerOpen = false"
        />
        <img
          :src="viewerSrc"
          :style="{
            transform: `translate(${viewerX}px, ${viewerY}px) scale(${viewerScale})`,
            cursor: viewerScale > 1 ? 'grab' : 'default',
          }"
          class="viewer-img"
          draggable="false"
          @click.stop
          @mousedown="onViewerDragStart"
        />
      </div>
    </v-dialog>
  </div>
</template>

<style scoped>
.chat-shell {
  display: flex;
  height: calc(100vh - 140px);
  gap: 16px;
}
.chat-sidebar {
  width: 300px;
  flex-shrink: 0;
}
.chat-main {
  flex: 1;
  min-width: 0;
}
.msg-scroll {
  overflow-y: auto;
  scroll-behavior: smooth;
}
.scroll-bottom-wrap {
  position: sticky;
  bottom: 12px;
  display: flex;
  justify-content: flex-end;
  z-index: 2;
  pointer-events: none;
}
.scroll-bottom-wrap > * {
  pointer-events: auto;
}
.msg-misc-inline {
  display: block;
  color: rgba(var(--v-theme-on-surface), 0.5);
  font-size: 0.8em;
}

/* ── At block ── */
.msg-at {
  display: inline;
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
}
.msg-at--clickable {
  cursor: pointer;
  text-decoration: underline dotted;
}
.msg-at--clickable:hover { opacity: 0.8; }

/* ── Reply card ── */
.msg-reply-card {
  display: block;
  border-left: 3px solid rgb(var(--v-theme-primary));
  padding: 4px 10px;
  margin: 4px 0;
  background: rgba(var(--v-theme-on-surface), 0.03);
  border-radius: 0 8px 8px 0;
  cursor: pointer;
}
.msg-reply-card:hover {
  background: rgba(var(--v-theme-primary), 0.06);
}
.msg-reply-header {
  font-size: 0.7rem;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 2px;
}
.msg-reply-body {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
/* ── Flash highlight ── */
.msg-flash {
  animation: flash-bg 1s ease-in-out forwards;
}
@keyframes flash-bg {
  0% { background: transparent; }
  15% { background: rgba(var(--v-theme-primary), 0.18); }
  85% { background: rgba(var(--v-theme-primary), 0.18); }
  100% { background: transparent; }
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.msg-image-inline {
  max-width: 240px;
  max-height: 240px;
  border-radius: 12px;
  display: block;
  margin: 2px 0;
  cursor: pointer;
}

.msg-audio {
  display: block;
  max-width: 280px;
  height: 36px;
  margin: 2px 0;
}

/* ── Image viewer ── */
.viewer-dialog {
  background: transparent !important;
}
.viewer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.viewer-close {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 10;
}
.viewer-img {
  max-width: 90vw;
  max-height: 90vh;
  transition: transform 0.05s ease-out;
}

.msg-image-pure {
  border-radius: 12px;
  overflow: hidden;
  display: inline-block;
}
.msg-image-pure.msg-bubble--first {
  border-bottom-left-radius: 2px;
}
.msg-image-pure.msg-bubble--middle {
  border-top-left-radius: 2px;
  border-bottom-left-radius: 2px;
}
.msg-image-pure.msg-bubble--last {
  border-top-left-radius: 2px;
}
.msg-image-pure.msg-image-pure--self-first {
  border-bottom-right-radius: 2px;
}
.msg-image-pure.msg-image-pure--self-middle {
  border-top-right-radius: 2px;
  border-bottom-right-radius: 2px;
}
.msg-image-pure.msg-image-pure--self-last {
  border-top-right-radius: 2px;
}

.msg-bubble {
  background: rgba(var(--v-theme-on-surface), 0.05);
  border-radius: 12px;
  padding: 8px 12px;
  font-size: 0.875rem;
  line-height: 1.5;
  word-break: break-word;
  display: inline-block;
  max-width: 100%;
}
.msg-bubble--self {
  background: rgba(var(--v-theme-primary), 0.15);
}
.msg-bubble--first {
  border-bottom-left-radius: 2px;
}
.msg-bubble--middle {
  border-top-left-radius: 2px;
  border-bottom-left-radius: 2px;
}
.msg-bubble--last {
  border-top-left-radius: 2px;
}
.msg-bubble--self-first {
  border-bottom-right-radius: 2px;
}
.msg-bubble--self-middle {
  border-top-right-radius: 2px;
  border-bottom-right-radius: 2px;
}
.msg-bubble--self-last {
  border-top-right-radius: 2px;
}
.msg-row {
  max-width: 80%;
}
.msg-row--self {
  margin-left: auto;
}
.msg-row:not(.msg-row-gap) {
  margin-top: 1px;
}
.msg-row-gap {
  margin-top: 8px;
}

.msg-group-time {
  font-size: 0.6rem;
  color: rgba(var(--v-theme-on-surface), 0.35);
  opacity: 0;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
}
.msg-row:hover .msg-group-time {
  opacity: 1;
}

/* ── Conversation item ── */
.conv-item {
  display: flex;
  align-items: center;
  cursor: pointer;
  border-radius: 12px;
  transition: background 0.15s ease;
}
.conv-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.conv-active {
  background: rgba(var(--v-theme-primary), 0.1);
}
.conv-active:hover {
  background: rgba(var(--v-theme-primary), 0.14);
}

/* ── Unread badge ── */
.unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 10px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1;
}

.msg-sender {
  font-size: 0.7rem;
}
.msg-time {
  font-size: 0.65rem;
  color: rgba(var(--v-theme-on-surface), 0.4);
}

.conv-name {
  font-weight: 500;
}
.conv-time {
  font-size: 0.65rem;
  color: rgba(var(--v-theme-on-surface), 0.45);
}
.conv-preview {
  font-size: 0.72rem;
  color: rgba(var(--v-theme-on-surface), 0.55);
}

.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
