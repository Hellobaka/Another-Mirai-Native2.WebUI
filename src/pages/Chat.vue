<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { ChatHistoryType, MessageItemType } from '@/models'
import type { MessageItemBase } from '@/models'
import { useChatStore } from '@/stores/chat'

const app = useAppStore()
const chat = useChatStore()
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
  if (el) el.scrollTop = el.scrollHeight
}

function senderDisplay(msg: { senderID: number }): string {
  return chat.getCachedNick(msg.senderID) || String(msg.senderID)
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

// ── Message rendering helpers ──
function imageUrl(item: MessageItemBase): string {
  const img = item as unknown as { hash?: string; filePath?: string | null }
  const fp = img.filePath
  if (fp) return fp.startsWith('http') ? fp : `${API_BASE}/api/cache/image/${fp}`
  const h = img.hash
  if (h) return `${API_BASE}/api/cache/image/${h}`
  return ''
}

function isPureImage(items: MessageItemBase[]): boolean {
  return items.length > 0 && items.every((m) => m.messageItemType === MessageItemType.Image)
}

function isTextOnly(items: MessageItemBase[]): boolean {
  return items.every((m) => m.messageItemType === MessageItemType.Text)
}

function itemText(m: MessageItemBase): string {
  return (m as unknown as { content?: string }).content ?? ''
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
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// Scroll to bottom + prefetch nicks when messages change
watch(
  () => chat.messages.length,
  async () => {
    for (const msg of chat.messages) {
      const qq = msg.senderID
      if (!nickRequests.value.has(qq) && !chat.getCachedNick(qq)) {
        nickRequests.value.add(qq)
        chat.fetchNick(qq)
      }
    }
    await nextTick()
    scrollToBottom()
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
            :key="`${conv.type}-${conv.id}`"
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
        <div ref="messagesEl" class="msg-scroll flex-grow-1 pa-3">
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

            <template v-for="(msg, idx) in chat.messages" :key="msg.id || msg.msgId">
              <div
                :class="[
                  'msg-row',
                  msgGroupPos[msg.id || msg.msgId] === 'first' || !msgGroupPos[msg.id || msg.msgId]
                    ? 'msg-row-gap'
                    : '',
                ]"
              >
                <div class="d-flex align-start">
                  <!-- Avatar: hidden for middle/last -->
                  <v-avatar
                    v-if="
                      !msgGroupPos[msg.id || msg.msgId] ||
                      msgGroupPos[msg.id || msg.msgId] === 'first'
                    "
                    size="32"
                    class="mr-2 flex-shrink-0"
                  >
                    <v-img :src="senderAvatar(msg.senderID)" cover />
                  </v-avatar>
                  <div v-else class="flex-shrink-0 mr-2" style="width: 32px" />

                  <div class="flex-grow-1" style="min-width: 0">
                    <!-- Sender name: hidden for middle/last -->
                    <div
                      v-if="
                        !msgGroupPos[msg.id || msg.msgId] ||
                        msgGroupPos[msg.id || msg.msgId] === 'first'
                      "
                      class="d-flex align-center ga-1 mb-1"
                    >
                      <span class="msg-sender text-medium-emphasis">{{ senderDisplay(msg) }}</span>
                      <span class="msg-time">{{ formatMsgTime(msg.time) }}</span>
                    </div>
                    <div class="d-flex align-center ga-1">
                      <!-- Pure image: no bubble frame -->
                      <template v-if="isPureImage(msg.message)">
                        <div
                          v-for="(item, ii) in msg.message"
                          :key="ii"
                          :class="[
                            'msg-image-pure',
                            msgGroupPos[msg.id || msg.msgId]
                              ? `msg-bubble--${msgGroupPos[msg.id || msg.msgId]}`
                              : '',
                          ]"
                        >
                          <img :src="imageUrl(item)" class="msg-image-inline" loading="lazy" />
                        </div>
                      </template>
                      <!-- Mixed content: inside bubble -->
                      <div
                        v-else
                        :class="[
                          'msg-bubble',
                          msgGroupPos[msg.id || msg.msgId]
                            ? `msg-bubble--${msgGroupPos[msg.id || msg.msgId]}`
                            : '',
                        ]"
                      >
                        <template v-for="(item, si) in msg.message" :key="si">
                          <span
                            v-if="item.messageItemType === MessageItemType.Text"
                            class="msg-text-block"
                            >{{ itemText(item) }}</span
                          >
                          <img
                            v-else-if="item.messageItemType === MessageItemType.Image"
                            :src="imageUrl(item)"
                            class="msg-image-inline"
                            loading="lazy"
                          />
                          <span v-else class="msg-misc-inline">{{ itemText(item) || '' }}</span>
                        </template>
                      </div>
                      <span
                        v-if="
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
}
.msg-text-block {
  display: block;
}
.msg-misc-inline {
  display: block;
  color: rgba(var(--v-theme-on-surface), 0.5);
  font-size: 0.8em;
}

.msg-image-inline {
  max-width: 240px;
  max-height: 240px;
  border-radius: 12px;
  display: block;
  cursor: pointer;
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
.msg-row {
  max-width: 80%;
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
