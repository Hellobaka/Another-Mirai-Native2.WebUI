<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  target: { type: Number, required: true },
  duration: { type: Number, default: 800 },
  prefix: { type: String, default: '' },
  suffix: { type: String, default: '' },
  decimals: { type: Number, default: 0 },
})

const display = ref(0)

function animate() {
  const start = display.value
  const diff = props.target - start
  if (diff === 0) return

  const startTime = performance.now()

  function step(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / props.duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    display.value = start + diff * eased

    if (progress < 1) {
      requestAnimationFrame(step)
    } else {
      display.value = props.target
    }
  }

  requestAnimationFrame(step)
}

watch(() => props.target, animate)
onMounted(animate)
</script>

<template>
  <span>{{ prefix }}{{ display.toFixed(decimals) }}{{ suffix }}</span>
</template>
