<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useAppStore } from '@/stores/app'
import { queryLogs } from '@/api/log'
import { LogLevel } from '@/models'
import type { LogDto, LogLevelValue } from '@/models'

const app = useAppStore()
app.setPageTitle('日志')

const items = ref<LogDto[]>([])
const loading = ref(false)
const firstLoad = ref(true)
const totalCount = ref(0)
const totalPage = ref(0)

const priority = ref<LogLevelValue>(LogLevel.Info)
const pageIndex = ref(1)
const PAGE_SIZE_KEY = 'amn_log_page_size'

function loadPageSize(): number {
  const v = parseInt(localStorage.getItem(PAGE_SIZE_KEY) || '')
  return [100, 200, 500, 1000, 10000].includes(v) ? v : 100
}

const pageSize = ref(loadPageSize())
const pageSizeOptions = [100, 200, 500, 1000, 10000]

// Auto-scroll
const AUTO_SCROLL_KEY = 'amn_log_auto_scroll'
const autoScroll = ref(localStorage.getItem(AUTO_SCROLL_KEY) !== 'false') // default true
const tableWrapper = ref<HTMLElement | null>(null)

function getTableRoot(): HTMLElement | null {
  if (!tableWrapper.value) return null
  // Vuetify component ref → unwrap $el
  return (tableWrapper.value as unknown as { $el?: HTMLElement }).$el ?? tableWrapper.value
}

function toggleAutoScroll(v: boolean) {
  autoScroll.value = v
  localStorage.setItem(AUTO_SCROLL_KEY, String(v))
  if (v) scrollToBottom()
}

function scrollToBottom() {
  const root = getTableRoot()
  if (!root) return
  const el =
    root.querySelector('.v-table__wrapper') ||
    root.querySelector('.v-data-table-virtual__wrapper') ||
    root.querySelector('[style*="overflow"]')
  if (!el) return

  // Virtual table renders rows in batches — scroll twice with a gap
  // to let the second batch render
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  setTimeout(() => {
    const el2 =
      root.querySelector('.v-table__wrapper') ||
      root.querySelector('.v-data-table-virtual__wrapper') ||
      root.querySelector('[style*="overflow"]')
    if (el2) el2.scrollTo({ top: el2.scrollHeight, behavior: 'smooth' })
  }, 200)
}

function onPageSizeChange(v: number) {
  pageSize.value = v
  pageIndex.value = 1
  localStorage.setItem(PAGE_SIZE_KEY, String(v))
  fetchLogs()
}
const search = ref('')
const ascending = ref(false)

const levelOptions = [
  { title: 'Debug', value: LogLevel.Debug },
  { title: 'Info', value: LogLevel.Info },
  { title: 'Warning', value: LogLevel.Warning },
  { title: 'Error', value: LogLevel.Error },
  { title: 'Fatal', value: LogLevel.Fatal },
]

const COLUMNS = [
  { key: 'time', label: '时间', defaultWidth: 199 },
  { key: 'source', label: '来源', defaultWidth: 118 },
  { key: 'name', label: '分类', defaultWidth: 161 },
  { key: 'detail', label: '详情', defaultWidth: 1049 },
  { key: 'status', label: '状态', defaultWidth: 128 },
] as const

const STORAGE_KEY = 'amn_log_column_widths'

function loadWidths(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return {}
}

function saveWidths(w: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(w))
}

const columnWidths = reactive<Record<string, number>>(loadWidths())

function getWidth(key: string): number {
  return columnWidths[key] ?? COLUMNS.find((c) => c.key === key)!.defaultWidth
}

const headers = computed(() =>
  COLUMNS.map((c) => {
    const w = getWidth(c.key)
    return {
      title: c.label,
      key: c.key,
      sortable: false,
      // status column flexes, no fixed width — absorbs the delta
      ...(c.key !== 'status' ? { width: w } : {}),
    }
  }),
)

function levelTextColor(v: number): string {
  if (v >= 40) return '#dc2626'
  if (v >= 30) return '#f87171'
  if (v >= 20) return '#fbbf24'
  if (v >= 13) return '#34d399'
  if (v >= 12) return '#38bdf8'
  if (v >= 11) return '#a78bfa'
  if (v >= 10) return '#94a3b8'
  return '#6b7280'
}

function getRowProps(item: { item: LogDto }) {
  return { style: { color: levelTextColor(item.item.priority) } }
}

function formatTime(iso: string): string {
  return iso.replace('T', ' ').slice(0, 19)
}

// --- Column resize ---
// Resizable columns: all except status (which is the flex column)
const resizableKeys = COLUMNS.filter((c) => c.key !== 'status').map((c) => c.key)
const resizing = ref(false)
let curKey = ''
let nxtKey = ''
let curStartWidth = 0
let nxtStartWidth = 0
let startPageX = 0
let rafId = 0

function getNextResizableKey(key: string): string {
  const idx = resizableKeys.indexOf(key)
  if (idx === -1 || idx === resizableKeys.length - 1) return ''
  return resizableKeys[idx + 1]
}

function onResizeStart(key: string, e: MouseEvent) {
  curKey = key
  nxtKey = getNextResizableKey(key)
  curStartWidth = getWidth(curKey)
  nxtStartWidth = nxtKey ? getWidth(nxtKey) : 0
  startPageX = e.pageX
  resizing.value = true
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
  e.preventDefault()
}

function onResizeMove(e: MouseEvent) {
  const diffX = e.pageX - startPageX
  const newCur = Math.max(20, curStartWidth + diffX)

  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    columnWidths[curKey] = newCur

    if (nxtKey) {
      const newNxt = Math.max(20, nxtStartWidth - diffX)
      columnWidths[nxtKey] = newNxt
    }
  })
}

function onResizeEnd() {
  if (rafId) cancelAnimationFrame(rafId)
  saveWidths({ ...columnWidths })
  curKey = ''
  nxtKey = ''
  resizing.value = false
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
}

function resetColumnWidth(key: string) {
  delete columnWidths[key]
  saveWidths({ ...columnWidths })
}

async function fetchLogs() {
  loading.value = true
  try {
    const res = await queryLogs({
      priority: priority.value,
      pageIndex: pageIndex.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
    })
    if (res.data.code === 0) {
      items.value = res.data.data.items
      totalCount.value = res.data.data.totalCount
      totalPage.value = res.data.data.totalPage
      if (autoScroll.value) {
        await nextTick()
        scrollToBottom()
      }
    }
  } finally {
    loading.value = false
    firstLoad.value = false
  }
}

function onFilterChange() {
  pageIndex.value = 1
  fetchLogs()
}

function onPageChange() {
  fetchLogs()
}

onMounted(async () => {
  await fetchLogs()
  if (autoScroll.value) {
    await nextTick()
    scrollToBottom()
  }
  // timer = setInterval(fetchLogs, 10000)
})

//onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div>
    <v-fade-transition>
      <div v-if="firstLoad" class="pa-4">
        <v-skeleton-loader type="card" class="mb-4" />
        <v-skeleton-loader type="table-row@10" class="glass-card pa-4" />
      </div>
      <div v-else>
        <!-- Filter Bar -->
        <v-card class="glass-card pa-4 mb-4">
          <div class="d-flex flex-wrap ga-3 align-center">
            <v-select
              v-model="priority"
              :items="levelOptions"
              label="日志等级"
              variant="outlined"
              density="compact"
              hide-details
              style="max-width: 160px"
              @update:model-value="onFilterChange()"
            />
            <v-text-field
              v-model="search"
              label="搜索..."
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-magnify"
              hide-details
              clearable
              style="max-width: 240px"
              @keyup.enter="onFilterChange()"
              @click:clear="onFilterChange()"
            />
            <v-spacer />
            <v-switch
              :model-value="autoScroll"
              label="自动滚动"
              density="compact"
              hide-details
              color="primary"
              @update:model-value="toggleAutoScroll"
            />
            <v-btn variant="tonal" prepend-icon="mdi-refresh" :loading="loading" @click="fetchLogs">
              刷新
            </v-btn>
          </div>
        </v-card>

        <!-- Log Table -->
        <v-card ref="tableWrapper" class="glass-card" :class="{ 'user-select-none': resizing }">
          <v-data-table-virtual
            :headers="headers"
            :items="items"
            :loading="loading"
            :row-props="getRowProps"
            item-key="id"
            density="compact"
            height="calc(100vh - 300px)"
            fixed-header
            hover
          >
            <template v-for="col in COLUMNS" :key="col.key" #[`header.${col.key}`]="{ column }">
              <div class="resize-header-cell">
                <span>{{ column.title }}</span>
                <div
                  v-if="resizableKeys.includes(col.key)"
                  class="resize-handle"
                  @mousedown="onResizeStart(col.key, $event)"
                  @dblclick.prevent.stop="resetColumnWidth(col.key)"
                />
              </div>
            </template>

            <template #item.time="{ item }">
              <span class="text-caption">{{ formatTime(item.time) }}</span>
            </template>
            <template #item.status="{ item }">
              <span v-if="item.status" class="text-caption">{{ item.status }}</span>
            </template>
            <template #item.detail="{ item }">
              <span class="text-caption">{{ item.detail }}</span>
            </template>
          </v-data-table-virtual>

          <!-- Pagination -->
          <v-divider />
          <div class="d-flex align-center pa-3 ga-2">
            <span class="text-caption text-medium-emphasis">
              共 {{ totalCount }} 条 · {{ totalPage }} 页
            </span>
            <v-spacer />
            <v-select
              :model-value="pageSize"
              :items="pageSizeOptions"
              label="每页"
              variant="outlined"
              density="compact"
              hide-details
              style="max-width: 200px"
              @update:model-value="onPageSizeChange"
            />
            <v-pagination
              v-model="pageIndex"
              :length="totalPage"
              :total-visible="7"
              density="compact"
              @update:model-value="onPageChange"
            />
          </div>
        </v-card>
      </div>
    </v-fade-transition>
  </div>
</template>

<style scoped>
.resize-header-cell {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  user-select: none;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.resize-handle:hover,
.resize-handle:active {
  border-right: 2px solid rgb(var(--v-theme-primary));
}
</style>
