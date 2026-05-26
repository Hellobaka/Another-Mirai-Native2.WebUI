<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { ChatHistoryType, MessageItemType } from '@/models'
import type { MessageItemBase, ChatMessage, SendMessageRequest } from '@/models'
import { useChatStore } from '@/stores/chat'
import {
  getHistory, getMessage, sendMessage, recallMessage,
  collectImage, getCollected, convertMessageChain,
} from '@/api/chat'
import { cacheUrl } from '@/api/cache'
import { useNotifyStore } from '@/stores/notify'
import ChatSidebar from '@/components/chat/ChatSidebar.vue'
import ChatMessageList from '@/components/chat/ChatMessageList.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ImageViewer from '@/components/chat/ImageViewer.vue'
import {
  msgToCqCode, msgToText, canCopy, canRepeat, hasImage, getImageHash,
} from '@/components/chat/chatUtils'

const app = useAppStore()
const chat = useChatStore()
const notify = useNotifyStore()
app.setPageTitle('聊天')

const inputText = ref('')
const pendingSends = ref<Record<string, 'parsing' | 'sending' | 'failed'>>({})
const msgList = ref<InstanceType<typeof ChatMessageList> | null>(null)

// ── Context menu ──
const ctxMenu = ref<{ show: boolean; x: number; y: number; msg: ChatMessage | null }>({
  show: false, x: 0, y: 0, msg: null,
})
let ctxLongPressTimer: ReturnType<typeof setTimeout> | null = null

function onMsgContextMenu(e: MouseEvent, msg: ChatMessage) {
  e.preventDefault()
  ctxMenu.value = { show: true, x: e.clientX, y: e.clientY, msg }
}

function onMsgTouchStart(e: TouchEvent, msg: ChatMessage) {
  ctxLongPressTimer = setTimeout(() => {
    const t = e.touches[0]
    ctxMenu.value = { show: true, x: t.clientX, y: t.clientY, msg }
  }, 500)
}

function onMsgTouchEnd() {
  if (ctxLongPressTimer) { clearTimeout(ctxLongPressTimer); ctxLongPressTimer = null }
}

function closeCtxMenu() {
  ctxMenu.value.show = false
}

// ── Send ──
async function handleSend() {
  if (!inputText.value.trim() || !chat.currentChat) return
  const rawText = inputText.value
  inputText.value = ''

  const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const optimistic: ChatMessage = {
    id: 0, msgId: 0,
    type: chat.currentChatType,
    parentID: chat.currentChat.parentId,
    senderID: chat.botQQ,
    message: [],
    time: new Date().toISOString(),
    recalled: false,
    pluginName: '',
  } as unknown as ChatMessage
  ;(optimistic as unknown as { _tempId: string })._tempId = tempId

  pendingSends.value[tempId] = 'parsing'
  chat.messages.push(optimistic)
  await nextTick()
  msgList.value?.scrollToBottom()

  const body: SendMessageRequest = {
    chatType: chat.currentChatType,
    parentId: chat.currentChat.parentId,
    message: rawText,
  }

  let sendOk = false

  const parsePromise = convertMessageChain(rawText)
    .then((res) => {
      if (res.data.code === 0 && res.data.data.message?.length) {
        optimistic.message = res.data.data.message
      } else {
        throw new Error('empty')
      }
    })
    .catch(() => {
      optimistic.message = [
        { messageItemType: MessageItemType.Text, content: rawText } as unknown as MessageItemBase,
      ]
    })

  const sendPromise = sendMessage(body)
    .then((res) => {
      if (res.data.code === 0) {
        const idx = chat.messages.findIndex(
          (m) => (m as unknown as { _tempId?: string })._tempId === tempId,
        )
        if (idx !== -1 && res.data.data?.msgId) {
          const m = chat.messages[idx] as unknown as { msgId: number; _tempId: string }
          m.msgId = res.data.data.msgId
        }
        sendOk = true
      }
    })
    .catch(() => {})

  await Promise.all([parsePromise, sendPromise])
  pendingSends.value[tempId] = sendOk ? ('' as any) : 'failed'
}

// ── Retry ──
const confirmRetry = ref(false)
const retryingMsg = ref<ChatMessage | null>(null)

function onRetryClick(msg: ChatMessage) {
  retryingMsg.value = msg
  confirmRetry.value = true
}

async function doRetry() {
  if (!retryingMsg.value || !chat.currentChat) return
  const msg = retryingMsg.value
  const tempId = (msg as unknown as { _tempId: string })._tempId
  const text = (msg.message[0] as unknown as { content: string }).content

  pendingSends.value[tempId] = 'parsing'
  confirmRetry.value = false
  retryingMsg.value = null

  const body: SendMessageRequest = {
    chatType: chat.currentChatType,
    parentId: chat.currentChat.parentId,
    message: text,
  }

  let sendOk = false
  const parsePromise = convertMessageChain(text)
    .then((res) => {
      if (res.data.code === 0 && res.data.data.message?.length) {
        msg.message = res.data.data.message
      } else { throw new Error('empty') }
    })
    .catch(() => {
      msg.message = [
        { messageItemType: MessageItemType.Text, content: text } as unknown as MessageItemBase,
      ]
    })

  const sendPromise = sendMessage(body)
    .then((res) => {
      if (res.data.code === 0) {
        const idx = chat.messages.findIndex(
          (m) => (m as unknown as { _tempId?: string })._tempId === tempId,
        )
        if (idx !== -1 && res.data.data?.msgId) {
          const m = chat.messages[idx] as unknown as { msgId: number; _tempId: string }
          m.msgId = res.data.data.msgId
        }
        sendOk = true
      }
    })
    .catch(() => {})

  await Promise.all([parsePromise, sendPromise])
  pendingSends.value[tempId] = sendOk ? ('' as any) : 'failed'
}

function ctxReplyCQ(msg: ChatMessage) {
  closeCtxMenu()
  inputText.value += `[CQ:reply,id=${msg.msgId}] `
}

// ── Context menu actions ──
async function ctxCopy(msg: ChatMessage) {
  closeCtxMenu()
  const hasImg = msg.message.some((m) => m.messageItemType === MessageItemType.Image)
  if (hasImg && msg.message.length === 1) {
    try {
      const img = msg.message[0] as unknown as { hash?: string; filePath?: string | null }
      const url = cacheUrl('image', img.filePath || img.hash || '')
      if (url) {
        const blob = await fetch(url).then((r) => r.blob())
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
        notify.success('图片已复制')
        return
      }
    } catch { /* fall through */ }
  }
  const text = msgToText(msg)
  if (text) {
    await navigator.clipboard.writeText(text)
    notify.success('已复制')
  }
}

async function ctxRepeat(msg: ChatMessage) {
  closeCtxMenu()
  const cq = msgToCqCode(msg)
  if (!cq || !chat.currentChat) return

  const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const optimistic: ChatMessage = {
    id: 0, msgId: 0,
    type: chat.currentChatType,
    parentID: chat.currentChat.parentId,
    senderID: chat.botQQ,
    message: msg.message,
    time: new Date().toISOString(),
    recalled: false, pluginName: '',
  } as unknown as ChatMessage
  ;(optimistic as unknown as { _tempId: string })._tempId = tempId

  pendingSends.value[tempId] = 'sending'
  chat.messages.push(optimistic)
  await nextTick()
  msgList.value?.scrollToBottom()

  try {
    const body: SendMessageRequest = {
      chatType: chat.currentChatType,
      parentId: chat.currentChat.parentId,
      message: cq,
    }
    const res = await sendMessage(body)
    if (res.data.code === 0) {
      const idx = chat.messages.findIndex(
        (m) => (m as unknown as { _tempId?: string })._tempId === tempId,
      )
      if (idx !== -1 && res.data.data?.msgId) {
        const m = chat.messages[idx] as unknown as { msgId: number; _tempId: string }
        m.msgId = res.data.data.msgId
      }
      pendingSends.value[tempId] = '' as any
    } else {
      pendingSends.value[tempId] = 'failed'
    }
  } catch {
    pendingSends.value[tempId] = 'failed'
  }
}

async function ctxRecall(msg: ChatMessage) {
  closeCtxMenu()
  try {
    const res = await recallMessage(msg.type, msg.parentID, msg.msgId)
    if (res.data.code === 0) { msg.recalled = true; notify.success('已撤回') }
    else notify.error(res.data.message || '撤回失败')
  } catch { notify.error('撤回失败') }
}

// ── Collected images ──
const collectedImages = ref<string[]>([])
let collectedLoaded = false

async function fetchCollected() {
  if (collectedLoaded) return
  try {
    const res = await getCollected()
    if (res.data.code === 0) collectedImages.value = res.data.data
  } catch { /* */ }
  collectedLoaded = true
}

async function ctxFavorite(msg: ChatMessage) {
  closeCtxMenu()
  const hash = getImageHash(msg)
  if (!hash) { notify.error('无法获取图片标识'); return }
  try {
    const res = await collectImage(hash)
    if (res.data.code === 0) {
      notify.success('已收藏')
      if (res.data.data && !collectedImages.value.includes(res.data.data)) {
        collectedImages.value.push(res.data.data)
      }
    } else notify.error(res.data.message || '收藏失败')
  } catch { notify.error('收藏失败') }
}

// ── Reply ──
const replyCache = ref<Record<number, ChatMessage | null>>({})
const replySearching = ref(false)

async function fetchReply(id: number) {
  if (replyCache.value[id] != null || !id) return
  if (!chat.currentChat) return
  replyCache.value[id] = null
  try {
    const res = await getMessage(chat.currentChatType, chat.currentChat.parentId, id)
    replyCache.value[id] = res.data.code === 0 ? res.data.data : null
  } catch { replyCache.value[id] = null }
}

function getReplyData(id: number): ChatMessage | null {
  fetchReply(id)
  return replyCache.value[id] ?? null
}

async function jumpToMessage(msgId: number) {
  if (!chat.currentChat) return
  const chatType = chat.currentChatType
  const parentId = chat.currentChat.parentId

  const existing = chat.messages.find((m) => m.msgId === msgId)
  if (existing) {
    scrollToMessage(existing.id || existing.msgId)
    return
  }

  replySearching.value = true
  try {
    for (let page = 2; page <= 10; page++) {
      const res = await getHistory(chatType, parentId, page, 50)
      if (res.data.code !== 0 || !res.data.data.length) break
      const existingIds = new Set(chat.messages.map((m) => m.msgId))
      const fresh = (res.data.data as ChatMessage[]).filter((m) => !existingIds.has(m.msgId))
      const found = res.data.data.find((m: ChatMessage) => m.msgId === msgId)
      if (found) {
        if (fresh.length > 0) chat.messages = [...fresh, ...chat.messages]
        await nextTick()
        scrollToMessage(found.id || found.msgId)
        return
      }
      if (fresh.length > 0) chat.messages = [...fresh, ...chat.messages]
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

// ── Image viewer ──
const viewerOpen = ref(false)
const viewerSrc = ref('')

function openViewer(url: string) {
  viewerSrc.value = url
  viewerOpen.value = true
}

// ── Navigation ──
function atToInput(qq: number) {
  inputText.value += `[CQ:at,qq=${qq}] `
}

function onSelectConversation(conv: { type: number; parentID: number }) {
  const c = chat.conversations.find((x) => x.parentID === conv.parentID && x.type === conv.type)
  if (c) {
    if (chat.currentChat?.parentId === conv.parentID && chat.currentChat?.type === conv.type) {
      chat.closeConversation()
    } else {
      chat.selectConversation(c)
    }
  }
}

// ── Dedup ──
function dedupOptimistic() {
  const tempIndices: number[] = []
  chat.messages.forEach((m, i) => {
    const tid = (m as unknown as { _tempId?: string })._tempId
    if (tid && pendingSends.value[tid] === ('' as any)) {
      const text = (m.message[0] as unknown as { content?: string }).content || ''
      for (let j = 0; j < chat.messages.length; j++) {
        if (j === i) continue
        const other = chat.messages[j]
        if ((other as unknown as { _tempId?: string })._tempId) continue
        const otherText = (other.message[0] as unknown as { content?: string }).content || ''
        if (otherText === text && other.senderID === m.senderID) {
          tempIndices.push(i)
          delete pendingSends.value[tid]
          break
        }
      }
    }
  })
  for (let i = tempIndices.length - 1; i >= 0; i--) {
    chat.messages.splice(tempIndices[i], 1)
  }
}

// ── Watchers ──
const nickRequests = ref<Set<number>>(new Set())

watch(
  () => chat.msgLoading,
  async (loading) => {
    if (!loading && chat.messages.length > 0) {
      await nextTick()
      msgList.value?.scrollToBottom()
    }
  },
)

watch(
  () => chat.messages.length,
  async () => {
    const el = msgList.value?.messagesEl
    const wasNearBottom = el
      ? el.scrollHeight - el.scrollTop - el.clientHeight < 200
      : true
    for (const msg of chat.messages) {
      const qq = msg.senderID
      if (!nickRequests.value.has(qq) && !chat.getCachedNick(qq)) {
        nickRequests.value.add(qq)
        chat.fetchNick(qq)
      }
      for (const item of msg.message) {
        if (item.messageItemType === MessageItemType.Reply) {
          const replyId = (item as unknown as { id: number }).id
          if (replyId) fetchReply(replyId)
        }
      }
    }
    dedupOptimistic()
    await nextTick()
    if (wasNearBottom) {
      msgList.value?.scrollToBottom()
    }
  },
)

onMounted(async () => {
  await chat.fetchConversations()
})

// Expose for context menu event handlers on message bubbles in ChatMessageList
const nickRequestsSet = nickRequests
</script>

<template>
  <div class="chat-shell">
    <ChatSidebar @select="onSelectConversation" />

    <div class="chat-main">
      <v-card class="glass-card" height="100%" style="display: flex; flex-direction: column">
        <!-- Header -->
        <div v-if="chat.currentChat" class="pa-3 d-flex align-center" style="flex-shrink: 0">
          <v-avatar size="36" class="mr-2">
            <v-img
              :src="
                chat.currentChat.type === ChatHistoryType.Group
                  ? `https://p.qlogo.cn/gh/${chat.currentChat.parentId}/${chat.currentChat.parentId}/0/`
                  : `https://q1.qlogo.cn/g?b=qq&nk=${chat.currentChat.parentId}&s=640`
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
        <ChatMessageList
          ref="msgList"
          :pending-sends="pendingSends"
          :reply-data="getReplyData"
          @contextmenu="onMsgContextMenu"
          @open-viewer="openViewer"
          @at-click="atToInput"
          @reply-click="jumpToMessage"
          @retry-click="onRetryClick"
        />

        <!-- Input -->
        <ChatInput
          v-if="chat.currentChat"
          v-model="inputText"
          :collected-images="collectedImages"
          @send="handleSend"
          @open-emoji="fetchCollected"
        />
      </v-card>
    </div>

    <!-- Context menu -->
    <teleport to="body">
      <div v-if="ctxMenu.show" class="ctx-overlay" @click="closeCtxMenu" @touchstart="closeCtxMenu">
        <v-card
          class="ctx-menu-card"
          :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
          @click.stop @touchstart.stop
        >
          <v-list density="compact" class="pa-0">
            <v-list-item
              v-if="ctxMenu.msg"
              prepend-icon="mdi-reply" title="回复"
              :disabled="ctxMenu.msg.recalled"
              class="ctx-menu-item" @click="ctxReplyCQ(ctxMenu.msg!)"
            />
            <v-list-item
              v-if="ctxMenu.msg && canCopy(ctxMenu.msg)"
              prepend-icon="mdi-content-copy" title="复制"
              class="ctx-menu-item" @click="ctxCopy(ctxMenu.msg!)"
            />
            <v-list-item
              v-if="ctxMenu.msg && hasImage(ctxMenu.msg)"
              prepend-icon="mdi-heart-outline" title="收藏"
              class="ctx-menu-item" @click="ctxFavorite(ctxMenu.msg!)"
            />
            <v-list-item
              v-if="ctxMenu.msg && canRepeat(ctxMenu.msg)"
              prepend-icon="mdi-plus-one" title="+1"
              class="ctx-menu-item" @click="ctxRepeat(ctxMenu.msg!)"
            />
            <v-divider class="my-1" />
            <v-list-item
              v-if="ctxMenu.msg"
              prepend-icon="mdi-undo" title="撤回"
              :disabled="ctxMenu.msg.recalled"
              class="ctx-menu-item" @click="ctxRecall(ctxMenu.msg!)"
            />
          </v-list>
        </v-card>
      </div>
    </teleport>

    <!-- Retry confirm dialog -->
    <v-dialog v-model="confirmRetry" max-width="360">
      <v-card>
        <v-card-title class="text-body-1">确认重发</v-card-title>
        <v-card-text class="text-body-2">确定要重新发送这条消息吗？</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmRetry = false">取消</v-btn>
          <v-btn variant="tonal" color="primary" @click="doRetry">重发</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Image viewer -->
    <ImageViewer v-model:open="viewerOpen" v-model:src="viewerSrc" />
  </div>
</template>

<style scoped>
.chat-shell {
  display: flex;
  height: calc(100vh - 140px);
  gap: 16px;
}
.chat-main {
  flex: 1;
  min-width: 0;
}

/* ── Context menu ── */
.ctx-overlay { position: fixed; inset: 0; z-index: 9999; }
.ctx-menu-card { position: fixed; min-width: 140px; z-index: 10000; }
.ctx-menu-item { cursor: pointer; border-radius: 8px; min-height: 36px !important; }

/* ── Flash highlight ── */
:global(.msg-flash) {
  animation: flash-bg 1s ease-in-out forwards;
}
@keyframes flash-bg {
  0% { background: transparent; }
  15% { background: rgba(var(--v-theme-primary), 0.18); }
  85% { background: rgba(var(--v-theme-primary), 0.18); }
  100% { background: transparent; }
}
</style>
