<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { getHistory } from '@/api/chat'
import { ChatHistoryType } from '@/models'
import type { ChatMessage as ChatMessageType } from '@/models'
import ChatMessageBubble from './ChatMessageBubble.vue'
import { isTextOnly } from './chatUtils'

const chat = useChatStore()

const props = defineProps<{
  pendingSends: Record<string, string>
  replyData: (id: number) => ChatMessageType | null
}>()

const emit = defineEmits<{
  contextmenu: [e: MouseEvent, msg: ChatMessageType]
  'open-viewer': [url: string]
  'at-click': [qq: number]
  'reply-click': [msgId: number]
  'retry-click': [msg: ChatMessageType]
}>()

const messagesEl = ref<HTMLElement | null>(null)
const topSentinel = ref<HTMLElement | null>(null)
const bottomSentinel = ref<HTMLElement | null>(null)
const loadingMore = ref(false)
const showScrollBtn = ref(false)
const lazyPage = ref(1)
let topObserver: IntersectionObserver | null = null
let bottomObserver: IntersectionObserver | null = null

const GROUP_WINDOW_MS = 3 * 60 * 1000
const MAX_GROUP = 7

const reversedMessages = computed<ChatMessageType[]>(() => {
  return [...chat.messages].reverse()
})

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

function isGroupable(
  a: { time: string; message: any[] },
  b: { time: string; message: any[] },
): boolean {
  const t1 = new Date(a.time).getTime()
  const t2 = new Date(b.time).getTime()
  if (Math.abs(t2 - t1) > GROUP_WINDOW_MS) return false
  return isTextOnly(a.message) && isTextOnly(b.message)
}

function scrollToBottom(smooth = false) {
  const el = messagesEl.value
  if (!el) return
  if (smooth) {
    el.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    el.scrollTop = 0
  }
}

function setupObservers() {
  topObserver?.disconnect()
  bottomObserver?.disconnect()

  const root = messagesEl.value
  if (!root) return

  if (topSentinel.value) {
    topObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore.value && chat.hasMore) {
          loadOlder()
        }
      },
      { root, rootMargin: '400px 0px 0px 0px', threshold: 0 },
    )
    topObserver.observe(topSentinel.value)
  }

  if (bottomSentinel.value) {
    bottomObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries[0].isIntersecting
        showScrollBtn.value = !visible
      },
      { root, threshold: 0 },
    )
    bottomObserver.observe(bottomSentinel.value)
  }
}

async function loadOlder() {
  if (!chat.currentChat || loadingMore.value || !chat.hasMore) return
  loadingMore.value = true
  try {
    lazyPage.value++
    const res = await getHistory(chat.currentChatType, chat.currentChat.parentId, lazyPage.value)
    if (res.data.code === 0 && res.data.data.length > 0) {
      const existingIds = new Set(chat.messages.map((m) => m.msgId))
      const fresh = (res.data.data as ChatMessageType[]).filter((m) => !existingIds.has(m.msgId))
      if (fresh.length > 0) {
        chat.messages = [...fresh, ...chat.messages]
      }
      chat.hasMore = res.data.data.length >= 50 && fresh.length > 0
    } else {
      chat.hasMore = false
    }
  } catch {
    lazyPage.value--
  } finally {
    loadingMore.value = false
  }
}

watch(
  () => chat.currentChat,
  () => {
    lazyPage.value = 1
    showScrollBtn.value = false
    nextTick(() => {
      if (messagesEl.value) messagesEl.value.scrollTop = 0
      setupObservers()
    })
  },
)

onMounted(() => {
  nextTick(() => setupObservers())
})

onUnmounted(() => {
  topObserver?.disconnect()
  bottomObserver?.disconnect()
})


defineExpose({ scrollToBottom, messagesEl })
</script>

<template>
  <div class="msg-scroll-wrap flex-grow-1">
    <div ref="messagesEl" class="msg-scroll pa-3">
      <div v-if="!chat.currentChat" class="no-chat-overlay">
        <v-icon icon="mdi-chat-outline" size="64" class="text-medium-emphasis mb-3" />
        <div class="text-body-1 text-medium-emphasis">选择一个会话开始聊天</div>
      </div>

      <template v-if="chat.currentChat">
        <div
          v-if="chat.messages.length === 0 && !chat.msgLoading"
          class="text-center text-medium-emphasis pa-8"
        >
          <div class="text-caption">暂无消息</div>
        </div>

        <div class="bottom-spring" />
        <div ref="bottomSentinel" class="bottom-sentinel" />

        <template v-for="msg in reversedMessages" :key="msgKey(msg)">
          <ChatMessageBubble
            :id="'msg-' + msgKey(msg)"
            :msg="msg"
            :group-pos="msgGroupPos[msgKey(msg)] ?? null"
            :is-self="msg.senderID === chat.botQQ"
            :pending-state="
              pendingSends[(msg as unknown as { _tempId?: string })._tempId || ''] || undefined
            "
            :reply-data="replyData"
            @contextmenu="emit('contextmenu', $event, msg)"
            @open-viewer="emit('open-viewer', $event)"
            @at-click="emit('at-click', $event)"
            @reply-click="emit('reply-click', $event)"
            @retry-click="emit('retry-click', $event)"
          />
        </template>

        <div ref="topSentinel" class="top-sentinel" />

        <div v-if="chat.msgLoading" class="text-center pa-4">
          <v-progress-circular indeterminate size="24" width="2" color="primary" />
        </div>

        <div v-if="loadingMore" class="text-center pa-2">
          <v-progress-circular indeterminate size="18" width="2" color="primary" />
        </div>
      </template>
    </div>

    <!-- Button outside the scroll container, positioned relative to the wrapper -->
    <Transition name="scroll-btn">
      <div v-if="showScrollBtn" class="scroll-bottom-wrap">
        <v-btn
          icon="mdi-chevron-down"
          size="small"
          variant="tonal"
          color="primary"
          @click="scrollToBottom(true)"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.msg-scroll-wrap {
  position: relative;
  min-height: 0;
}

.msg-scroll {
  display: flex;
  flex-direction: column-reverse;
  overflow-y: auto;
  height: 100%;
}

.bottom-spring {
  flex: 1 1 0;
}

.bottom-sentinel {
  height: 1px;
  flex-shrink: 0;
}

.no-chat-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1;
  height: 100%;
}

.top-sentinel {
  height: 1px;
  flex-shrink: 0;
}

.scroll-bottom-wrap {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
}

.scroll-btn-enter-active,
.scroll-btn-leave-active {
  transition: opacity 0.2s ease;
}
.scroll-btn-enter-from,
.scroll-btn-leave-to {
  opacity: 0;
}
</style>
