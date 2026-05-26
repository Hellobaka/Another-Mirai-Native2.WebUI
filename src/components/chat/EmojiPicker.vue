<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  collectedImages: string[]
}>()

const emit = defineEmits<{
  insert: [text: string]
  insertCollected: [file: string]
}>()

const emojiTab = ref<'common' | 'favorite'>('common')

const EMOJI_CACHE_KEY = 'amn_emoji_common'
const DEFAULT_COMMON = []
const MAX_COMMON = 10

function loadCommonEmojis(): number[] {
  try {
    const raw = localStorage.getItem(EMOJI_CACHE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length > 0) return arr
    }
  } catch {
    /* */
  }
  return [...DEFAULT_COMMON]
}

const commonEmojiIds = ref<number[]>(loadCommonEmojis())

function bumpEmoji(id: number) {
  const ids = commonEmojiIds.value.filter((x) => x !== id)
  ids.unshift(id)
  if (ids.length > MAX_COMMON) ids.length = MAX_COMMON
  commonEmojiIds.value = ids
  localStorage.setItem(EMOJI_CACHE_KEY, JSON.stringify(ids))
}

const emojiModules = import.meta.glob('/public/qq-face/*.png')
const allEmojiIds = Object.keys(emojiModules)
  .map((path) => Number(path.match(/(\d+)\.png$/)![1]))
  .sort((a, b) => a - b)

function emojiUrl(id: number) {
  return `/qq-face/${id}.png`
}

function insertEmoji(id: number) {
  emit('insert', `[CQ:face,id=${id}]`)
  bumpEmoji(id)
}

function insertCollected(name: string) {
  emit('insertCollected', `collected/${name}`)
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
function authToken() {
  return localStorage.getItem('amn_token') || ''
}
</script>

<template>
  <v-card width="380" height="340">
    <v-card-text class="pa-2" style="height: 290px; overflow-y: auto">
      <v-tabs-window v-model="emojiTab">
        <v-tabs-window-item value="common">
          <div class="text-caption text-medium-emphasis px-1 pb-1">常用</div>
          <div class="d-flex flex-wrap ga-1">
            <div v-for="id in commonEmojiIds" :key="id" class="emoji-item" @click="insertEmoji(id)">
              <img :src="emojiUrl(id)" :alt="String(id)" class="emoji-img" loading="lazy" />
            </div>
          </div>
          <div class="text-caption text-medium-emphasis px-1 pb-1 mt-2">全部表情</div>
          <div class="d-flex flex-wrap ga-1">
            <div v-for="id in allEmojiIds" :key="id" class="emoji-item" @click="insertEmoji(id)">
              <img :src="emojiUrl(id)" :alt="String(id)" class="emoji-img" loading="lazy" />
            </div>
          </div>
        </v-tabs-window-item>
        <v-tabs-window-item value="favorite">
          <div
            v-if="collectedImages.length === 0"
            class="text-center text-medium-emphasis pa-8 text-caption"
          >
            暂无收藏图片
          </div>
          <div v-else class="d-flex flex-wrap ga-2">
            <div
              v-for="img in collectedImages"
              :key="img"
              class="collected-item"
              @click="insertCollected(img)"
            >
              <v-img
                :src="`${API_BASE}/external/image/collected/${img}?access_token=${authToken()}`"
                width="80"
                height="80"
                cover
                class="collected-thumb"
              />
            </div>
          </div>
        </v-tabs-window-item>
      </v-tabs-window>
    </v-card-text>
    <v-divider />
    <v-tabs v-model="emojiTab" density="compact" class="px-1">
      <v-tab value="common"><v-icon icon="mdi-emoticon-outline" size="20" /></v-tab>
      <v-tab value="favorite"><v-icon icon="mdi-heart-outline" size="20" /></v-tab>
    </v-tabs>
  </v-card>
</template>

<style scoped>
.emoji-item {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s ease;
}
.emoji-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.emoji-img {
  width: 28px;
  height: 28px;
  pointer-events: none;
}
.collected-item {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
}
.collected-item:hover {
  opacity: 0.85;
}
.collected-thumb {
  border-radius: 6px;
}
</style>
