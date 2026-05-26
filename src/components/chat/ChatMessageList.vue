<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useNotifyStore } from '@/stores/notify'
import { getHistory } from '@/api/chat'
import { ChatHistoryType } from '@/models'
import type { ChatMessage as ChatMessageType } from '@/models'
import ChatMessageBubble from './ChatMessageBubble.vue'
import { isTextOnly } from './chatUtils'

const chat = useChatStore()
const notify = useNotifyStore()

const props = defineProps<{
  pendingSends: Record<string, string>
  replyData: (id: number) => ChatMessageType | null
}>()

const emit = defineEmits<{
  'contextmenu': [e: MouseEvent, msg: ChatMessageType]
  'open-viewer': [url: string]
  'at-click': [qq: number]
  'reply-click': [msgId: number]
  'retry-click': [msg: ChatMessageType]
}>()

const messagesEl = ref<HTMLElement | null>(null)
const loadingMore = ref(false)
const showScrollBtn = ref(false)
const lazyPage = ref(1)
const loadCooldown = ref(false)
let cooldownTimer: ReturnType<typeof setTimeout> | null = null

const MAX_VISIBLE = 100
const KEEP_VISIBLE = 50
const GROUP_WINDOW_MS = 3 * 60 * 1000
const MAX_GROUP = 7

// ── Message grouping ──
type GroupPos = 'first' | 'middle' | 'last' | null

function msgKey(msg: ChatMessageType): string {
  const tid = (msg as unknown as { _tempId?: string })._tempId
  return tid || String(msg.id || msg.msgId)
}

const msgGroupPos = computed<Record<string, GroupPos>>(() => {
  const map: Record<string, GroupPos> = {}
  const msgs = chat.messages
  let runStart = -1
  for (let i = 0; i < msgs.length; i++) {
    const prev = i > 0 ? msgs[i - 1] : null
    const next = i < msgs.length - 1 ? msgs[i + 1] : null
    const curr = msgs[i]
    if (curr.type === ChatHistoryType.Notice) continue
    const prevPos = prev ? map[msgKey(prev)] : null
    const canGroupWithPrev = prevPos && (prevPos === 'first' || prevPos === 'middle')
    if (!canGroupWithPrev) runStart = i
    const runLen = i - runStart + 1
    const groupableNext = next && next.senderID === curr.senderID && isGroupable(curr, next)
    const canGroupWithNext = groupableNext && runLen < MAX_GROUP
    if (runLen > 1) {
      if (!canGroupWithNext) map[msgKey(curr)] = 'last'
      else if (runLen === 1) map[msgKey(curr)] = 'first'
      else map[msgKey(curr)] = 'middle'
    } else if (canGroupWithNext) {
      map[msgKey(curr)] = 'first'
    }
  }
  return map
})

function isGroupable(a: { time: string; message: any[] }, b: { time: string; message: any[] }): boolean {
  const t1 = new Date(a.time).getTime()
  const t2 = new Date(b.time).getTime()
  if (Math.abs(t2 - t1) > GROUP_WINDOW_MS) return false
  return isTextOnly(a.message) && isTextOnly(b.message)
}

// ── Scroll ──
function scrollToBottom(smooth = false) {
  const el = messagesEl.value
  if (!el) return
  if (smooth) {
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  } else {
    el.scrollTop = el.scrollHeight
  }
}

function onScroll() {
  if (ctxMenuOpen) return // skip if context menu is open (handled in parent)
  const el = messagesEl.value
  if (!el) return
  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  showScrollBtn.value = distFromBottom > 200
  if (distFromBottom < 200 && chat.messages.length > MAX_VISIBLE) trimOldMessages()
  if (loadingMore.value || loadCooldown.value || !chat.hasMore) return
  if (el.scrollTop < 80) loadOlder()
}

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
      const fresh = (res.data.data as ChatMessageType[]).filter((m) => !existingIds.has(m.msgId))
      if (fresh.length > 0) chat.messages = [...fresh, ...chat.messages]
      chat.hasMore = res.data.data.length >= 50 && fresh.length > 0
      await nextTick()
      if (el) el.scrollTop = el.scrollHeight - prevHeight + prevScrollTop
    } else {
      chat.hasMore = false
    }
  } catch { lazyPage.value-- }
  finally {
    loadingMore.value = false
    loadCooldown.value = true
    cooldownTimer = setTimeout(() => { loadCooldown.value = false; cooldownTimer = null }, 500)
  }
}

watch(() => chat.currentChat, () => {
  lazyPage.value = 1
  showScrollBtn.value = false
  if (cooldownTimer) clearTimeout(cooldownTimer)
  loadCooldown.value = false
})

// Expose for parent
let ctxMenuOpen = false
function setCtxMenuOpen(v: boolean) { ctxMenuOpen = v }
defineExpose({ scrollToBottom, messagesEl, setCtxMenuOpen })
</script>

<template>
  <div ref="messagesEl" class="msg-scroll flex-grow-1 pa-3" @scroll="onScroll">
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
      <div v-if="chat.messages.length === 0 && !chat.msgLoading" class="text-center text-medium-emphasis pa-8">
        <div class="text-caption">暂无消息</div>
      </div>

      <template v-for="msg in chat.messages" :key="msgKey(msg)">
        <ChatMessageBubble
          :id="'msg-' + msgKey(msg)"
          :msg="msg"
          :group-pos="msgGroupPos[msgKey(msg)] ?? null"
          :is-self="msg.senderID === chat.botQQ"
          :pending-state="pendingSends[(msg as unknown as { _tempId?: string })._tempId || ''] || undefined"
          :reply-data="replyData"
          @contextmenu="emit('contextmenu', $event, msg)"
          @open-viewer="emit('open-viewer', $event)"
          @at-click="emit('at-click', $event)"
          @reply-click="emit('reply-click', $event)"
          @retry-click="emit('retry-click', $event)"
        />
      </template>
    </template>

    <!-- Scroll-to-bottom button -->
    <div class="scroll-bottom-wrap">
      <v-btn
        v-if="showScrollBtn"
        icon="mdi-chevron-down" size="small" variant="tonal" color="primary"
        @click="scrollToBottom(true)"
      />
    </div>
  </div>
</template>

<style scoped>
.msg-scroll { overflow-y: auto; scroll-behavior: smooth; position: relative; }
.scroll-bottom-wrap {
  position: sticky; bottom: 12px; display: flex;
  justify-content: flex-end; z-index: 2; pointer-events: none;
}
.scroll-bottom-wrap > * { pointer-events: auto; }
</style>
