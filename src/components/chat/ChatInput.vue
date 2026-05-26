<script setup lang="ts">
import { ref, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useNotifyStore } from '@/stores/notify'
import { uploadPicture } from '@/api/chat'
import EmojiPicker from './EmojiPicker.vue'
import RichInput from './RichInput.vue'

const chat = useChatStore()
const notify = useNotifyStore()

const model = defineModel<string>({ default: '' })

import type { ChatMessage } from '@/models'

defineProps<{
  disabled?: boolean
  collectedImages: string[]
  replyCache?: Record<number, ChatMessage | null>
}>()

const emit = defineEmits<{
  send: []
  'open-emoji': []
}>()

const imageUploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const emojiOpen = ref(false)
const emojiPos = ref<[number, number]>([0, 0])
const richInput = ref<InstanceType<typeof RichInput> | null>(null)

function onEmojiBtnClick(e: MouseEvent) {
  emojiPos.value = [e.clientX, e.clientY]
  emojiOpen.value = true
  emit('open-emoji')
}

function onInsertEmoji(cqCode: string) {
  // Parse [CQ:face,id=N] and insert as face chip
  const m = cqCode.match(/\[CQ:face,id=(\d+)\]/)
  if (m) {
    richInput.value?.insertSegment({ kind: 'face', id: Number(m[1]) })
  } else {
    // Fallback: let RichInput parse the CQ code from model
    model.value += cqCode
  }
}

function onInsertCollected(file: string) {
  richInput.value?.insertSegment({ kind: 'image', file })
  emojiOpen.value = false
}

function triggerImageUpload() {
  fileInput.value?.click()
}

async function uploadAndInsert(file: File) {
  imageUploading.value = true
  try {
    const res = await uploadPicture(file)
    if (res.data.code === 0) {
      const fp = ((res.data.data.item as unknown as { filePath?: string })?.filePath || '').replace(/\\/g, '/')
      if (fp) {
        richInput.value?.insertSegment({ kind: 'image', file: fp })
        notify.success('图片已上传')
      } else {
        notify.error('上传失败：未返回文件路径')
      }
    } else {
      notify.error(res.data.message || '上传失败')
    }
  } catch {
    notify.error('上传失败')
  } finally {
    imageUploading.value = false
  }
}

async function onImageSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  await uploadAndInsert(file)
  ;(e.target as HTMLInputElement).value = ''
}

// Expose insert methods for parent (Chat.vue context menu)
function insertAt(qq: number) {
  richInput.value?.insertSegment({ kind: 'at', qq })
}

function insertReply(id: number) {
  richInput.value?.insertSegment({ kind: 'reply', id })
}

function insertFace(id: number) {
  richInput.value?.insertSegment({ kind: 'face', id })
}

function insertImage(file: string) {
  richInput.value?.insertSegment({ kind: 'image', file })
}

function getNick(qq: number): string {
  return chat.getCachedNick(qq) || String(qq)
}

defineExpose({ insertAt, insertReply, insertFace, insertImage })
</script>

<template>
  <div class="pa-3" style="flex-shrink: 0; position: relative">
    <v-divider class="mb-3" />

    <!-- Upload overlay -->
    <div v-if="imageUploading" class="upload-overlay d-flex align-center justify-center flex-column ga-2">
      <v-progress-circular indeterminate size="32" width="3" color="primary" />
      <span class="text-caption text-medium-emphasis">图片上传中...</span>
    </div>

    <!-- Toolbar -->
    <div class="d-flex ga-1 mb-2">
      <v-btn
        icon="mdi-sticker-emoji" size="default" variant="text"
        :disabled="imageUploading || disabled"
        @click="onEmojiBtnClick($event)"
      />
      <v-btn
        icon="mdi-image-outline" size="default" variant="text"
        :loading="imageUploading" :disabled="imageUploading || disabled"
        @click="triggerImageUpload"
      />
      <input ref="fileInput" type="file" accept="image/*" style="display: none" @change="onImageSelected" />
    </div>

    <!-- Input row -->
    <div class="d-flex ga-2">
      <RichInput
        ref="richInput"
        v-model="model"
        class="flex-grow-1"
        :disabled="imageUploading || disabled"
        :reply-cache="replyCache"
        :get-nick="getNick"
        @send="emit('send')"
        @image-paste="(file: File) => uploadAndInsert(file)"
      />
      <v-btn
        variant="tonal" color="primary" icon="mdi-send"
        :loading="chat.sending" :disabled="imageUploading || disabled"
        @click="emit('send')"
      />
    </div>

    <!-- Emoji picker flyout -->
    <v-menu
      v-model="emojiOpen"
      :target="emojiPos"
      location="top start"
      :close-on-content-click="false"
    >
      <EmojiPicker
        :collected-images="collectedImages"
        @insert="onInsertEmoji"
        @insert-collected="onInsertCollected"
      />
    </v-menu>
  </div>
</template>

<style scoped>
.upload-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: rgba(var(--v-theme-surface), 0.7);
  backdrop-filter: blur(4px);
  border-radius: 12px;
}
</style>
