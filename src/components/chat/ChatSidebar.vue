<script setup lang="ts">
import { useChatStore } from '@/stores/chat'
import { ChatHistoryType } from '@/models'

const chat = useChatStore()

const emit = defineEmits<{
  select: [conv: { type: number; parentID: number }]
}>()

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

function onSelect(conv: (typeof chat.conversations.value)[0]) {
  emit('select', conv)
}

function formatConvTime(ts: number | string) {
  if (!ts) return ''
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return '昨天'
  if (diffDays === 2) return '前天'
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <div class="chat-sidebar">
    <v-card class="glass-card" height="100%" style="display: flex; flex-direction: column">
      <v-card-title class="text-body-1 pa-3 d-flex align-center" style="flex-shrink: 0">
        会话
        <v-spacer />
        <v-btn
          size="x-small" variant="text" icon="mdi-refresh"
          :loading="chat.loading" @click="chat.fetchConversations"
        />
      </v-card-title>
      <v-divider />

      <div class="conv-list" style="flex: 1; overflow-y: auto">
        <div
          v-for="conv in chat.conversations"
          :key="`${conv.type}-${conv.parentID}`"
          class="conv-item pa-2 mx-1"
          :class="{ 'conv-active': chat.currentChat?.parentId === conv.parentID }"
          @click="onSelect(conv)"
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
                {{ conv.unreadCount }}
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
</template>

<style scoped>
.chat-sidebar { width: 300px; flex-shrink: 0; }
.conv-item {
  display: flex; align-items: center; cursor: pointer;
  border-radius: 12px; transition: background 0.15s ease;
}
.conv-item:hover { background: rgba(var(--v-theme-on-surface), 0.04); }
.conv-active { background: rgba(var(--v-theme-primary), 0.1); }
.conv-active:hover { background: rgba(var(--v-theme-primary), 0.14); }
.conv-name { font-weight: 500; }
.conv-time { font-size: 0.65rem; color: rgba(var(--v-theme-on-surface), 0.45); }
.conv-preview { font-size: 0.72rem; color: rgba(var(--v-theme-on-surface), 0.55); }
.text-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.unread-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px;
  background: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-on-primary));
  font-size: 0.68rem; font-weight: 600; line-height: 1;
}
</style>
