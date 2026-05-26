<script setup lang="ts">
import { ref } from 'vue'

const open = defineModel<boolean>('open', { default: false })
const src = defineModel<string>('src', { default: '' })

const scale = ref(1)
const x = ref(0)
const y = ref(0)
let dragStart = { x: 0, y: 0, vx: 0, vy: 0 }

function close() {
  open.value = false
  scale.value = 1
  x.value = 0
  y.value = 0
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.15 : 0.15
  scale.value = Math.max(0.2, Math.min(5, scale.value + delta))
}

function onDragStart(e: MouseEvent) {
  dragStart = { x: e.clientX, y: e.clientY, vx: x.value, vy: y.value }
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e: MouseEvent) {
  x.value = dragStart.vx + (e.clientX - dragStart.x)
  y.value = dragStart.vy + (e.clientY - dragStart.y)
}

function onDragEnd() {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}
</script>

<template>
  <v-dialog :model-value="open" fullscreen content-class="viewer-dialog" @update:model-value="close">
    <div class="viewer-backdrop" @click="close" @wheel="onWheel">
      <v-btn icon="mdi-close" variant="text" size="large" class="viewer-close" @click="close" />
      <img
        :src="src"
        :style="{
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          cursor: scale > 1 ? 'grab' : 'default',
        }"
        class="viewer-img"
        draggable="false"
        @click.stop
        @mousedown="onDragStart"
      />
    </div>
  </v-dialog>
</template>

<style scoped>
.viewer-dialog {
  background: transparent !important;
}
.viewer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.viewer-close {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 10;
}
.viewer-img {
  max-width: 90vw;
  max-height: 90vh;
  transition: transform 0.05s ease-out;
}
</style>
