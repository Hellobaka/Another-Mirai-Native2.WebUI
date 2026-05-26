<script setup lang="ts">
import { ref } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useNotifyStore } from '@/stores/notify'
import { uploadPicture } from '@/api/chat'
import EmojiPicker from './EmojiPicker.vue'

const chat = useChatStore()
const notify = useNotifyStore()

const model = defineModel<string>({ default: '' })

defineProps<{
  disabled?: boolean
  collectedImages: string[]
}>()

const emit = defineEmits<{
  send: []
}>()

const imageUploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const emojiOpen = ref(false)
const emojiPos = ref<[number, number]>([0, 0])

function onEmojiBtnClick(e: MouseEvent) {
  emojiPos.value = [e.clientX, e.clientY]
  emojiOpen.value = true
  emit('open-emoji')
}

function onInsertEmoji(text: string) {
  model.value += text
}

function triggerImageUpload() {
  fileInput.value?.click()
}

async function onImageSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  imageUploading.value = true
  try {
    const res = await uploadPicture(file)
    if (res.data.code === 0) {
      const fp = ((res.data.data.item as unknown as { filePath?: string })?.filePath || '').replace(/\\/g, '/')
      if (fp) {
        model.value += `[CQ:image,file=${fp}]`
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
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function onInputPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (!file) continue
      imageUploading.value = true
      try {
        const res = await uploadPicture(file)
        if (res.data.code === 0) {
          const fp = ((res.data.data.item as unknown as { filePath?: string })?.filePath || '').replace(/\\/g, '/')
          if (fp) {
            model.value += `[CQ:image,file=${fp}]`
            notify.success('图片已上传')
          }
        } else {
          notify.error(res.data.message || '上传失败')
        }
      } catch {
        notify.error('上传失败')
      } finally {
        imageUploading.value = false
      }
      break
    }
  }
}

function onInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    emit('send')
  }
}
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
      <v-textarea
        v-model="model"
        placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
        variant="outlined" density="compact" hide-details
        auto-grow rows="1" max-rows="6"
        :disabled="imageUploading || disabled"
        @keydown="onInputKeydown"
        @paste="onInputPaste"
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
