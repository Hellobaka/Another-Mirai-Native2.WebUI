<script setup lang="ts">
import { computed, toRaw } from 'vue'
import { ChatHistoryType, MessageItemType } from '@/models'
import type { ChatMessage, MessageItemBase } from '@/models'
import { useChatStore } from '@/stores/chat'
import { cacheUrl } from '@/api/cache'
import {
  formatMsgTime, formatReplyTime, replyPreview,
  isPureMedia, itemText, trimmedItems, formatFileSize,
} from './chatUtils'

const props = defineProps<{
  msg: ChatMessage
  groupPos: string | null
  isSelf: boolean
  pendingState?: string
  replyData: (id: number) => ChatMessage | null
}>()

const isNotice = computed(() => props.msg.type === ChatHistoryType.Notice)

const emit = defineEmits<{
  contextmenu: [e: MouseEvent, msg: ChatMessage]
  'open-viewer': [url: string]
  'at-click': [qq: number]
  'reply-click': [msgId: number]
  'retry-click': [msg: ChatMessage]
}>()

const chat = useChatStore()

function senderDisplay(): string {
  const nick = chat.getCachedNick(props.msg.senderID) || String(props.msg.senderID)
  if (props.msg.pluginName) return `${nick}[${props.msg.pluginName}]`
  return nick
}

function mediaUrl(item: MessageItemBase, type: 'image' | 'record'): string {
  const m = item as unknown as { hash?: string; filePath?: string | null }
  return cacheUrl(type, m.filePath || m.hash || '')
}

function onContextMenu(e: MouseEvent) {
  emit('contextmenu', e, props.msg)
}

function senderAvatar(senderID: number) {
  return `https://q1.qlogo.cn/g?b=qq&nk=${senderID}&s=640`
}

function getTempId(): string {
  return (props.msg as unknown as { _tempId?: string })._tempId || ''
}

function fmtUnknown(item: unknown): string {
  try {
    return JSON.stringify(toRaw(item), null, 2)
  } catch {
    return String(item)
  }
}
</script>

<template>
  <!-- Notice message -->
  <div v-if="isNotice" class="msg-row msg-row--notice msg-row-gap">
    <div class="msg-bubble--notice">
      <template v-for="(item, si) in trimmedItems(msg.message)" :key="si">
        <span v-if="item.messageItemType === MessageItemType.Text" class="msg-notice-text">{{ itemText(item) }}</span>
      </template>
    </div>
  </div>

  <!-- Normal message -->
  <div
    v-else
    :class="[
      'msg-row',
      isSelf ? 'msg-row--self' : '',
      groupPos === 'first' || !groupPos ? 'msg-row-gap' : '',
    ]"
  >
    <div class="d-flex align-start" :class="{ 'flex-row-reverse': isSelf }">
      <!-- Avatar -->
      <v-avatar
        v-if="!groupPos || groupPos === 'first'"
        size="32"
        class="flex-shrink-0"
        :class="isSelf ? 'ml-2' : 'mr-2'"
      >
        <v-img :src="senderAvatar(msg.senderID)" cover />
      </v-avatar>
      <div v-else class="flex-shrink-0" :class="isSelf ? 'ml-2' : 'mr-2'" style="width: 32px" />

      <div class="flex-grow-1" style="min-width: 0">
        <!-- Sender + time -->
        <div
          v-if="!groupPos || groupPos === 'first'"
          class="d-flex align-center ga-1 mb-1"
          :class="{ 'justify-end': isSelf }"
        >
          <template v-if="isSelf">
            <span class="msg-time">{{ formatMsgTime(msg.time) }}</span>
            <span class="msg-sender text-medium-emphasis">{{ senderDisplay() }}</span>
          </template>
          <template v-else>
            <span class="msg-sender text-medium-emphasis">{{ senderDisplay() }}</span>
            <span class="msg-time">{{ formatMsgTime(msg.time) }}</span>
          </template>
        </div>

        <!-- Bubble content -->
        <div class="d-flex align-center ga-1" :class="{ 'justify-end': isSelf }">
          <!-- Self grouped time -->
          <span
            v-if="isSelf && groupPos && groupPos !== 'first'"
            class="msg-group-time msg-group-time--self"
          >{{ formatMsgTime(msg.time) }}</span>

          <!-- Self pending status -->
          <span v-if="isSelf && pendingState" class="msg-status-indicator">
            <v-progress-circular
              v-if="pendingState !== 'failed'"
              indeterminate size="14" width="2" color="primary"
            />
            <v-btn
              v-else
              icon="mdi-refresh" size="x-small" variant="text"
              density="compact" color="warning"
              @click.stop="emit('retry-click', msg)"
            />
          </span>

          <!-- Pure media -->
          <template v-if="isPureMedia(msg.message)">
            <div
              v-for="(item, ii) in msg.message"
              :key="ii"
              :class="[
                'msg-image-pure',
                msg.recalled ? 'msg-image-pure--recalled' : '',
                groupPos
                  ? isSelf
                    ? `msg-image-pure--self-${groupPos}`
                    : `msg-bubble--${groupPos}`
                  : '',
              ]"
              @contextmenu="onContextMenu"
            >
              <template v-if="item.messageItemType === MessageItemType.Image">
                <div class="msg-image-loading">
                  <div class="msg-image-skeleton">
                    <v-progress-circular indeterminate size="20" width="2" color="primary" />
                  </div>
                  <div class="msg-image-error">
                    <v-icon icon="mdi-image-broken-variant" size="24" />
                    <span>图片加载失败</span>
                  </div>
                  <img
                    :src="mediaUrl(item, 'image')"
                    class="msg-image-inline"
                    loading="lazy"
                    @load="($event.target as HTMLElement).parentElement!.classList.add('msg-image-loading--done')"
                    @error="($event.target as HTMLElement).parentElement!.classList.add('msg-image-loading--error')"
                    @click="emit('open-viewer', mediaUrl(item, 'image'))"
                  />
                </div>
                <div v-if="msg.recalled" class="recall-overlay">
                  <span class="recall-text">已撤回</span>
                </div>
              </template>
              <audio
                v-else-if="item.messageItemType === MessageItemType.Record"
                :src="mediaUrl(item, 'record')"
                class="msg-audio"
                controls preload="metadata"
              />
              <div v-else-if="item.messageItemType === MessageItemType.File" class="msg-file-card">
                <v-icon icon="mdi-file-outline" size="20" class="mr-2" />
                <div class="msg-file-info">
                  <span class="msg-file-name">{{ (item as unknown as { fileName: string }).fileName }}</span>
                  <span class="msg-file-size">{{ formatFileSize((item as unknown as { fileSize: number }).fileSize) }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- Mixed content bubble -->
          <div
            v-else
            :class="[
              'msg-bubble',
              msg.recalled ? 'msg-bubble--recalled' : '',
              isSelf ? 'msg-bubble--self' : '',
              groupPos
                ? isSelf
                  ? `msg-bubble--self-${groupPos}`
                  : `msg-bubble--${groupPos}`
                : '',
            ]"
            @contextmenu="onContextMenu"
          >
            <!-- Parsing placeholder -->
            <div
              v-if="trimmedItems(msg.message).length === 0 && getTempId()"
              class="d-flex align-center justify-center py-2"
            >
              <v-progress-circular indeterminate size="16" width="2" color="primary" />
            </div>

            <!-- Fallback: real message with no renderable items -->
            <div
              v-if="trimmedItems(msg.message).length === 0 && !getTempId()"
              class="msg-empty-fallback"
            >
              <span class="msg-unknown-inline">
                <v-icon icon="mdi-code-braces" size="14" class="mr-1" />
                无渲染内容
                <v-tooltip activator="parent" location="top" max-width="360">
                  <pre class="msg-unknown-json">{{ fmtUnknown(msg.message) }}</pre>
                </v-tooltip>
              </span>
            </div>

            <template v-for="(item, si) in trimmedItems(msg.message)" :key="si">
              <!-- @ block -->
              <span
                v-if="item.messageItemType === MessageItemType.At"
                class="msg-at"
                :class="{ 'msg-at--clickable': !(item as unknown as { allTarget: boolean }).allTarget }"
                @click="!(item as unknown as { allTarget: boolean }).allTarget && emit('at-click', (item as unknown as { target: number }).target)"
              >
                {{ (item as unknown as { allTarget: boolean }).allTarget ? '@全体成员' : '@' + (chat.getCachedNick((item as unknown as { target: number }).target) || (item as unknown as { target: number }).target) }}
              </span>
              <!-- Reply block -->
              <div
                v-else-if="item.messageItemType === MessageItemType.Reply"
                class="msg-reply-card"
                @click="emit('reply-click', (item as unknown as { id: number }).id)"
              >
                <template v-if="replyData((item as unknown as { id: number }).id)">
                  <div class="msg-reply-header">
                    <span class="msg-reply-sender">{{ chat.getCachedNick(replyData((item as unknown as { id: number }).id)!.senderID) || replyData((item as unknown as { id: number }).id)!.senderID }}</span>
                    <span class="msg-reply-time"> · {{ formatReplyTime(replyData((item as unknown as { id: number }).id)!.time) }}</span>
                  </div>
                  <div class="msg-reply-body line-clamp-1">
                    {{ replyPreview(replyData((item as unknown as { id: number }).id)!.message) }}
                  </div>
                </template>
                <template v-else>
                  <div class="msg-reply-header"><span class="msg-reply-sender">回复</span></div>
                  <div class="msg-reply-body line-clamp-1">加载中...</div>
                </template>
              </div>
              <!-- Text -->
              <span v-else-if="item.messageItemType === MessageItemType.Text" class="msg-text-block">{{ itemText(item) }}</span>
              <!-- Face -->
              <img
                v-else-if="item.messageItemType === MessageItemType.Face || item.messageItemType === MessageItemType.Bface"
                :src="`/qq-face/${(item as unknown as { faceId: number }).faceId}.png`"
                class="msg-face-inline"
              />
              <!-- Image -->
              <div v-else-if="item.messageItemType === MessageItemType.Image" class="msg-image-loading msg-image-loading--inline">
                <div class="msg-image-skeleton">
                  <v-progress-circular indeterminate size="16" width="2" color="primary" />
                </div>
                <div class="msg-image-error">
                  <v-icon icon="mdi-image-broken-variant" size="18" />
                  <span>加载失败</span>
                </div>
                <img
                  :src="mediaUrl(item, 'image')"
                  class="msg-image-inline"
                  loading="lazy"
                  @load="($event.target as HTMLElement).parentElement!.classList.add('msg-image-loading--done')"
                  @error="($event.target as HTMLElement).parentElement!.classList.add('msg-image-loading--error')"
                  @click="emit('open-viewer', mediaUrl(item, 'image'))"
                />
              </div>
              <!-- Record -->
              <audio
                v-else-if="item.messageItemType === MessageItemType.Record"
                :src="mediaUrl(item, 'record')"
                class="msg-audio"
                controls preload="metadata"
              />
              <!-- File -->
              <div v-else-if="item.messageItemType === MessageItemType.File" class="msg-file-card">
                <v-icon icon="mdi-file-outline" size="20" class="mr-2" />
                <div class="msg-file-info">
                  <span class="msg-file-name">{{ (item as unknown as { fileName: string }).fileName }}</span>
                  <span class="msg-file-size">{{ formatFileSize((item as unknown as { fileSize: number }).fileSize) }}</span>
                </div>
              </div>
              <!-- Unknown -->
              <span
                v-else-if="item.messageItemType === MessageItemType.Unknown"
                class="msg-unknown-inline msg-unknown-inline--known"
              >
                <v-icon icon="mdi-help-circle-outline" size="14" class="mr-1" />
                不支持的消息
                <v-tooltip activator="parent" location="top" max-width="340">
                  <pre class="msg-unknown-json">{{ fmtUnknown(item) }}</pre>
                </v-tooltip>
              </span>
              <!-- Unhandled type -->
              <span v-else class="msg-unknown-inline">
                <v-icon icon="mdi-code-braces" size="14" class="mr-1" />
                未知消息
                <v-tooltip activator="parent" location="top" max-width="340">
                  <pre class="msg-unknown-json">{{ fmtUnknown(item) }}</pre>
                </v-tooltip>
              </span>
            </template>
          </div>

          <!-- Other grouped time -->
          <span
            v-if="!isSelf && groupPos && groupPos !== 'first'"
            class="msg-group-time"
          >{{ formatMsgTime(msg.time) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.msg-row {
  max-width: 80%;
}
.msg-row--self {
  margin-left: auto;
}
.msg-row--notice {
  max-width: 100%;
  display: flex;
  justify-content: center;
}
.msg-row:not(.msg-row-gap) {
  margin-top: 1px;
}
.msg-row-gap {
  margin-top: 8px;
}
.msg-bubble--notice {
  display: inline-block;
  max-width: 70%;
  padding: 4px 14px;
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.msg-notice-text {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  word-break: break-word;
}
.msg-sender { font-size: 0.7rem; }
.msg-time {
  font-size: 0.65rem;
  color: rgba(var(--v-theme-on-surface), 0.4);
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
.msg-bubble--first { border-bottom-left-radius: 2px; }
.msg-bubble--middle { border-top-left-radius: 2px; border-bottom-left-radius: 2px; }
.msg-bubble--last { border-top-left-radius: 2px; }
.msg-bubble--self-first { border-bottom-right-radius: 2px; }
.msg-bubble--self-middle { border-top-right-radius: 2px; border-bottom-right-radius: 2px; }
.msg-bubble--self-last { border-top-right-radius: 2px; }
.msg-bubble--recalled {
  background: rgba(180, 40, 40, 0.15) !important;
}
.msg-bubble--recalled .msg-text-block {
  text-decoration: line-through;
  opacity: 0.55;
}
.msg-text-block { white-space: pre-wrap; }

.msg-face-inline {
  width: 24px;
  height: 24px;
  vertical-align: middle;
  display: inline;
}

.msg-image-pure {
  border-radius: 12px;
  overflow: hidden;
  display: block;
  max-width: 50%;
}
.msg-image-pure.msg-bubble--first { border-bottom-left-radius: 2px; }
.msg-image-pure.msg-bubble--middle { border-top-left-radius: 2px; border-bottom-left-radius: 2px; }
.msg-image-pure.msg-bubble--last { border-top-left-radius: 2px; }
.msg-image-pure.msg-image-pure--self-first { border-bottom-right-radius: 2px; }
.msg-image-pure.msg-image-pure--self-middle { border-top-right-radius: 2px; border-bottom-right-radius: 2px; }
.msg-image-pure.msg-image-pure--self-last { border-top-right-radius: 2px; }
.msg-image-pure--recalled {
  position: relative;
}
.msg-image-pure--recalled .msg-image-inline {
  filter: blur(12px);
  opacity: 0.6;
  transition: filter 0.2s ease, opacity 0.2s ease;
}
.msg-image-pure--recalled:hover .msg-image-inline {
  filter: blur(0);
  opacity: 1;
}
.recall-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  transition: opacity 0.2s ease;
}
.msg-image-pure--recalled:hover .recall-overlay {
  opacity: 0;
}
.recall-text {
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.75rem;
  font-weight: 500;
  background: rgba(0, 0, 0, 0.45);
  padding: 3px 10px;
  border-radius: 6px;
}
.msg-image-inline {
  max-width: 100%;
  max-height: 320px;
  border-radius: 12px;
  display: block;
  margin: 2px 0;
  cursor: pointer;
}

/* ── Image loading placeholder ── */
.msg-image-loading {
  position: relative;
  display: block;
  min-height: 80px;
  min-width: 100px;
}
.msg-image-loading--inline {
  min-height: 60px;
  min-width: 80px;
  display: inline-block;
  vertical-align: middle;
  margin: 2px 0;
}
.msg-image-skeleton {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-radius: 12px;
  z-index: 1;
}
.msg-image-loading--done .msg-image-skeleton,
.msg-image-loading--error .msg-image-skeleton {
  display: none;
}
.msg-image-loading--done .msg-image-error {
  display: none;
}
.msg-image-loading--error .msg-image-inline {
  display: none;
}
.msg-image-error {
  position: absolute;
  inset: 0;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-radius: 12px;
  color: rgba(var(--v-theme-on-surface), 0.3);
  font-size: 0.7rem;
  z-index: 2;
}
.msg-image-loading--error .msg-image-error {
  display: flex;
}
.msg-image-loading .msg-image-inline {
  position: relative;
  z-index: 0;
}

/* ── Unknown / unhandled message type ── */
.msg-unknown-inline {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(var(--v-theme-warning), 0.1);
  color: rgba(var(--v-theme-warning), 0.85);
  font-size: 0.75rem;
  cursor: help;
}
.msg-unknown-inline--known {
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: rgba(var(--v-theme-on-surface), 0.55);
}
.msg-unknown-json {
  margin: 0;
  font-size: 0.7rem;
  white-space: pre-wrap;
  word-break: break-all;
  color: rgba(var(--v-theme-on-surface), 0.8);
  max-height: 200px;
  overflow-y: auto;
}

.msg-audio { display: block; max-width: 280px; height: 36px; margin: 2px 0; }

.msg-file-card {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  gap: 8px;
  max-width: 260px;
  cursor: default;
}
.msg-file-info { display: flex; flex-direction: column; min-width: 0; }
.msg-file-name { font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.msg-file-size { font-size: 0.68rem; color: rgba(var(--v-theme-on-surface), 0.45); }

/* ── At block ── */
.msg-at { display: inline; color: rgb(var(--v-theme-primary)); font-weight: 500; }
.msg-at--clickable { cursor: pointer; text-decoration: underline dotted; }
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
.msg-reply-card:hover { background: rgba(var(--v-theme-primary), 0.06); }
.msg-reply-header { font-size: 0.7rem; color: rgb(var(--v-theme-primary)); margin-bottom: 2px; }
.msg-reply-body { font-size: 0.75rem; color: rgba(var(--v-theme-on-surface), 0.6); }

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.msg-misc-inline { display: block; color: rgba(var(--v-theme-on-surface), 0.5); font-size: 0.8em; }

/* ── Group time ── */
.msg-group-time {
  font-size: 0.6rem;
  color: rgba(var(--v-theme-on-surface), 0.35);
  opacity: 0;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
}
.msg-row:hover .msg-group-time { opacity: 1; }

.msg-status-indicator { flex-shrink: 0; }
</style>
