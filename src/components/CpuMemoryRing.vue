<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, required: true },
  label: { type: String, required: true },
  color: { type: String, default: 'primary' },
  size: { type: Number, default: 120 },
})

const circumference = computed(() => 2 * Math.PI * 40)
const dashOffset = computed(() => circumference.value * (1 - Math.min(props.value, 100) / 100))
</script>

<template>
  <div class="d-flex flex-column align-center">
    <div class="position-relative" :style="{ width: size + 'px', height: size + 'px' }">
      <svg :width="size" :height="size" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          stroke-width="8"
          class="text-surface-variant"
          opacity="0.3"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          :stroke="color"
          stroke-width="8"
          stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset"
          transform="rotate(-90 50 50)"
          style="transition: stroke-dashoffset 0.8s var(--transition-smooth)"
        />
      </svg>
      <div class="position-absolute d-flex flex-column align-center justify-center" style="inset: 0">
        <span class="text-h6 font-weight-bold">{{ Math.round(value) }}%</span>
      </div>
    </div>
    <span class="text-caption text-medium-emphasis mt-2">{{ label }}</span>
  </div>
</template>
