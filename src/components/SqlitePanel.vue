<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useNotifyStore } from '@/stores/notify'
import { useAppStore } from '@/stores/app'
import { getSqliteData, getSqliteSchema, getSqliteTables, runSqliteQuery } from '@/api/sqlite'
import { getErrorMessage } from '@/api/client'
import type { SqliteDataData, SqliteQueryResult, SqliteTableInfo } from '@/models'
import type * as MonacoNs from 'monaco-editor'
import {
  buildUpdateSql,
  cellText,
  isReadonlySql,
  rowKeyOf as buildRowKey,
} from '@/utils/sqliteEdit'

const props = defineProps<{
  dbPath: string
  dbName: string
}>()

const emit = defineEmits<{ back: [] }>()

const notify = useNotifyStore()
const app = useAppStore()

const tables = ref<SqliteTableInfo[]>([])
const tablesLoading = ref(false)
const tablesError = ref('')

const selectedTable = ref('')

const data = ref<SqliteDataData | null>(null)
const dataLoading = ref(false)
const page = ref(1)
const pageSize = ref(50)
const pageSizeOptions = [50, 100, 200]

// ── 数据网格列宽：可拖拽调整，双击自动适应 ──
const DEFAULT_COL_WIDTH = 140
const MIN_COL_WIDTH = 60
const colWidths = ref<Record<string, number>>({})
const resizing = ref<{ col: string; startX: number; startWidth: number } | null>(null)
let measureCtx: CanvasRenderingContext2D | null = null

function colWidth(col: string): number {
  return colWidths.value[col] ?? DEFAULT_COL_WIDTH
}

function ensureColWidths(columns: string[]) {
  for (const c of columns) {
    if (!colWidths.value[c]) colWidths.value[c] = DEFAULT_COL_WIDTH
  }
}

function startResize(col: string, e: MouseEvent) {
  resizing.value = { col, startX: e.clientX, startWidth: colWidths.value[col] ?? DEFAULT_COL_WIDTH }
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', stopResize)
}

function onResizeMove(e: MouseEvent) {
  if (!resizing.value) return
  const { col, startX, startWidth } = resizing.value
  colWidths.value[col] = Math.max(MIN_COL_WIDTH, Math.round(startWidth + e.clientX - startX))
}

function stopResize() {
  resizing.value = null
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', stopResize)
}

function getMeasureCtx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const canvas = document.createElement('canvas')
    measureCtx = canvas.getContext('2d')!
  }
  return measureCtx
}

function autoFitColumn(col: string) {
  const ctx = getMeasureCtx()
  const colIndex = data.value?.columns.indexOf(col)
  if (colIndex === undefined || colIndex < 0 || !data.value) return
  // 表头：13px 半粗，与 .data-grid-header-cell 一致
  ctx.font = '600 13px "Noto Sans Mono", monospace'
  let max = ctx.measureText(col).width + 24 // 左右各 10px 内边距 + 4px 余量
  // 单元格：12px，与 .data-grid-cell 一致
  ctx.font = '12px "Noto Sans Mono", monospace'
  for (const row of data.value.rows) {
    const w = ctx.measureText(cellText(row[colIndex])).width + 24
    if (w > max) max = w
  }
  // 超长值不超过 400px，避免单列被撑爆，超出部分由单元格省略号 + 悬停提示处理
  colWidths.value[col] = Math.min(400, Math.max(MIN_COL_WIDTH, Math.ceil(max)))
}

const sql = ref('')
const running = ref(false)
const queryResult = ref<SqliteQueryResult | null>(null)
const queryError = ref('')
const queryErrorType = ref('')

// 右侧双 Tab：data=数据预览，query=执行查询
const activeTab = ref('data')

// ── SQL 编辑器（Monaco，懒加载） ──
const sqlEditorEl = ref<HTMLElement | null>(null)
let sqlEditor: MonacoNs.editor.IStandaloneCodeEditor | null = null
let monacoNs: typeof import('monaco-editor') | null = null

async function ensureSqlEditor() {
  if (sqlEditor || !sqlEditorEl.value) return
  const [monaco, { setupMonacoWorkers }] = await Promise.all([
    import('monaco-editor'),
    import('@/utils/monacoWorkers'),
  ])
  await import('monaco-editor/nls/lang/zh-cn.js')
  setupMonacoWorkers()
  monacoNs = monaco
  monaco.editor.setTheme(app.effectiveTheme === 'light' ? 'vs' : 'vs-dark')
  sqlEditor = monaco.editor.create(sqlEditorEl.value, {
    value: sql.value,
    language: 'sql',
    theme: app.effectiveTheme === 'light' ? 'vs' : 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'off',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    tabSize: 2,
    renderWhitespace: 'selection',
  })
  sqlEditor.onDidChangeModelContent(() => {
    sql.value = sqlEditor!.getValue()
  })
  sqlEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runQuery())
}

function disposeSqlEditor() {
  if (sqlEditor) {
    sqlEditor.dispose()
    sqlEditor = null
  }
  monacoNs = null
}

watch(activeTab, (v) => {
  if (v === 'query') {
    nextTick(() => ensureSqlEditor())
  } else {
    disposeSqlEditor()
  }
})

watch(
  () => app.effectiveTheme,
  (t) => {
    monacoNs?.editor.setTheme(t === 'light' ? 'vs' : 'vs-dark')
  },
)

const totalPages = computed(() =>
  data.value ? Math.max(1, Math.ceil(data.value.total / data.value.pageSize)) : 1,
)

// 请求序号：目录/表/页快速切换时丢弃过期响应
let tableLoadSeq = 0

async function loadTables() {
  tablesLoading.value = true
  tablesError.value = ''
  try {
    const res = await getSqliteTables(props.dbPath)
    if (res.data.code === 0) {
      tables.value = res.data.data
    } else {
      tablesError.value = res.data.message || '加载表列表失败'
    }
  } catch (e) {
    tablesError.value = getErrorMessage(e, '加载表列表失败')
  } finally {
    tablesLoading.value = false
  }
}

async function loadData(seq = ++tableLoadSeq) {
  if (!selectedTable.value) return
  dataLoading.value = true
  editingCell.value = null
  try {
    const res = await getSqliteData(props.dbPath, selectedTable.value, page.value, pageSize.value)
    if (seq !== tableLoadSeq) return
    if (res.data.code === 0) {
      data.value = res.data.data
      ensureColWidths(res.data.data.columns)
    } else {
      notify.error(res.data.message || '加载数据失败')
    }
  } catch (e) {
    if (seq !== tableLoadSeq) return
    notify.error(getErrorMessage(e, '加载数据失败'))
  } finally {
    if (seq === tableLoadSeq) dataLoading.value = false
  }
}

/** 双击表切换：加载数据（有未保存编辑时先确认） */
function openTable(name: string) {
  if (name === selectedTable.value) return
  confirmDiscard(() => {
    selectedTable.value = name
    data.value = null
    page.value = 1
    queryResult.value = null
    queryError.value = ''
    editedCells.value = {}
    const seq = ++tableLoadSeq
    loadPkColumns(seq)
    loadData(seq)
  })
}

function changePage(p: number) {
  if (p === page.value) return
  confirmDiscard(() => {
    page.value = p
    loadData()
  })
}

function changePageSize(v: number) {
  confirmDiscard(() => {
    pageSize.value = v
    page.value = 1
    loadData()
  })
}

const confirmRun = ref(false)
const pendingRunSql = ref('')

/** 执行前确认：写语句（UPDATE/DELETE/DROP/INSERT 等）需要二次确认 */
function runQuery() {
  const statement = sql.value.trim()
  if (!statement || running.value) return
  if (!isReadonlySql(statement)) {
    pendingRunSql.value = statement
    confirmRun.value = true
    return
  }
  executeQuery(statement)
}

function confirmExecute() {
  confirmRun.value = false
  const statement = pendingRunSql.value
  pendingRunSql.value = ''
  if (statement) executeQuery(statement)
}

async function executeQuery(statement: string) {
  running.value = true
  queryError.value = ''
  queryErrorType.value = ''
  queryResult.value = null
  try {
    const res = await runSqliteQuery(props.dbPath, statement)
    if (res.data.code === 0) {
      queryResult.value = res.data.data
    } else {
      queryError.value = res.data.message || '执行失败'
      const data = res.data.data as { errorType?: string } | null
      queryErrorType.value = data?.errorType ?? ''
    }
  } catch (e) {
    queryError.value = getErrorMessage(e, '执行 SQL 失败')
    const err = e as { response?: { data?: { data?: { errorType?: string } | null } } }
    queryErrorType.value = err.response?.data?.data?.errorType ?? ''
  } finally {
    running.value = false
  }
}

function displayCell(v: unknown): string {
  const s = cellText(v)
  return s.length > 200 ? `${s.slice(0, 200)}…` : s
}

function cellTitle(v: unknown): string | undefined {
  const s = cellText(v)
  return s.length > 200 ? s : undefined
}

// ── 行内编辑（需主键定位行） ──
const pkColumns = ref<string[]>([])
interface EditedCell {
  original: unknown
  text: string
}
interface EditedRow {
  pk: unknown[]
  cells: Record<number, EditedCell>
}
const editedCells = ref<Record<string, EditedRow>>({})
const editingCell = ref<{ rowKey: string; colIndex: number; rowIndex: number } | null>(null)
const editInput = ref('')
const editInputEl = ref<HTMLInputElement | null>(null)

/** 函数 ref：直接持有 input 元素，避免 v-if 切换时 Vue 把 ref 收集成数组 */
function setEditInputEl(el: unknown) {
  editInputEl.value = (el as HTMLInputElement | null) ?? null
}
const savingEdits = ref(false)
const discardDialog = ref(false)
let discardAction: (() => void) | null = null

const hasPk = computed(() => pkColumns.value.length > 0)
const dirtyCount = computed(() =>
  Object.values(editedCells.value).reduce((n, row) => n + Object.keys(row.cells).length, 0),
)
const hasDirty = computed(() => dirtyCount.value > 0)

function pkValuesOf(row: unknown[]): unknown[] {
  const columns = data.value?.columns ?? []
  return pkColumns.value.map((pk) => {
    const idx = columns.indexOf(pk)
    return idx >= 0 ? row[idx] : null
  })
}

function rowKeyOf(row: unknown[]): string {
  return buildRowKey(pkValuesOf(row))
}

async function loadPkColumns(seq = tableLoadSeq) {
  pkColumns.value = []
  if (!selectedTable.value) return
  try {
    const res = await getSqliteSchema(props.dbPath, selectedTable.value)
    if (seq !== tableLoadSeq) return
    if (res.data.code === 0) {
      pkColumns.value = res.data.data.columns.filter((c) => c.primaryKey > 0).map((c) => c.name)
    }
  } catch {
    // 拿不到主键信息时禁用编辑
  }
}

function isPkCell(ci: number): boolean {
  return pkColumns.value.includes(data.value?.columns[ci] ?? '')
}

function isDirty(rk: string, ci: number): boolean {
  return editedCells.value[rk]?.cells[ci] !== undefined
}

function isEditing(ri: number, ci: number): boolean {
  return editingCell.value?.rowIndex === ri && editingCell.value?.colIndex === ci
}

function cellDisplay(row: unknown[], ci: number): { text: string; isNull: boolean } {
  const rk = rowKeyOf(row)
  const edited = editedCells.value[rk]?.cells[ci]
  if (edited !== undefined) {
    return { text: displayCell(edited.text), isNull: edited.text.trim().toUpperCase() === 'NULL' }
  }
  const v = row[ci]
  if (v === null || v === undefined) return { text: 'NULL', isNull: true }
  return { text: displayCell(v), isNull: false }
}

function cellFullText(row: unknown[], ci: number): string {
  const rk = rowKeyOf(row)
  const edited = editedCells.value[rk]?.cells[ci]
  if (edited !== undefined) return edited.text
  const v = row[ci]
  return v === null || v === undefined ? '' : cellText(v)
}

function startEdit(row: unknown[], ri: number, ci: number) {
  // 若已有正在编辑的单元格，先提交其当前内容
  if (editingCell.value) commitEdit()
  // 新格子不可编辑（无主键/主键列）：只提交并退出编辑状态
  if (!hasPk.value || isPkCell(ci)) return
  const rk = rowKeyOf(row)
  const edited = editedCells.value[rk]?.cells[ci]
  editingCell.value = { rowKey: rk, colIndex: ci, rowIndex: ri }
  editInput.value = edited !== undefined ? edited.text : cellText(row[ci])
  // 等新输入框挂载后再聚焦；旧输入框可能刚被移除，直接 nextTick 取到的引用可能无效
  setTimeout(() => {
    const el = editInputEl.value
    if (el && typeof el.focus === 'function') {
      el.focus()
    }
  }, 0)
}

function commitEdit() {
  const editing = editingCell.value
  if (!editing) return
  editingCell.value = null
  const rk = editing.rowKey
  const row = data.value?.rows[editing.rowIndex]
  const ci = editing.colIndex
  if (!row) return
  const original = row[ci]
  if (editInput.value === cellText(original)) {
    // 改回原值：清除脏标记，避免无意义更新
    if (editedCells.value[rk]) {
      delete editedCells.value[rk].cells[ci]
      if (Object.keys(editedCells.value[rk].cells).length === 0) delete editedCells.value[rk]
    }
    return
  }
  if (!editedCells.value[rk]) editedCells.value[rk] = { pk: pkValuesOf(row), cells: {} }
  editedCells.value[rk].cells[ci] = { original, text: editInput.value }
}

function cancelEdit() {
  editingCell.value = null
}

async function saveEdits() {
  if (!hasDirty.value || savingEdits.value || !data.value) return
  savingEdits.value = true
  const columns = data.value.columns
  const table = selectedTable.value
  try {
    for (const entry of Object.values(editedCells.value)) {
      const built = buildUpdateSql(
        table,
        columns,
        pkColumns.value,
        entry.pk,
        Object.entries(entry.cells).map(([ci, cell]) => ({
          colIndex: Number(ci),
          original: cell.original,
          text: cell.text,
        })),
      )
      if (built.kind === 'error') throw new Error(built.message)
      const res = await runSqliteQuery(props.dbPath, built.sql)
      if (res.data.code !== 0) throw new Error(res.data.message || '保存失败')
      const affected = res.data.data?.affectedRows
      if (typeof affected === 'number' && affected === 0) {
        throw new Error('未匹配到需要更新的行（数据可能已被其他进程修改），已中止保存')
      }
    }
    notify.success('已保存修改')
    editedCells.value = {}
    await loadData()
  } catch (e) {
    notify.error(getErrorMessage(e, '保存失败'))
  } finally {
    savingEdits.value = false
  }
}

function confirmDiscard(action: () => void) {
  if (!hasDirty.value) {
    action()
    return
  }
  discardAction = action
  discardDialog.value = true
}

function doDiscard() {
  discardDialog.value = false
  const action = discardAction
  discardAction = null
  editedCells.value = {}
  editingCell.value = null
  action?.()
}

function cancelDiscard() {
  discardDialog.value = false
  discardAction = null
}

function requestClose() {
  confirmDiscard(() => emit('back'))
}

onMounted(loadTables)

onBeforeUnmount(() => {
  stopResize()
  disposeSqlEditor()
})
</script>

<template>
  <v-card class="glass-card d-flex flex-column">
    <v-card-item>
      <template #prepend>
        <v-avatar color="primary" variant="tonal" size="36">
          <v-icon icon="mdi-database" size="20" />
        </v-avatar>
      </template>
      <v-card-title class="text-body-1 font-weight-bold text-truncate">{{ dbName }}</v-card-title>
      <v-card-subtitle class="text-caption text-medium-emphasis text-truncate">
        {{ dbPath }}
      </v-card-subtitle>
      <template #append>
        <v-btn
          color="primary"
          variant="tonal"
          size="small"
          prepend-icon="mdi-content-save-outline"
          :disabled="!hasDirty || savingEdits"
          :loading="savingEdits"
          @click="saveEdits"
        >
          保存
        </v-btn>
        <v-btn icon="mdi-close" variant="text" size="small" title="关闭" @click="requestClose" />
      </template>
    </v-card-item>

    <v-divider />

    <div class="sqlite-body">
      <!-- 左侧：表 / 视图列表，双击切换 -->
      <div class="sqlite-sidebar pa-3">
        <div class="text-caption font-weight-bold mb-2">表 / 视图（双击切换）</div>
        <v-alert v-if="tablesError" type="error" density="compact" variant="tonal" class="mb-2">
          {{ tablesError }}
        </v-alert>
        <v-skeleton-loader v-if="tablesLoading" type="list-item-two-line@4" />
        <v-list v-else density="compact" nav>
          <v-list-item
            v-for="t in tables"
            :key="t.name"
            :active="selectedTable === t.name"
            :title="t.name"
            density="compact"
            @dblclick="openTable(t.name)"
          >
            <template #prepend>
              <v-icon :icon="t.type === 'view' ? 'mdi-eye-outline' : 'mdi-table'" size="18" />
            </template>
            <template #append>
              <v-chip size="x-small" variant="tonal">
                {{ t.type === 'view' ? '视图' : '表' }}
              </v-chip>
            </template>
          </v-list-item>
          <v-list-item v-if="!tables.length" disabled title="（无表）" />
        </v-list>
      </div>

      <!-- 右侧：数据 / 查询 双 Tab -->
      <div class="sqlite-main pa-3 d-flex flex-column">
        <v-tabs
          v-model="activeTab"
          density="compact"
          color="primary"
          class="mb-3"
          style="flex-shrink: 0"
        >
          <v-tab value="data">数据</v-tab>
          <v-tab value="query">查询</v-tab>
        </v-tabs>

        <!-- 数据 Tab -->
        <div v-if="activeTab === 'data'" class="tab-panel">
          <template v-if="!selectedTable">
            <div class="empty-hint flex-grow-1">
              <v-icon icon="mdi-table" size="40" class="text-medium-emphasis mb-2" />
              <div class="text-body-1 text-medium-emphasis">双击左侧表查看数据</div>
            </div>
          </template>

          <template v-else>
            <!-- 数据预览 -->
            <div class="d-flex align-center mb-2">
              <span class="text-caption font-weight-bold">数据预览</span>
              <v-spacer />
              <v-select
                :model-value="pageSize"
                :items="pageSizeOptions"
                label="每页"
                variant="outlined"
                density="compact"
                hide-details
                style="max-width: 110px"
                @update:model-value="changePageSize"
              />
            </div>

            <v-skeleton-loader v-if="dataLoading" type="table-row@6" />
            <div
              v-else-if="data"
              class="result-card pa-2 d-flex flex-column"
              style="flex: 1 1 0%; min-height: 0"
            >
              <div class="data-grid">
                <div class="data-grid-body">
                  <div class="data-grid-row data-grid-header">
                    <div
                      v-for="col in data.columns"
                      :key="col"
                      class="data-grid-cell data-grid-header-cell"
                      :style="{ width: colWidth(col) + 'px' }"
                    >
                      <span class="data-grid-label text-truncate">{{ col }}</span>
                      <div
                        class="col-resizer"
                        @mousedown.prevent.stop="startResize(col, $event)"
                        @dblclick.stop="autoFitColumn(col)"
                      />
                    </div>
                  </div>
                  <div
                    v-for="(row, ri) in data.rows"
                    :key="ri"
                    class="data-grid-row"
                    :class="{ 'data-grid-row--alt': ri % 2 === 1 }"
                  >
                    <div
                      v-for="(cell, ci) in row"
                      :key="ci"
                      class="data-grid-cell"
                      :class="{
                        'data-grid-cell--edited': isDirty(rowKeyOf(row), ci),
                        'data-grid-cell--editable': hasPk && !isPkCell(ci),
                      }"
                      :title="cellFullText(row, ci)"
                      :style="{ width: colWidth(data.columns[ci]) + 'px' }"
                      @dblclick="startEdit(row, ri, ci)"
                    >
                      <input
                        v-if="isEditing(ri, ci)"
                        :ref="setEditInputEl"
                        v-model="editInput"
                        class="cell-edit-input"
                        placeholder="留空=空字符串；输入 NULL 设为空值"
                        @keydown.enter.prevent="commitEdit"
                        @keydown.esc.stop.prevent="cancelEdit"
                        @blur="commitEdit"
                      />
                      <template v-else>
                        <span v-if="cellDisplay(row, ci).isNull" class="text-disabled"> NULL </span>
                        <span v-else>{{ cellDisplay(row, ci).text }}</span>
                      </template>
                    </div>
                  </div>
                  <div v-if="!data.rows.length" class="data-grid-empty">
                    <span class="text-caption text-medium-emphasis">无数据</span>
                  </div>
                </div>
              </div>
              <div class="d-flex align-center pa-2 flex-shrink-0">
                <span class="text-caption text-medium-emphasis">共 {{ data.total }} 行</span>
                <v-spacer />
                <v-pagination
                  :model-value="page"
                  :length="totalPages"
                  :total-visible="7"
                  density="compact"
                  @update:model-value="changePage"
                />
              </div>
            </div>
          </template>
        </div>

        <!-- 查询 Tab -->
        <div v-else class="tab-panel">
          <div ref="sqlEditorEl" class="sql-editor-host" />
          <div class="d-flex align-center mb-3">
            <span class="text-caption text-medium-emphasis">
              单条语句，查询结果最多 1000 行 · Ctrl+Enter 执行 · 写入语句需确认
            </span>
            <v-spacer />
            <v-btn
              color="primary"
              variant="tonal"
              prepend-icon="mdi-play"
              :loading="running"
              :disabled="!sql.trim()"
              @click="runQuery"
            >
              执行
            </v-btn>
          </div>

          <v-alert
            v-if="queryError"
            type="error"
            density="compact"
            variant="tonal"
            class="query-alert mb-3"
            :icon="queryErrorType === 'sql_syntax_error' ? 'mdi-code-braces' : 'mdi-alert'"
            :title="queryErrorType === 'sql_syntax_error' ? 'SQL 语法错误' : undefined"
          >
            {{ queryError }}
          </v-alert>

          <template v-if="queryResult">
            <v-alert
              v-if="queryResult.type === 'execute'"
              type="success"
              density="compact"
              variant="tonal"
              class="query-alert mb-3"
            >
              执行成功，受影响 {{ queryResult.affectedRows }} 行
            </v-alert>

            <div
              v-else
              class="result-card pa-2 flex-grow-1 d-flex flex-column"
              style="min-height: 0"
            >
              <div class="d-flex align-center mb-2">
                <span class="text-caption text-medium-emphasis">
                  {{ queryResult.rows?.length ?? 0 }}
                  行{{ queryResult.truncated ? '（已截断，最多 1000 行）' : '' }}
                </span>
              </div>
              <div class="result-scroll flex-grow-1">
                <v-table density="compact" fixed-header>
                  <thead>
                    <tr>
                      <th v-for="c in queryResult.columns" :key="c" class="text-body-2">
                        {{ c }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, ri) in queryResult.rows" :key="ri">
                      <td v-for="(cell, ci) in row" :key="ci" class="text-caption">
                        <span v-if="cell === null || cell === undefined" class="text-disabled">
                          NULL
                        </span>
                        <span v-else :title="cellTitle(cell)" class="cell-text">
                          {{ displayCell(cell) }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 未保存编辑确认 -->
    <v-dialog v-model="discardDialog" max-width="400">
      <v-card class="glass-card pa-4">
        <v-card-title class="text-body-1 font-weight-bold px-0 pt-0">未保存的编辑</v-card-title>
        <v-card-text class="px-0"> 有 {{ dirtyCount }} 处未保存的修改，是否抛弃？ </v-card-text>
        <v-card-actions class="px-0 pb-0">
          <v-spacer />
          <v-btn variant="text" @click="cancelDiscard">取消</v-btn>
          <v-btn color="error" variant="tonal" @click="doDiscard">抛弃</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 写入类 SQL 执行确认 -->
    <v-dialog v-model="confirmRun" max-width="420">
      <v-card class="glass-card pa-4">
        <v-card-title class="text-body-1 font-weight-bold px-0 pt-0">确认执行写入语句</v-card-title>
        <v-card-text class="px-0">
          当前语句不是只读查询，可能修改、删除或重建数据，确定执行吗？
        </v-card-text>
        <v-card-actions class="px-0 pb-0">
          <v-spacer />
          <v-btn variant="text" @click="confirmRun = false">取消</v-btn>
          <v-btn color="error" variant="tonal" @click="confirmExecute">执行</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<style scoped>
.sqlite-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}

.sqlite-sidebar {
  flex: 0 0 280px;
  min-height: 0;
  overflow: auto;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.sqlite-main {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

@media (max-width: 959px) {
  .sqlite-body {
    flex-direction: column;
  }

  .sqlite-sidebar {
    flex: 0 0 auto;
    max-height: 40%;
    border-right: none;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  }
}

.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.tab-panel {
  flex: 1 1 0%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* v-alert 默认 flex: 1 1 会撑满容器，改为按内容自适应 */
.query-alert {
  flex: 0 1 auto;
}

/* 数据网格：表头固定、高度填满、列宽可拖拽调整 */
.data-grid {
  flex: 1 1 0%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.data-grid-body {
  flex: 1 1 0%;
  min-height: 0;
  overflow: auto;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 8px;
}

.data-grid-row {
  display: flex;
  min-width: max-content;
}

.data-grid-row--alt {
  background: rgba(var(--v-theme-on-surface), 0.025);
}

.data-grid-header {
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgb(var(--v-theme-surface-variant));
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.data-grid-cell {
  flex: 0 0 auto;
  box-sizing: border-box;
  padding: 5px 10px;
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}

.data-grid-cell--edited {
  background: rgba(var(--v-theme-warning), 0.18);
}

.data-grid-cell--editable {
  cursor: text;
}

.cell-edit-input {
  width: 100%;
  min-width: 0;
  border: none;
  outline: 1px solid rgb(var(--v-theme-primary));
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 0 2px;
}

.data-grid-header-cell {
  display: flex;
  align-items: center;
  position: relative;
  padding-right: 4px;
  font-weight: 600;
  font-size: 0.8125rem;
}

.data-grid-label {
  flex: 1 1 auto;
  min-width: 0;
}

.col-resizer {
  position: absolute;
  top: 0;
  right: -1px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 3;
}

.col-resizer:hover,
.col-resizer:active {
  background: rgba(var(--v-theme-primary), 0.45);
}

.data-grid-empty {
  padding: 16px;
  text-align: center;
}

.result-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 10px;
}

.sql-editor-host {
  height: 130px;
  flex-shrink: 0;
  margin-bottom: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.result-scroll {
  max-height: 420px;
  overflow: auto;
}

.cell-text {
  max-width: 260px;
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
</style>
