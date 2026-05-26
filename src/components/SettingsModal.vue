<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()

const url = ref(settings.apiBaseUrl)
const saved = ref(false)

watch(() => settings.modalOpen, (open) => {
  if (open) {
    url.value = settings.apiBaseUrl
    saved.value = false
  }
})

function save() {
  settings.applyBaseUrl(url.value)
  saved.value = true
  setTimeout(() => {
    settings.closeModal()
  }, 600)
}

function reset() {
  url.value = import.meta.env.VITE_API_BASE_URL || ''
  settings.resetBaseUrl()
  saved.value = true
  setTimeout(() => {
    settings.closeModal()
  }, 600)
}

function onClose() {
  settings.closeModal()
}
</script>

<template>
  <v-dialog v-model="settings.modalOpen" max-width="460" @click:outside="onClose">
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon icon="mdi-cog" size="20" />
        <span>后端地址配置</span>
      </v-card-title>
      <v-card-text>
        <v-text-field
          v-model="url"
          label="后端 API 地址"
          variant="outlined"
          placeholder="http://localhost:5000"
          persistent-placeholder
          hide-details
          class="mb-4"
        />
        <div class="text-caption text-medium-emphasis">
          修改后将立即生效，配置保存至本地浏览器。
        </div>
        <div v-if="saved" class="text-caption text-success mt-1">
          配置已保存
        </div>
      </v-card-text>
      <v-card-actions>
        <v-btn variant="text" @click="reset">恢复默认</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="onClose">取消</v-btn>
        <v-btn variant="tonal" color="primary" @click="save">保存</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
