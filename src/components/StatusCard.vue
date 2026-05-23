<script setup>
defineProps({
  icon: { type: String, required: true },
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  subtitle: { type: String, default: '' },
  color: { type: String, default: 'primary' },
})
</script>

<template>
  <v-card class="glass-card pa-4" height="100%">
    <div class="d-flex align-center ga-3">
      <v-avatar :color="color" size="48" rounded="lg">
        <v-icon :icon="icon" color="white" size="24" />
      </v-avatar>
      <div class="text-caption text-medium-emphasis">{{ label }}</div>
    </div>
    <div class="text-h4 font-weight-bold mt-3">{{ value }}</div>
    <div v-if="subtitle" class="text-caption text-medium-emphasis mt-1">{{ subtitle }}</div>
  </v-card>
</template>
