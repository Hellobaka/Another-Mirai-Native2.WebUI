<script setup lang="ts">
import { MessageItemType } from '@/models'
import type { MessageItemBase } from '@/models'

defineProps<{
  item: MessageItemBase
}>()

function faceUrl(id: number) {
  return `https://qzonestyle.gtimg.cn/qzone/em/e${id}.gif`
}
</script>

<template>
  <span v-if="item.messageItemType === MessageItemType.Text" class="msg-text">
    {{ (item as { content: string }).content }}
  </span>

  <img
    v-else-if="item.messageItemType === MessageItemType.Face"
    :src="faceUrl((item as { faceId: number }).faceId)"
    class="msg-face"
    :alt="`[表情]`"
  />

  <span v-else-if="item.messageItemType === MessageItemType.Image" class="msg-image">
    <v-icon icon="mdi-image" size="14" class="mr-1" color="primary" />
    {{ (item as { isFlash: boolean }).isFlash ? '[闪照]' : '[图片]' }}
  </span>

  <span v-else-if="item.messageItemType === MessageItemType.At" class="msg-at">
    @{{ (item as { target: number; allTarget: boolean }).allTarget ? '全体成员' : (item as { target: number }).target }}
  </span>

  <span v-else-if="item.messageItemType === MessageItemType.Reply" class="msg-reply">
    <v-icon icon="mdi-reply" size="12" class="mr-1" />
    [回复 #{{ (item as { id: number }).id }}]
  </span>

  <span v-else-if="item.messageItemType === MessageItemType.Record" class="msg-misc">
    <v-icon icon="mdi-microphone" size="12" class="mr-1" />[语音]
  </span>

  <span v-else-if="item.messageItemType === MessageItemType.Video" class="msg-misc">
    <v-icon icon="mdi-video" size="12" class="mr-1" />[视频]
  </span>

  <span v-else-if="item.messageItemType === MessageItemType.Dice" class="msg-misc">
    <v-icon icon="mdi-dice-5" size="12" class="mr-1" />[骰子]
  </span>

  <span v-else-if="item.messageItemType === MessageItemType.Rps" class="msg-misc">
    <v-icon icon="mdi-hand-back-left" size="12" class="mr-1" />[猜拳]
  </span>

  <span v-else-if="item.messageItemType === MessageItemType.Shake" class="msg-misc">
    <v-icon icon="mdi-vibrate" size="12" class="mr-1" />[窗口抖动]
  </span>

  <span v-else-if="item.messageItemType === MessageItemType.Poke" class="msg-misc">
    <v-icon icon="mdi-gesture-tap" size="12" class="mr-1" />[戳一戳]
  </span>

  <span v-else class="msg-misc">[未知]</span>
</template>

<style scoped>
.msg-text { word-break: break-word; }
.msg-face { display: inline-block; width: 24px; height: 24px; vertical-align: middle; }
.msg-image { color: rgba(var(--v-theme-primary), 0.8); font-size: 0.85em; }
.msg-at { color: rgba(var(--v-theme-primary), 0.9); font-weight: 500; }
.msg-reply { color: rgba(var(--v-theme-on-surface), 0.5); font-size: 0.8em; }
.msg-misc { color: rgba(var(--v-theme-on-surface), 0.5); font-size: 0.85em; }
</style>
