<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useNotifyStore } from '@/stores/notify'
import { useHubStore } from '@/stores/hub'
import {
  getPluginList,
  getPluginInfo,
  enablePlugin,
  disablePlugin,
  reloadPlugin,
  reloadAllPlugins,
  addPlugin,
  callPluginMenu,
} from '@/api/plugin'
import {
  type PluginDto,
  type PluginDetail,
  type PluginChangedPayload,
  PluginTypeLabels,
  authLabel,
} from '@/models'
import { SignalREvents } from '@/signalr/events'
import { getErrorMessage } from '@/api/client'

const app = useAppStore()
const notify = useNotifyStore()
const hub = useHubStore()
app.setPageTitle('插件管理')

const plugins = ref<PluginDto[]>([])
const search = ref('')
const loading = ref(true)
const actionLoading = ref<number | null>(null)
const reloadAllLoading = ref(false)

const confirmReloadPlugin = ref<PluginDto | null>(null)
const confirmReloadAll = ref(false)
const confirmMenuPlugin = ref<PluginDetail | null>(null)
const confirmMenuName = ref('')

// ── Sort ──
type SortKey = 'enabled' | 'name' | 'author'
const sortKey = ref<SortKey>('enabled')
const sortDesc = ref(false)

const sortOptions: { value: SortKey; title: string }[] = [
  { value: 'enabled', title: '启用状态' },
  { value: 'name', title: '插件名称' },
  { value: 'author', title: '插件作者' },
]

// ── Add plugin ──
const addOpen = ref(false)
const addDll = ref<File | null>(null)
const addJson = ref<File | null>(null)
const addUploading = ref(false)
const addError = ref('')
const addMeta = ref<{
  pluginName?: string
  author?: string
  version?: string
  description?: string
} | null>(null)
const dragDll = ref(false)
const dragJson = ref(false)

function acceptFile(file: File, ext: string): boolean {
  return file.name.toLowerCase().endsWith(ext)
}

function routeDroppedFiles(files: FileList | File[] | null) {
  if (!files || addUploading.value) return
  const list = Array.from(files)
  const dll = list.find((f) => acceptFile(f, '.dll')) || null
  const json = list.find((f) => acceptFile(f, '.json')) || null
  if (dll) onDllChange(dll)
  if (json) onJsonChange(json)
}

function onDrop(e: DragEvent) {
  dragDll.value = false
  dragJson.value = false
  e.preventDefault()
  routeDroppedFiles(e.dataTransfer?.files ?? null)
}

function dragOver(e: DragEvent) {
  e.preventDefault()
  if (addUploading.value) return
  dragDll.value = true
  dragJson.value = true
}

function dragLeave() {
  dragDll.value = false
  dragJson.value = false
}

function baseName(f: File) {
  return f.name.replace(/\.[^.]+$/, '')
}

function onDllChange(files: File | File[] | null) {
  const file = Array.isArray(files) ? files[0] : files
  addDll.value = file ?? null
  addError.value = ''
}

async function onJsonChange(files: File | File[] | null) {
  const file = Array.isArray(files) ? files[0] : files
  addJson.value = file ?? null
  addError.value = ''
  addMeta.value = null
  if (!file) return
  try {
    const text = await file.text()
    const obj = JSON.parse(text)
    addMeta.value = {
      pluginName: obj?.pluginName || obj?.name,
      author: obj?.author,
      version: obj?.version,
      description: obj?.description,
    }
  } catch {
    addError.value = 'JSON 文件格式无效'
  }
}

function validateFiles(): boolean {
  if (!addDll.value || !addJson.value) {
    addError.value = '请选择 DLL 文件和 JSON 文件'
    return false
  }
  if (baseName(addDll.value) !== baseName(addJson.value)) {
    addError.value = 'DLL 与 JSON 文件名必须一致'
    return false
  }
  return true
}

async function doAdd() {
  if (!validateFiles()) return
  addUploading.value = true
  addError.value = ''
  try {
    const res = await addPlugin(addDll.value!, addJson.value!)
    if (res.data.code === 0) {
      const name = res.data.data.plugin?.pluginName || '插件'
      notify.success(
        res.data.data.existed ? `${name} 添加成功，重载插件来使插件更新` : `${name} 已添加`,
      )
      addOpen.value = false
      addDll.value = null
      addJson.value = null
      addMeta.value = null
      await fetchPlugins()
    } else {
      addError.value = res.data.message || '添加失败'
    }
  } catch (e) {
    addError.value = getErrorMessage(e, '上传失败，请检查网络连接')
  } finally {
    addUploading.value = false
  }
}

function closeAdd() {
  if (addUploading.value) return
  addOpen.value = false
  addDll.value = null
  addJson.value = null
  addMeta.value = null
  addError.value = ''
}

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

const sortedPlugins = computed(() => {
  const list = [...filteredPlugins.value]
  const dir = sortDesc.value ? -1 : 1
  list.sort((a, b) => {
    if (sortKey.value === 'enabled') {
      return (Number(b.enabled) - Number(a.enabled)) * dir
    }
    if (sortKey.value === 'name') {
      return a.pluginName.localeCompare(b.pluginName) * dir
    }
    // author
    return a.author.localeCompare(b.author) * dir
  })
  return list
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
    syncDetail()
  } finally {
    actionLoading.value = null
  }
}

function reloadOneBtn(plugin: PluginDto) {
  confirmReloadPlugin.value = plugin
}

function toggleDetail(plugin: PluginDto) {
  togglePlugin(plugin)
}

function reloadDetail(plugin: PluginDto) {
  reloadOneBtn(plugin)
}

// Keep detail in sync when plugins list changes
function syncDetail() {
  if (!detail.value) return
  const updated = plugins.value.find((p) => p.authCode === detail.value!.authCode)
  if (updated) detail.value = { ...detail.value, ...updated }
}

async function doReloadOne() {
  const plugin = confirmReloadPlugin.value
  if (!plugin) return
  confirmReloadPlugin.value = null
  actionLoading.value = plugin.authCode
  try {
    await reloadPlugin(plugin.authCode)
    await fetchPlugins()
    syncDetail()
    notify.success(`${plugin.pluginName} 已重载`)
  } catch {
    notify.error('重载失败')
  } finally {
    actionLoading.value = null
  }
}

function reloadAllBtn() {
  confirmReloadAll.value = true
}

async function doReloadAll() {
  confirmReloadAll.value = false
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

function menuBtnClick(plugin: PluginDetail, name: string) {
  confirmMenuPlugin.value = plugin
  confirmMenuName.value = name
}

async function doCallMenu() {
  const plugin = confirmMenuPlugin.value
  const name = confirmMenuName.value
  confirmMenuPlugin.value = null
  confirmMenuName.value = ''
  if (!plugin) return
  try {
    const res = await callPluginMenu(plugin.authCode, name)
    if (res.data.code === 0) {
      notify.success(`菜单 "${name}" 已调用`)
    } else {
      notify.error(res.data.message || '调用失败')
    }
  } catch {
    notify.error('调用失败')
  }
}

function statusColor(enabled: boolean): string {
  return enabled ? 'success' : 'grey'
}

// ── SignalR: 按 authCode 去重更新或追加 ──────────────────────

function upsertPlugin(plugin: PluginDto) {
  const idx = plugins.value.findIndex((p) => p.authCode === plugin.authCode)
  if (idx >= 0) {
    plugins.value[idx] = plugin
  } else {
    plugins.value.push(plugin)
  }
}

function onPluginEnableChanged(data: PluginChangedPayload) {
  upsertPlugin(data.plugin)
}

function onPluginConnectStatusChanged(data: PluginChangedPayload) {
  upsertPlugin(data.plugin)
}

function onPluginAdded(data: PluginChangedPayload) {
  upsertPlugin(data.plugin)
}

function onPluginRemoved(data: PluginChangedPayload) {
  plugins.value = plugins.value.filter((p) => p.authCode !== data.plugin.authCode)
}

onMounted(async () => {
  hub.on(SignalREvents.PluginEnableChanged, onPluginEnableChanged)
  hub.on(SignalREvents.PluginConnectStatusChanged, onPluginConnectStatusChanged)
  hub.on(SignalREvents.PluginAdded, onPluginAdded)
  hub.on(SignalREvents.PluginRemoved, onPluginRemoved)
  await fetchPlugins()
  loading.value = false
})

onUnmounted(() => {
  hub.off(SignalREvents.PluginEnableChanged, onPluginEnableChanged)
  hub.off(SignalREvents.PluginConnectStatusChanged, onPluginConnectStatusChanged)
  hub.off(SignalREvents.PluginAdded, onPluginAdded)
  hub.off(SignalREvents.PluginRemoved, onPluginRemoved)
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
        <v-select
          v-model="sortKey"
          :items="sortOptions"
          label="排序"
          variant="outlined"
          density="compact"
          hide-details
          style="max-width: 140px"
        />
        <v-btn
          :icon="sortDesc ? 'mdi-sort-descending' : 'mdi-sort-ascending'"
          variant="text"
          size="small"
          @click="sortDesc = !sortDesc"
        />
        <v-spacer />
        <div class="d-flex align-center ga-2">
          <span class="text-caption text-medium-emphasis">
            {{ enabledCount }} / {{ plugins.length }} 已启用
          </span>
          <v-divider vertical length="24" class="mx-1" />
          <v-btn variant="tonal" color="success" prepend-icon="mdi-plus" @click="addOpen = true">
            添加插件
          </v-btn>
          <v-btn
            variant="tonal"
            color="primary"
            prepend-icon="mdi-refresh"
            :loading="reloadAllLoading"
            @click="reloadAllBtn"
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
          v-for="(plugin, idx) in sortedPlugins"
          :key="plugin.authCode"
          cols="12"
          sm="6"
          lg="4"
          xl="3"
          :style="{ animationDelay: `${idx * 40}ms` }"
          class="plugin-col"
        >
          <v-card class="plugin-card glass-card d-flex flex-column" height="100%" :border="true">
            <!-- Status + Header -->
            <div class="pa-4 pb-0" style="flex-shrink: 0">
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
              <div
                v-if="plugin.description"
                class="text-caption text-medium-emphasis mb-3 line-clamp-2 description-text"
                style="height: 3em"
              >
                {{ plugin.description }}
                <v-tooltip activator="parent" location="top" max-width="320">
                  {{ plugin.description }}
                </v-tooltip>
              </div>
              <div v-else class="text-caption text-medium-emphasis mb-3" style="height: 3em">
                &nbsp;
              </div>

              <!-- AppId -->
              <div class="text-caption mb-3">
                <code class="appid-chip">{{ plugin.pluginId }}</code>
              </div>
            </div>

            <!-- Auth tags -->
            <div class="px-4" style="height: 66px; flex-shrink: 0">
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
            <div class="pa-3 pt-0" style="flex-shrink: 0">
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
                  @click="reloadOneBtn(plugin)"
                />
              </div>
            </div>
          </v-card>
        </v-col>

        <!-- Empty -->
        <v-col v-if="sortedPlugins.length === 0" cols="12">
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

          <v-divider />
          <v-card-actions class="pa-3">
            <v-btn
              variant="tonal"
              :color="detail.enabled ? 'warning' : 'success'"
              size="small"
              @click="toggleDetail(detail)"
            >
              {{ detail.enabled ? '禁用' : '启用' }}
            </v-btn>

            <template v-if="detail.enabled">
              <!-- Menu split -->
              <v-menu location="top">
                <template #activator="{ props: menuProps }">
                  <v-btn
                    style="padding: 0 10px"
                    variant="tonal"
                    color="secondary"
                    size="small"
                    v-bind="menuProps"
                  >
                    菜单
                    <!-- <v-icon icon="mdi-menu-down" size="16" class="ml-1" /> -->
                  </v-btn>
                </template>
                <v-list v-if="detail.menu?.length" density="compact">
                  <v-list-item
                    v-for="m in detail.menu"
                    :key="m"
                    :title="m"
                    @click="menuBtnClick(detail, m)"
                  />
                </v-list>
                <v-list v-else density="compact">
                  <v-list-item disabled title="暂无菜单" />
                </v-list>
              </v-menu>

              <!-- Reload -->
              <v-btn
                variant="tonal"
                color="primary"
                size="small"
                style="padding: 0 10px"
                @click="reloadDetail(detail)"
              >
                重载
              </v-btn>
            </template>
            <v-spacer />
            <v-btn variant="text" size="small" @click="detailOpen = false">关闭</v-btn>
          </v-card-actions>
        </v-card>
      </template>
    </v-dialog>

    <!-- Add Plugin Dialog -->
    <v-dialog
      v-model="addOpen"
      max-width="480"
      :persistent="addUploading"
      @click:outside="closeAdd"
    >
      <v-card class="glass-card">
        <v-toolbar density="compact" color="transparent" class="px-4">
          <template #prepend>
            <v-icon icon="mdi-puzzle-plus" size="22" color="primary" />
          </template>
          <v-toolbar-title class="text-body-1">添加插件</v-toolbar-title>
          <template #append>
            <v-btn
              icon="mdi-close"
              variant="text"
              size="small"
              :disabled="addUploading"
              @click="closeAdd"
            />
          </template>
        </v-toolbar>

        <v-divider />

        <v-card-text class="pt-4">
          <v-alert
            v-if="addError"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-3"
            closable
          >
            {{ addError }}
          </v-alert>

          <div class="d-flex ga-4">
            <!-- DLL drop zone -->
            <label
              class="drop-zone flex-grow-1"
              :class="{ 'drop-zone--drag': dragDll, 'drop-zone--done': !!addDll }"
              @dragover="dragOver($event)"
              @dragleave="dragLeave()"
              @drop="onDrop($event)"
            >
              <input
                type="file"
                accept=".dll"
                class="drop-input"
                :disabled="addUploading"
                @change="
                  (e: Event) => {
                    const t = e.target as HTMLInputElement
                    onDllChange(t.files?.[0] ?? null)
                  }
                "
              />
              <template v-if="addDll">
                <v-icon icon="mdi-file-code-outline" size="22" color="primary" class="mb-1" />
                <span class="drop-filename">{{ addDll.name }}</span>
              </template>
              <template v-else>
                <v-icon
                  icon="mdi-file-upload-outline"
                  size="24"
                  class="text-medium-emphasis mb-1"
                />
                <span class="drop-label">DLL 文件</span>
                <span class="drop-hint">拖拽或点击选择</span>
              </template>
            </label>

            <!-- JSON drop zone -->
            <label
              class="drop-zone flex-grow-1"
              :class="{ 'drop-zone--drag': dragJson, 'drop-zone--done': !!addJson }"
              @dragover="dragOver($event)"
              @dragleave="dragLeave()"
              @drop="onDrop($event)"
            >
              <input
                type="file"
                accept=".json"
                class="drop-input"
                :disabled="addUploading"
                @change="
                  (e: Event) => {
                    const t = e.target as HTMLInputElement
                    onJsonChange(t.files?.[0] ?? null)
                  }
                "
              />
              <template v-if="addJson">
                <v-icon icon="mdi-code-json" size="22" color="primary" class="mb-1" />
                <span class="drop-filename">{{ addJson.name }}</span>
              </template>
              <template v-else>
                <v-icon
                  icon="mdi-file-upload-outline"
                  size="24"
                  class="text-medium-emphasis mb-1"
                />
                <span class="drop-label">JSON 清单</span>
                <span class="drop-hint">拖拽或点击选择</span>
              </template>
            </label>
          </div>

          <div class="text-caption text-medium-emphasis mt-2">
            DLL 与 JSON 文件名必须一致（如 Plugin.dll + Plugin.json）
          </div>

          <!-- JSON preview -->
          <v-card
            v-if="addMeta"
            variant="flat"
            class="mt-3 pa-3"
            style="background: rgba(var(--v-theme-on-surface), 0.03)"
          >
            <div class="text-caption text-medium-emphasis mb-2">解析的元数据</div>
            <v-row density="compact">
              <v-col v-if="addMeta.pluginName" cols="6">
                <span class="text-caption text-medium-emphasis">名称</span>
                <div class="text-body-2">{{ addMeta.pluginName }}</div>
              </v-col>
              <v-col v-if="addMeta.author" cols="6">
                <span class="text-caption text-medium-emphasis">作者</span>
                <div class="text-body-2">{{ addMeta.author }}</div>
              </v-col>
              <v-col v-if="addMeta.version" cols="6">
                <span class="text-caption text-medium-emphasis">版本</span>
                <div class="text-body-2">v{{ addMeta.version }}</div>
              </v-col>
            </v-row>
            <div v-if="addMeta.description" class="mt-2">
              <span class="text-caption text-medium-emphasis">描述</span>
              <div class="text-body-2">{{ addMeta.description }}</div>
            </div>
          </v-card>
        </v-card-text>

        <v-divider />
        <v-card-actions class="pa-3">
          <v-spacer />
          <v-btn variant="text" :disabled="addUploading" @click="closeAdd">取消</v-btn>
          <v-btn
            variant="tonal"
            color="success"
            style="padding: 0 15px"
            prepend-icon="mdi-upload"
            :loading="addUploading"
            @click="doAdd"
          >
            上传
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Confirm: Reload single plugin -->
    <v-dialog v-model="confirmReloadPlugin" max-width="400" persistent>
      <v-card>
        <v-card-title class="text-body-1">确认重载</v-card-title>
        <v-card-text>
          确定要重载插件
          <strong>{{ confirmReloadPlugin?.pluginName }}</strong> 吗？插件将被卸载后重新加载。
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmReloadPlugin = null">取消</v-btn>
          <v-btn variant="tonal" color="primary" @click="doReloadOne">确认</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Confirm: Reload all plugins -->
    <v-dialog v-model="confirmReloadAll" max-width="400" persistent>
      <v-card>
        <v-card-title class="text-body-1">确认重载全部</v-card-title>
        <v-card-text> 确定要重载全部插件吗？所有插件将被卸载后重新加载。 </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmReloadAll = false">取消</v-btn>
          <v-btn variant="tonal" color="primary" @click="doReloadAll">确认</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Confirm: Call plugin menu -->
    <v-dialog v-model="confirmMenuPlugin" max-width="400" persistent>
      <v-card>
        <v-card-title class="text-body-1">确认调用菜单</v-card-title>
        <v-card-text>
          WebUI 不会显示弹出的菜单，请确认是否继续调用菜单
          <strong>"{{ confirmMenuName }}"</strong>？
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmMenuPlugin = null">取消</v-btn>
          <v-btn variant="tonal" color="primary" @click="doCallMenu">确认调用</v-btn>
        </v-card-actions>
      </v-card>
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

/* ── Drop zones ── */
.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 110px;
  padding: 16px 12px;
  border: 2px dashed rgba(var(--v-theme-on-surface), 0.22);
  border-radius: 10px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s;
  position: relative;
}
.drop-zone:hover {
  border-color: rgba(var(--v-theme-primary), 0.4);
  background: rgba(var(--v-theme-primary), 0.03);
}
.drop-zone--drag {
  border-color: rgb(var(--v-theme-primary)) !important;
  background: rgba(var(--v-theme-primary), 0.08) !important;
}
.drop-zone--done {
  border-style: solid;
  border-color: rgba(var(--v-theme-success), 0.5);
  background: rgba(var(--v-theme-success), 0.04);
}
.drop-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
}
.drop-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.drop-hint {
  font-size: 0.68rem;
  color: rgba(var(--v-theme-on-surface), 0.35);
  margin-top: 2px;
}
.drop-filename {
  font-size: 0.78rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.8);
  word-break: break-all;
  text-align: center;
  line-height: 1.3;
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

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
