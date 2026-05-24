<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useNotifyStore } from '@/stores/notify'
import {
  getPluginList,
  getPluginInfo,
  enablePlugin,
  disablePlugin,
  reloadPlugin,
  reloadAllPlugins,
} from '@/api/plugin'
import { type PluginDto, type PluginDetail, PluginTypeLabels, authLabel } from '@/models'

const app = useAppStore()
const notify = useNotifyStore()
app.setPageTitle('插件管理')

const plugins = ref<PluginDto[]>([])
const search = ref('')
const loading = ref(true)
const actionLoading = ref<number | null>(null)
const reloadAllLoading = ref(false)

const detailOpen = ref(false)
const detail = ref<PluginDetail | null>(null)
const detailLoading = ref(false)

async function fetchPlugins() {
  const res = await getPluginList()
  if (res.data.code === 0) plugins.value = res.data.data
}

const filteredPlugins = computed(() => {
  if (!search.value) return plugins.value
  const q = search.value.toLowerCase()
  return plugins.value.filter(
    (p) =>
      p.pluginName.toLowerCase().includes(q) ||
      p.author.toLowerCase().includes(q) ||
      p.pluginId.toLowerCase().includes(q),
  )
})

const enabledCount = computed(() => plugins.value.filter((p) => p.enabled).length)

async function openDetail(plugin: PluginDto) {
  detailOpen.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res = await getPluginInfo(plugin.authCode)
    if (res.data.code === 0) detail.value = res.data.data
  } finally {
    detailLoading.value = false
  }
}

async function togglePlugin(plugin: PluginDto) {
  actionLoading.value = plugin.authCode
  try {
    if (plugin.enabled) {
      await disablePlugin(plugin.authCode)
    } else {
      await enablePlugin(plugin.authCode)
    }
    await fetchPlugins()
  } finally {
    actionLoading.value = null
  }
}

async function reloadOne(plugin: PluginDto) {
  actionLoading.value = plugin.authCode
  try {
    await reloadPlugin(plugin.authCode)
    await fetchPlugins()
    notify.success(`${plugin.pluginName} 已重载`)
  } catch {
    notify.error('重载失败')
  } finally {
    actionLoading.value = null
  }
}

async function reloadAll() {
  reloadAllLoading.value = true
  try {
    const res = await reloadAllPlugins()
    if (res.data.code === 0) plugins.value = res.data.data
    notify.success('全部插件已重载')
  } catch {
    notify.error('重载失败')
  } finally {
    reloadAllLoading.value = false
  }
}

function statusColor(enabled: boolean): string {
  return enabled ? 'success' : 'grey'
}

onMounted(async () => {
  await fetchPlugins()
  loading.value = false
})
</script>

<template>
  <div>
    <!-- Header bar -->
    <v-card class="glass-card mb-4 pa-4">
      <div class="d-flex flex-wrap ga-3 align-center">
        <v-text-field
          v-model="search"
          label="搜索插件..."
          variant="outlined"
          density="compact"
          prepend-inner-icon="mdi-magnify"
          hide-details
          clearable
          style="max-width: 320px"
        />
        <v-spacer />
        <div class="d-flex align-center ga-2">
          <span class="text-caption text-medium-emphasis">
            {{ enabledCount }} / {{ plugins.length }} 已启用
          </span>
          <v-divider vertical length="24" class="mx-1" />
          <v-btn
            variant="tonal"
            color="primary"
            prepend-icon="mdi-refresh"
            :loading="reloadAllLoading"
            @click="reloadAll"
          >
            重载全部
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- Plugin Grid -->
    <v-fade-transition>
      <v-row v-if="!loading">
        <v-col
          v-for="(plugin, idx) in filteredPlugins"
          :key="plugin.authCode"
          cols="12"
          sm="6"
          lg="4"
          xl="3"
          :style="{ animationDelay: `${idx * 40}ms` }"
          class="plugin-col"
        >
          <v-card class="plugin-card glass-card" height="100%" :border="true">
            <!-- Status + Header -->
            <div class="pa-4 pb-0">
              <div class="d-flex align-center mb-3">
                <v-avatar :color="statusColor(plugin.enabled)" size="36" class="plugin-avatar">
                  <v-icon
                    :icon="plugin.enabled ? 'mdi-puzzle-check' : 'mdi-puzzle-outline'"
                    size="18"
                    color="white"
                  />
                </v-avatar>
                <div class="ml-3 flex-grow-1" style="min-width: 0">
                  <div class="text-body-2 font-weight-bold text-truncate">
                    {{ plugin.pluginName }}
                  </div>
                  <div class="text-caption text-medium-emphasis text-truncate">
                    {{ plugin.author }} · v{{ plugin.version }}
                  </div>
                </div>
                <v-btn
                  icon="mdi-dots-vertical"
                  variant="text"
                  size="x-small"
                  @click="openDetail(plugin)"
                />
              </div>

              <!-- Description -->
              <p
                v-if="plugin.description"
                class="text-caption text-medium-emphasis mb-3 line-clamp-2"
                style="min-height: 2.4em"
              >
                {{ plugin.description }}
              </p>

              <!-- AppId -->
              <div class="text-caption mb-3">
                <code class="appid-chip">{{ plugin.pluginId }}</code>
              </div>
            </div>

            <!-- Auth tags -->
            <div class="px-4" style="min-height: 52px;">
              <div v-if="plugin.auth.length" class="auth-scroll d-flex flex-wrap ga-1 mb-2">
                <span v-for="a in plugin.auth.slice(0, 10)" :key="a" class="auth-tag">{{
                  authLabel(a)
                }}</span>
                <span v-if="plugin.auth.length > 10" class="auth-tag auth-more">
                  +{{ plugin.auth.length - 10 }}
                </span>
              </div>
            </div>

            <v-spacer />

            <!-- Actions -->
            <div class="pa-3 pt-0">
              <v-divider class="mb-2" />
              <div class="d-flex ga-2 align-center">
                <v-btn
                  size="small"
                  variant="tonal"
                  :color="plugin.enabled ? 'warning' : 'success'"
                  :loading="actionLoading === plugin.authCode"
                  class="flex-grow-1"
                  height="32"
                  @click="togglePlugin(plugin)"
                >
                  {{ plugin.enabled ? '禁用' : '启用' }}
                </v-btn>
                <v-btn
                  v-if="plugin.enabled"
                  size="small"
                  variant="tonal"
                  color="primary"
                  icon="mdi-refresh"
                  height="32"
                  :loading="actionLoading === plugin.authCode"
                  class="flex-shrink-0"
                  @click="reloadOne(plugin)"
                />
              </div>
            </div>
          </v-card>
        </v-col>

        <!-- Empty -->
        <v-col v-if="filteredPlugins.length === 0" cols="12">
          <v-card class="glass-card pa-8 text-center">
            <v-icon icon="mdi-puzzle-outline" size="56" class="text-medium-emphasis mb-3" />
            <div class="text-h6 text-medium-emphasis mb-1">没有找到插件</div>
            <div class="text-caption text-medium-emphasis">尝试调整搜索条件</div>
          </v-card>
        </v-col>
      </v-row>
    </v-fade-transition>

    <!-- Skeleton -->
    <v-row v-if="loading">
      <v-col v-for="n in 8" :key="n" cols="12" sm="6" lg="4" xl="3">
        <v-skeleton-loader type="card, list-item-two-line, actions" class="glass-card" />
      </v-col>
    </v-row>

    <!-- Detail Dialog -->
    <v-dialog v-model="detailOpen" max-width="500" scrollable>
      <template v-if="detailLoading">
        <v-card class="pa-4">
          <v-skeleton-loader type="article, table-row@4" />
        </v-card>
      </template>

      <template v-else-if="detail">
        <v-card class="glass-card">
          <v-toolbar
            density="compact"
            color="transparent"
            class="px-4"
            style="height: 62px; justify-content: center"
          >
            <template #prepend>
              <v-avatar :color="detail.enabled ? 'success' : 'grey'" size="32">
                <v-icon
                  :icon="detail.enabled ? 'mdi-puzzle-check' : 'mdi-puzzle-outline'"
                  size="16"
                  color="white"
                />
              </v-avatar>
            </template>
            <v-toolbar-title class="text-body-1">{{ detail.pluginName }}</v-toolbar-title>
            <template #append>
              <v-btn icon="mdi-close" variant="text" size="small" @click="detailOpen = false" />
            </template>
          </v-toolbar>

          <v-divider />

          <v-card-text>
            <v-row density="compact" class="mb-2">
              <v-col cols="6">
                <div class="text-caption text-medium-emphasis">作者</div>
                <div class="text-body-2">{{ detail.author }}</div>
              </v-col>
              <v-col cols="6">
                <div class="text-caption text-medium-emphasis">版本</div>
                <div class="text-body-2">v{{ detail.version }}</div>
              </v-col>
              <v-col cols="6">
                <div class="text-caption text-medium-emphasis">插件类型</div>
                <div class="text-body-2">
                  {{ PluginTypeLabels[detail.pluginType] ?? `未知 (${detail.pluginType})` }}
                </div>
              </v-col>
            </v-row>

            <div class="mb-3">
              <div class="text-caption text-medium-emphasis">AppId</div>
              <code class="detail-code">{{ detail.pluginId }}</code>
            </div>

            <div v-if="detail.description" class="mb-3">
              <div class="text-caption text-medium-emphasis">描述</div>
              <div class="text-body-2">{{ detail.description }}</div>
            </div>

            <v-divider class="my-3" />

            <div class="d-flex align-center mb-2">
              <v-icon icon="mdi-shield-key" size="16" color="secondary" class="mr-1" />
              <span class="text-body-2 font-weight-bold">
                权限 ({{ detail.auth?.length || 0 }})
              </span>
            </div>
            <div class="d-flex flex-wrap ga-1">
              <span v-for="a in detail.auth" :key="a" class="auth-tag">{{ authLabel(a) }}</span>
            </div>
          </v-card-text>
        </v-card>
      </template>
    </v-dialog>
  </div>
</template>

<style scoped>
.plugin-card {
  transition:
    transform 0.2s var(--transition-smooth),
    box-shadow 0.2s var(--transition-smooth);
  border-color: rgba(var(--v-theme-on-surface), 0.06) !important;
}
.plugin-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2) !important;
  border-color: rgba(var(--v-theme-primary), 0.3) !important;
}

.plugin-avatar {
  flex-shrink: 0;
  transition: transform 0.3s var(--transition-spring);
}
.plugin-card:hover .plugin-avatar {
  transform: scale(1.1);
}

.appid-chip {
  font-family: 'Noto Sans Mono', monospace;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: rgba(var(--v-theme-on-surface), 0.6);
  word-break: break-all;
}

.auth-tag {
  display: inline-block;
  font-family: 'Noto Sans Mono', monospace;
  font-size: 0.65rem;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(var(--v-theme-primary), 0.08);
  color: rgba(var(--v-theme-primary), 0.9);
  letter-spacing: 0.02em;
}

.auth-tag.auth-more {
  background: transparent;
  color: rgba(var(--v-theme-on-surface), 0.4);
}

.auth-scroll {
  max-height: 60px;
  overflow-y: auto;
}

.detail-code {
  font-family: 'Noto Sans Mono', monospace;
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  display: inline-block;
  margin-top: 2px;
  word-break: break-all;
  max-width: 100%;
}

.event-row {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.04);
}
.event-row:last-child {
  border-bottom: none;
}

.plugin-col {
  animation: pluginFadeIn 0.4s var(--transition-smooth) both;
}

@keyframes pluginFadeIn {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
