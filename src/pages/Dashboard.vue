<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'

import AnimatedCounter from '@/components/AnimatedCounter.vue'
import CpuMemoryRing from '@/components/CpuMemoryRing.vue'
import { getBaseInformation, getPluginUsages, getUsages } from '@/api/dashboard'
import { getCurrentProtocol } from '@/api/protocol'
import { disablePlugin, reloadPlugin } from '@/api/plugin'
import type {
  DashboardInfoData,
  DashboardPluginItem,
  PluginUsageData,
  ProtocolStatusData,
  UsageData,
} from '@/models'
import { useAppStore } from '@/stores/app'
import { useNotifyStore } from '@/stores/notify'

const app = useAppStore()
const notify = useNotifyStore()
app.setPageTitle('仪表盘')

const info = ref<DashboardInfoData | null>(null)
const usage = ref<UsageData | null>(null)
const pluginUsage = ref<PluginUsageData | null>(null)
const currentProtocol = ref<ProtocolStatusData | null>(null)
const loading = ref(true)
const loadError = ref('')
const startedSeconds = ref(0)
const nowTick = ref(0)

type SortKey = 'name' | 'pid' | 'cpu' | 'mem'
const sortKey = ref<SortKey>('mem')
const sortDir = ref<'asc' | 'desc'>('desc')

const disablingIds: Set<number> = reactive(new Set<number>())
const reloadingIds: Set<number> = reactive(new Set<number>())

let refreshTimer: ReturnType<typeof setInterval>
let tickTimer: ReturnType<typeof setInterval>

function parseStartedTime(raw: string): number {
  if (!raw) return 0
  const parts = raw.split(':')
  if (parts.length === 4) {
    const [d, h, m, s] = parts
    return Number(d) * 86400 + Number(h) * 3600 + Number(m) * 60 + Number(s)
  }
  // Fallback: HH:MM:SS
  const [h = '0', m = '0', s = '0'] = parts
  return Number(h) * 3600 + Number(m) * 60 + Number(s)
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatMemory(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${Math.round(mb)} MB`
}

function getProcessName(item: DashboardPluginItem) {
  if (item.pluginName?.trim()) return item.pluginName
  return item.id === 0 ? '主框架' : `进程 #${item.pid}`
}

function getProcessShare(value: number, total: number) {
  if (total <= 0) return 0
  return Math.min((value / total) * 100, 100)
}

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortKey.value = key
    sortDir.value = 'desc'
  }
}

async function handleDisable(item: DashboardPluginItem) {
  disablingIds.add(item.id)
  try {
    const res = await disablePlugin(item.id)
    if (res.data.code === 0) {
      notify.success(`已禁用 ${getProcessName(item)}`)
      await fetchData()
    } else {
      notify.error(res.data.message ?? '禁用失败')
    }
  } catch {
    notify.error('操作失败，请检查网络连接')
  } finally {
    disablingIds.delete(item.id)
  }
}

async function handleReload(item: DashboardPluginItem) {
  reloadingIds.add(item.id)
  try {
    const res = await reloadPlugin(item.id)
    if (res.data.code === 0) {
      notify.success(`已重载 ${getProcessName(item)}`)
      await fetchData()
    } else {
      notify.error(res.data.message ?? '重载失败')
    }
  } catch {
    notify.error('操作失败，请检查网络连接')
  } finally {
    reloadingIds.delete(item.id)
  }
}

const uptime = computed(() => {
  const total = startedSeconds.value + nowTick.value
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const parts: string[] = []
  if (d > 0) parts.push(`${pad2(d)}d`)
  if (h > 0 || d > 0) parts.push(`${pad2(h)}h`)
  if (m > 0 || h > 0 || d > 0) parts.push(`${pad2(m)}m`)
  parts.push(`${pad2(s)}s`)
  return parts.join(' ')
})

const sortedProcessItems = computed(() => {
  if (!pluginUsage.value) return []
  return [...pluginUsage.value.pluginUsages].sort((a, b) => {
    if (sortKey.value === 'name') {
      const av = getProcessName(a)
      const bv = getProcessName(b)
      return sortDir.value === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    if (sortKey.value === 'pid') {
      return sortDir.value === 'asc' ? a.pid - b.pid : b.pid - a.pid
    }
    if (sortKey.value === 'cpu') {
      return sortDir.value === 'asc' ? a.cpuUsage - b.cpuUsage : b.cpuUsage - a.cpuUsage
    }
    return sortDir.value === 'asc' ? a.memoryUsage - b.memoryUsage : b.memoryUsage - a.memoryUsage
  })
})

async function fetchData() {
  try {
    const [infoR, usageR, pluginR, protoR] = await Promise.allSettled([
      getBaseInformation(),
      getUsages(),
      getPluginUsages(),
      getCurrentProtocol(),
    ])

    let ok = false

    if (infoR.status === 'fulfilled' && infoR.value.data.code === 0) {
      info.value = infoR.value.data.data
      startedSeconds.value = parseStartedTime(info.value.startedTime)
      ok = true
    }
    if (usageR.status === 'fulfilled' && usageR.value.data.code === 0) {
      usage.value = usageR.value.data.data
      ok = true
    }
    if (pluginR.status === 'fulfilled' && pluginR.value.data.code === 0) {
      pluginUsage.value = pluginR.value.data.data
      ok = true
    }
    if (protoR.status === 'fulfilled' && protoR.value.data.code === 0) {
      currentProtocol.value = protoR.value.data.data
    }

    loadError.value = ok ? '' : '暂时无法获取仪表盘数据'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
  refreshTimer = setInterval(fetchData, 5000)
  tickTimer = setInterval(() => {
    nowTick.value++
  }, 1000)
})

onUnmounted(() => {
  clearInterval(refreshTimer)
  clearInterval(tickTimer)
})
</script>

<template>
  <div>
    <v-alert
      v-if="loadError && !loading"
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      {{ loadError }}
    </v-alert>

    <!-- Loading skeletons -->
    <template v-if="loading">
      <v-row>
        <v-col v-for="n in 6" :key="n" cols="12" sm="6" md="4" lg="2">
          <v-skeleton-loader type="card" class="glass-card" height="116" />
        </v-col>
      </v-row>
      <v-row class="mt-4">
        <v-col cols="12" md="8">
          <v-skeleton-loader type="article" class="glass-card" height="300" />
        </v-col>
        <v-col cols="12" md="4">
          <v-skeleton-loader type="article" class="glass-card" height="300" />
        </v-col>
      </v-row>
      <v-row class="mt-4">
        <v-col cols="12">
          <v-skeleton-loader type="table-row@4" class="glass-card pa-4" />
        </v-col>
      </v-row>
    </template>

    <template v-else-if="info">
      <!-- ── Row 1: 6 stat tiles ── -->
      <v-row>
        <!-- Bot QQ -->
        <v-col cols="12" sm="6" md="4" lg="2">
          <v-card class="glass-card stat-tile" height="100%">
            <div class="tile-head">
              <v-avatar color="primary" variant="tonal" rounded="lg" size="36">
                <v-icon icon="mdi-robot-outline" size="18" />
              </v-avatar>
              <span class="tile-label">Bot QQ</span>
              <v-spacer />
              <span
                class="tile-dot"
                :class="info.currentBotQQ ? 'tile-dot--on' : 'tile-dot--off'"
              />
            </div>
            <div class="tile-value mt-3">
              <span v-if="info.currentBotQQ">{{ info.currentBotQQ }}</span>
              <span v-else class="tile-value--muted">未登录</span>
            </div>
            <div class="tile-sub">{{ info.currentBotNick || '—' }}</div>
          </v-card>
        </v-col>

        <!-- Uptime -->
        <v-col cols="12" sm="6" md="4" lg="2">
          <v-card class="glass-card stat-tile" height="100%">
            <div class="tile-head">
              <v-avatar color="success" variant="tonal" rounded="lg" size="36">
                <v-icon icon="mdi-clock-outline" size="18" />
              </v-avatar>
              <span class="tile-label">运行时长</span>
            </div>
            <div class="tile-value tile-value--mono mt-3">{{ uptime }}</div>
          </v-card>
        </v-col>

        <!-- Plugins -->
        <v-col cols="12" sm="6" md="4" lg="2">
          <v-card class="glass-card stat-tile" height="100%">
            <div class="tile-head">
              <v-avatar color="warning" variant="tonal" rounded="lg" size="36">
                <v-icon icon="mdi-puzzle-outline" size="18" />
              </v-avatar>
              <span class="tile-label">已启用插件</span>
            </div>
            <div class="tile-value mt-3">
              <AnimatedCounter :target="info.loadedPluginCount" />
            </div>
          </v-card>
        </v-col>

        <!-- Today processed -->
        <v-col cols="12" sm="6" md="4" lg="2">
          <v-card class="glass-card stat-tile" height="100%">
            <div class="tile-head">
              <v-avatar color="info" variant="tonal" rounded="lg" size="36">
                <v-icon icon="mdi-message-arrow-right-outline" size="18" />
              </v-avatar>
              <span class="tile-label">已处理消息</span>
            </div>
            <div class="tile-value mt-3">
              <AnimatedCounter :target="pluginUsage?.processedMessageCount ?? 0" />
            </div>
          </v-card>
        </v-col>

        <!-- Today sent -->
        <v-col cols="12" sm="6" md="4" lg="2">
          <v-card class="glass-card stat-tile" height="100%">
            <div class="tile-head">
              <v-avatar color="secondary" variant="tonal" rounded="lg" size="36">
                <v-icon icon="mdi-send-outline" size="18" />
              </v-avatar>
              <span class="tile-label">已发送消息</span>
            </div>
            <div class="tile-value mt-3">
              <AnimatedCounter :target="pluginUsage?.sentMessageCount ?? 0" />
            </div>
          </v-card>
        </v-col>

        <!-- Framework version -->
        <v-col cols="12" sm="6" md="4" lg="2">
          <v-card class="glass-card stat-tile" height="100%">
            <div class="tile-head">
              <v-avatar color="accent" variant="tonal" rounded="lg" size="36">
                <v-icon icon="mdi-application-cog-outline" size="18" />
              </v-avatar>
              <span class="tile-label">框架版本</span>
            </div>
            <div class="tile-value tile-value--mono mt-3">v{{ info.version }}</div>
          </v-card>
        </v-col>
      </v-row>

      <!-- ── Row 2: Resource gauges (left) + System info (right) ── -->
      <v-row class="mt-4">
        <v-col cols="12" md="8">
          <v-card class="glass-card pa-6" height="100%">
            <div class="text-subtitle-2 font-weight-bold">系统资源</div>
            <div class="text-caption text-medium-emphasis mt-1 mb-6">每 5 秒自动刷新</div>

            <template v-if="usage">
              <div class="resource-rings">
                <CpuMemoryRing
                  :value="usage.cpuUsage"
                  label="CPU 占用"
                  color="#8CB4FF"
                  :size="110"
                />
                <CpuMemoryRing
                  :value="usage.memoryUsage"
                  label="内存占用"
                  color="#4CAF84"
                  :size="110"
                />
                <CpuMemoryRing
                  :value="
                    info.diskTotalSpaceInGB > 0
                      ? ((info.diskTotalSpaceInGB - info.diskFreeSpaceInGB) /
                          info.diskTotalSpaceInGB) *
                        100
                      : 0
                  "
                  label="磁盘占用"
                  color="#FF9800"
                  :size="110"
                />
              </div>

              <v-divider class="my-6" />

              <div class="resource-metrics">
                <div class="resource-metric">
                  <span class="metric-label">CPU 整体占用</span>
                  <span class="metric-val">{{ usage.cpuUsage.toFixed(1) }}%</span>
                </div>
                <div class="resource-metric">
                  <span class="metric-label">已用 / 总内存</span>
                  <span class="metric-val"
                    >{{ formatMemory(usage.usedMemoryInMB) }} /
                    {{ formatMemory(usage.totalMemoryInMB) }}</span
                  >
                </div>
                <div class="resource-metric">
                  <span class="metric-label">进程总内存</span>
                  <span class="metric-val">{{
                    formatMemory(pluginUsage?.totalProcessMemory ?? 0)
                  }}</span>
                </div>
                <div class="resource-metric">
                  <span class="metric-label">磁盘可用 / 总量</span>
                  <span class="metric-val"
                    >{{ info.diskFreeSpaceInGB.toFixed(1) }} GB /
                    {{ info.diskTotalSpaceInGB.toFixed(1) }} GB</span
                  >
                </div>
              </div>
            </template>

            <div v-else class="text-caption text-medium-emphasis">等待性能数据…</div>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <v-card class="glass-card pa-6" height="100%">
            <div class="text-subtitle-2 font-weight-bold">系统环境</div>
            <div class="text-caption text-medium-emphasis mt-1 mb-6">基础运行环境信息</div>

            <div class="info-list">
              <div class="info-row">
                <span class="info-label">操作系统</span>
                <span class="info-val">{{ info.osVersion }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">处理器</span>
                <span class="info-val">{{ info.cpu }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">物理内存</span>
                <span class="info-val">{{ formatMemory(info.totalMemory) }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">当前协议</span>
                <template v-if="currentProtocol">
                  <div style="display: flex; align-items: center; gap: 8px">
                    <span class="info-val">{{ currentProtocol.name }}</span>
                    <v-chip
                      :color="currentProtocol.isConnected ? 'success' : 'warning'"
                      size="x-small"
                      variant="tonal"
                    >
                      {{ currentProtocol.isConnected ? '已连接' : '未连接' }}
                    </v-chip>
                  </div>
                </template>
                <span v-else class="info-val text-medium-emphasis">—</span>
              </div>
              <div class="info-row">
                <span class="info-label">.NET 运行时</span>
                <span class="info-val">{{ info.dotNetRuntimeVersion || '—' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">工作目录</span>
                <span class="info-val">{{ info.workingDirectory || '—' }}</span>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- ── Row 3: Process table ── -->
      <v-row v-if="pluginUsage" class="mt-4">
        <v-col cols="12">
          <v-card class="glass-card">
            <div class="d-flex align-center pa-5 pb-3">
              <div>
                <div class="text-subtitle-2 font-weight-bold">进程资源</div>
                <div class="text-caption text-medium-emphasis mt-1">
                  共 {{ sortedProcessItems.length }} 个进程
                </div>
              </div>
              <v-spacer />
              <v-chip color="primary" size="small" variant="tonal" class="mr-2">
                CPU 合计 {{ pluginUsage.totalProcessCPU.toFixed(1) }}%
              </v-chip>
              <v-chip color="success" size="small" variant="tonal">
                内存合计 {{ pluginUsage.totalProcessMemory.toFixed(1) }} MB
              </v-chip>
            </div>

            <v-table density="comfortable">
              <thead>
                <tr>
                  <th class="sort-th" @click="toggleSort('name')">
                    进程名
                    <v-icon
                      v-if="sortKey === 'name'"
                      :icon="sortDir === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'"
                      size="14"
                      class="ml-1"
                    />
                  </th>
                  <th class="sort-th" @click="toggleSort('pid')">
                    PID
                    <v-icon
                      v-if="sortKey === 'pid'"
                      :icon="sortDir === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'"
                      size="14"
                      class="ml-1"
                    />
                  </th>
                  <th class="sort-th" style="min-width: 200px" @click="toggleSort('cpu')">
                    CPU 占用
                    <v-icon
                      v-if="sortKey === 'cpu'"
                      :icon="sortDir === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'"
                      size="14"
                      class="ml-1"
                    />
                  </th>
                  <th class="sort-th" style="min-width: 200px" @click="toggleSort('mem')">
                    内存占用
                    <v-icon
                      v-if="sortKey === 'mem'"
                      :icon="sortDir === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'"
                      size="14"
                      class="ml-1"
                    />
                  </th>
                  <th style="width: 104px">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in sortedProcessItems" :key="item.pid">
                  <td class="font-weight-medium">{{ getProcessName(item) }}</td>
                  <td class="text-caption text-medium-emphasis">{{ item.pid }}</td>
                  <td>
                    <div class="bar-cell">
                      <span class="bar-label">{{ item.cpuUsage.toFixed(1) }}%</span>
                      <v-progress-linear
                        :model-value="Math.min(item.cpuUsage, 100)"
                        color="primary"
                        bg-opacity="0.12"
                        rounded
                        height="6"
                      />
                    </div>
                  </td>
                  <td>
                    <div class="bar-cell">
                      <span class="bar-label">{{ item.memoryUsage.toFixed(1) }} MB</span>
                      <v-progress-linear
                        :model-value="
                          getProcessShare(item.memoryUsage, pluginUsage.totalProcessMemory)
                        "
                        color="success"
                        bg-opacity="0.12"
                        rounded
                        height="6"
                      />
                    </div>
                  </td>
                  <td>
                    <div class="d-flex align-center">
                      <v-btn
                        icon
                        size="small"
                        variant="text"
                        color="error"
                        :loading="disablingIds.has(item.id)"
                        :disabled="item.id === 0 || reloadingIds.has(item.id)"
                        @click.stop="handleDisable(item)"
                      >
                        <v-icon icon="mdi-stop" size="20" />
                        <v-tooltip activator="parent" location="top">{{
                          item.id === 0 ? '主框架不可禁用' : '禁用插件'
                        }}</v-tooltip>
                      </v-btn>
                      <v-btn
                        icon
                        size="small"
                        variant="text"
                        color="warning"
                        :loading="reloadingIds.has(item.id)"
                        :disabled="item.id === 0 || disablingIds.has(item.id)"
                        @click.stop="handleReload(item)"
                      >
                        <v-icon icon="mdi-restart" size="20" />
                        <v-tooltip activator="parent" location="top">{{
                          item.id === 0 ? '主框架不可重载' : '重载插件'
                        }}</v-tooltip>
                      </v-btn>
                    </div>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <!-- No data state -->
    <v-card v-else-if="!loading" class="glass-card pa-10 text-center">
      <v-icon icon="mdi-cloud-alert-outline" size="48" class="mb-3 text-medium-emphasis" />
      <div class="text-h6 mb-2">仪表盘暂时不可用</div>
      <div class="text-body-2 text-medium-emphasis">{{ loadError || '未能获取基础运行信息' }}</div>
    </v-card>
  </div>
</template>

<style scoped>
/* ── Stat tiles ── */
.stat-tile {
  padding: 18px 20px 16px;
}

.tile-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tile-label {
  font-size: 0.76rem;
  color: rgba(var(--v-theme-on-surface), 0.56);
}

.tile-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tile-dot--on {
  background: rgb(var(--v-theme-success));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-success), 0.2);
}

.tile-dot--off {
  background: rgb(var(--v-theme-error));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-error), 0.2);
}

.tile-value {
  font-size: 1.55rem;
  font-weight: 700;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile-value--mono {
  font-size: 1.15rem;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}

.tile-value--muted {
  color: rgba(var(--v-theme-on-surface), 0.28);
}

.tile-sub {
  margin-top: 6px;
  font-size: 0.74rem;
  color: rgba(var(--v-theme-on-surface), 0.46);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-tile--pending {
  opacity: 0.65;
}

/* ── Resource gauges ── */
.resource-rings {
  display: flex;
  justify-content: space-around;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.resource-metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.resource-metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}

.metric-label {
  font-size: 0.74rem;
  color: rgba(var(--v-theme-on-surface), 0.52);
}

.metric-val {
  font-size: 0.92rem;
  font-weight: 600;
  word-break: break-word;
}

/* ── System info ── */
.info-list {
  display: flex;
  flex-direction: column;
}

.info-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}

.info-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.info-row--pending {
  opacity: 0.55;
}

.info-label {
  font-size: 0.76rem;
  color: rgba(var(--v-theme-on-surface), 0.52);
  flex-shrink: 0;
  padding-top: 1px;
}

.info-val {
  font-size: 0.84rem;
  font-weight: 500;
  text-align: right;
  word-break: break-word;
}

/* ── Sortable table ── */
.sort-th {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.sort-th:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}

/* ── Pending metric ── */
.resource-metric--pending {
  opacity: 0.55;
}

.metric-val--muted {
  color: rgba(var(--v-theme-on-surface), 0.32);
}

/* ── Process table ── */
.bar-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bar-label {
  font-size: 0.82rem;
  font-weight: 600;
  min-width: 72px;
  font-variant-numeric: tabular-nums;
}
</style>
