<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { getPluginList, getPluginInfo, enablePlugin, disablePlugin, reloadPlugin, reloadAllPlugins } from '@/api/plugin'
import type { PluginDto, PluginDetail } from '@/models'

const app = useAppStore()
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

onMounted(async () => {
  await fetchPlugins()
  loading.value = false
})
</script>

<template>
  <div>
    <!-- Top bar -->
    <div class="d-flex align-center mb-4 ga-3">
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
      <v-btn
        color="primary"
        variant="tonal"
        prepend-icon="mdi-refresh"
        :loading="reloadAllLoading"
        @click="async () => {
          reloadAllLoading = true
          try {
            const res = await reloadAllPlugins()
            if (res.data.code === 0) {
              plugins.value = res.data.data
            }
          } finally {
            reloadAllLoading = false
          }
        }"
      >
        重载全部
      </v-btn>
    </div>

    <!-- Plugin Cards Grid -->
    <v-fade-transition>
      <v-row v-if="!loading">
        <v-col
          v-for="plugin in filteredPlugins"
          :key="plugin.authCode"
          cols="12"
          sm="6"
          lg="4"
          xl="3"
        >
          <v-card class="glass-card pa-4" height="100%">
            <div class="d-flex align-center ga-2 mb-3">
              <v-avatar
                :color="plugin.enabled ? 'success' : 'grey'"
                size="10"
              />
              <span class="text-caption text-medium-emphasis">
                {{ plugin.enabled ? '已启用' : '已禁用' }}
              </span>
              <v-spacer />
              <v-tooltip text="查看详情">
                <template #activator="{ props: tipProps }">
                  <v-btn
                    v-bind="tipProps"
                    icon="mdi-information-outline"
                    size="x-small"
                    variant="text"
                    @click="async () => {
                      detailOpen = true
                      detailLoading = true
                      try {
                        const res = await getPluginInfo(plugin.authCode)
                        if (res.data.code === 0) detail = res.data.data
                      } finally {
                        detailLoading = false
                      }
                    }"
                  />
                </template>
              </v-tooltip>
            </div>

            <v-card-title class="pa-0 text-body-1 font-weight-bold">
              {{ plugin.pluginName }}
            </v-card-title>
            <v-card-subtitle class="pa-0 text-caption">
              {{ plugin.author }} · v{{ plugin.version }}
            </v-card-subtitle>
            <p class="text-caption text-medium-emphasis mt-2 mb-3 line-clamp-2">
              {{ plugin.description }}
            </p>

            <div class="text-caption text-medium-emphasis mb-3">
              AppId: <code>{{ plugin.pluginId }}</code>
            </div>

            <!-- Auth tags -->
            <div class="d-flex flex-wrap ga-1 mb-3" v-if="plugin.auth.length">
              <v-chip
                v-for="a in plugin.auth.slice(0, 8)"
                :key="a"
                size="x-small"
                variant="tonal"
                color="secondary"
              >
                {{ a }}
              </v-chip>
              <v-chip v-if="plugin.auth.length > 8" size="x-small" variant="text">
                +{{ plugin.auth.length - 8 }}
              </v-chip>
            </div>

            <!-- Actions -->
            <div class="d-flex ga-2 mt-auto">
              <v-btn
                v-if="plugin.enabled"
                block
                size="small"
                variant="tonal"
                color="warning"
                :loading="actionLoading === plugin.authCode"
                @click="async () => {
                  actionLoading = plugin.authCode
                  try {
                    await disablePlugin(plugin.authCode)
                    await fetchPlugins()
                  } finally { actionLoading = null }
                }"
              >
                禁用
              </v-btn>
              <v-btn
                v-else
                block
                size="small"
                variant="tonal"
                color="success"
                :loading="actionLoading === plugin.authCode"
                @click="async () => {
                  actionLoading = plugin.authCode
                  try {
                    await enablePlugin(plugin.authCode)
                    await fetchPlugins()
                  } finally { actionLoading = null }
                }"
              >
                启用
              </v-btn>
              <v-btn
                v-if="plugin.enabled"
                size="small"
                variant="tonal"
                color="primary"
                icon="mdi-refresh"
                :loading="actionLoading === plugin.authCode"
                @click="async () => {
                  actionLoading = plugin.authCode
                  try {
                    await reloadPlugin(plugin.authCode)
                    await fetchPlugins()
                  } finally { actionLoading = null }
                }"
              />
            </div>
          </v-card>
        </v-col>

        <!-- Empty state -->
        <v-col v-if="filteredPlugins.length === 0" cols="12">
          <v-card class="glass-card pa-8 text-center">
            <v-icon icon="mdi-puzzle-outline" size="48" class="text-medium-emphasis mb-2" />
            <div class="text-body-1 text-medium-emphasis">没有找到插件</div>
          </v-card>
        </v-col>
      </v-row>
    </v-fade-transition>

    <!-- Loading skeleton -->
    <v-row v-if="loading">
      <v-col v-for="n in 6" :key="n" cols="12" sm="6" lg="4" xl="3">
        <v-skeleton-loader type="card" class="glass-card" />
      </v-col>
    </v-row>

    <!-- Plugin Detail Panel -->
    <v-navigation-drawer v-model="detailOpen" location="right" width="400" temporary>
      <template v-if="detailLoading">
        <v-skeleton-loader type="article" class="pa-4" />
      </template>
      <template v-else-if="detail">
        <v-toolbar color="transparent">
          <v-toolbar-title>{{ detail.name }}</v-toolbar-title>
        </v-toolbar>
        <v-divider />
        <v-card-text>
          <div class="mb-3">
            <div class="text-caption text-medium-emphasis">作者</div>
            <div>{{ detail.author }}</div>
          </div>
          <div class="mb-3">
            <div class="text-caption text-medium-emphasis">版本</div>
            <div>v{{ detail.version }} (ID: {{ detail.version_id }})</div>
          </div>
          <div class="mb-3">
            <div class="text-caption text-medium-emphasis">AppId</div>
            <code>{{ detail.appId }}</code>
          </div>
          <div class="mb-3">
            <div class="text-caption text-medium-emphasis">Loader</div>
            <div>{{ detail.loaderType === 0 ? 'Native/C#' : `类型 ${detail.loaderType}` }}</div>
          </div>
          <div class="mb-3">
            <div class="text-caption text-medium-emphasis">API 版本</div>
            <div>{{ detail.apiver }}</div>
          </div>
          <div class="mb-3">
            <div class="text-caption text-medium-emphasis">描述</div>
            <div>{{ detail.description }}</div>
          </div>

          <v-divider class="my-3" />

          <!-- Events -->
          <div class="text-body-2 font-weight-bold mb-2">
            事件处理 ({{ detail._event?.length || 0 }})
          </div>
          <v-table v-if="detail._event?.length" density="compact">
            <thead>
              <tr>
                <th>事件</th>
                <th>函数</th>
                <th>优先级</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="evt in detail._event" :key="evt.id">
                <td>{{ evt.name }}</td>
                <td><code class="text-caption">{{ evt.function }}</code></td>
                <td>{{ evt.priority }}</td>
              </tr>
            </tbody>
          </v-table>
          <div v-else class="text-caption text-medium-emphasis">无事件处理函数</div>

          <!-- Auth list -->
          <v-divider class="my-3" />
          <div class="text-body-2 font-weight-bold mb-2">
            权限列表 ({{ detail.auth?.length || 0 }})
          </div>
          <div class="d-flex flex-wrap ga-1">
            <v-chip
              v-for="a in detail.auth"
              :key="a"
              size="x-small"
              variant="tonal"
              color="secondary"
            >
              {{ a }}
            </v-chip>
          </div>
        </v-card-text>
      </template>
    </v-navigation-drawer>
  </div>
</template>
