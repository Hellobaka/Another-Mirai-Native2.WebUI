<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useAppStore } from '@/stores/app'
import { useNotifyStore } from '@/stores/notify'
import {
  copyEntries,
  createDirectory,
  createFile,
  deleteEntries,
  downloadFiles,
  getFolderSize,
  listDirectory,
  moveEntries,
  renameEntry,
  searchFiles,
  uploadFiles,
} from '@/api/file'
import { getErrorMessage } from '@/api/client'
import type { FileEntry } from '@/models'
import SqlitePanel from '@/components/SqlitePanel.vue'
import ImageViewer from '@/components/chat/ImageViewer.vue'
import { getApiBaseUrl } from '@/api/baseUrl'

// Monaco 体积较大，按需异步加载
const FileEditorPanel = defineAsyncComponent(() => import('@/components/FileEditorPanel.vue'))

const router = useRouter()
const route = useRoute()
const app = useAppStore()
const notify = useNotifyStore()
const display = useDisplay()
app.setPageTitle('文件管理')

const mdAndUp = computed(() => display.mdAndUp.value)

// ── SQLite 工作区（模态覆盖层） ──
const sqliteOpen = ref(false)
const dbPath = ref('')
const dbName = ref('')

// ── 浏览状态 ──
const rootPath = ref('')
const currentPath = ref('')
const parentPath = ref('')
const items = ref<FileEntry[]>([])
const loading = ref(true)

const selected = ref<Set<string>>(new Set())
const clipboard = ref<{ mode: 'copy' | 'cut'; sources: string[] } | null>(null)
const pasteLoading = ref(false)

// 文件夹大小统计（按路径缓存）
const folderSizes = ref<Record<string, number>>({})
const computingSize = ref<Set<string>>(new Set())

type SortKey = 'name' | 'size' | 'lastWriteTime'
const sortKey = ref<SortKey | null>(null)
const sortDesc = ref(false)

function toggleSort(key: SortKey) {
  if (sortKey.value !== key) {
    sortKey.value = key
    sortDesc.value = false
  } else if (!sortDesc.value) {
    sortDesc.value = true
  } else {
    sortKey.value = null
    sortDesc.value = false
  }
}

const sortedItems = computed(() => {
  const list = [...items.value]
  list.sort((a, b) => {
    // 目录始终排在前面
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    const dir = sortDesc.value ? -1 : 1
    let cmp: number
    if (sortKey.value === 'size') {
      cmp = (a.size ?? 0) - (b.size ?? 0)
    } else if (sortKey.value === 'lastWriteTime') {
      cmp = a.lastWriteTime.localeCompare(b.lastWriteTime)
    } else {
      cmp = a.name.localeCompare(b.name, 'zh-CN')
    }
    return cmp * dir
  })
  return list
})

const selectedEntries = computed(() => items.value.filter((e) => selected.value.has(e.path)))

const allSelected = computed(
  () => sortedItems.value.length > 0 && selected.value.size === sortedItems.value.length,
)

const rootLabel = computed(() => {
  const parts = rootPath.value.split(/[\\/]/).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : '根目录'
})

const crumbs = computed(() => {
  const list: { title: string; path: string }[] = [{ title: rootLabel.value, path: '' }]
  const segs = currentPath.value.split('/').filter(Boolean)
  let acc = ''
  for (const seg of segs) {
    acc = acc ? `${acc}/${seg}` : seg
    list.push({ title: seg, path: acc })
  }
  return list
})

function joinPath(base: string, name: string): string {
  return base ? `${base}/${name}` : name
}

function isDbFile(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.db') || lower.endsWith('.sqlite') || lower.endsWith('.sqlite3')
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'])

function isImageFile(name: string): boolean {
  const ext = name.toLowerCase().split('.').pop() || ''
  return IMAGE_EXTS.has(ext)
}

let dirLoadSeq = 0

async function loadDirectory(path: string) {
  const seq = ++dirLoadSeq
  loading.value = true
  try {
    const res = await listDirectory(path)
    if (seq !== dirLoadSeq) return
    if (res.data.code === 0) {
      const d = res.data.data
      currentPath.value = d.path
      parentPath.value = d.parent ?? ''
      rootPath.value = d.root
      items.value = d.items ?? []
      selected.value.clear()
      // 搜索结果跳转后选中目标条目
      if (pendingSelectPath) {
        const found = items.value.find((i) => i.path === pendingSelectPath)
        if (found) {
          selected.value.add(found.path)
        }
        pendingSelectPath = null
      }
    } else {
      notify.error(res.data.message || '加载目录失败')
    }
  } catch (e) {
    if (seq !== dirLoadSeq) return
    notify.error(getErrorMessage(e, '加载目录失败'))
  } finally {
    if (seq === dirLoadSeq) loading.value = false
  }
}

function refresh() {
  // 目录内容可能已变化（新建/改名/删除/上传），失效已缓存的大小
  folderSizes.value = {}
  loadDirectory(currentPath.value)
}

function navigate(path: string) {
  // 目录导航写入路由 query，产生浏览器历史记录（可回退/前进）
  router.push({ path: '/files', query: path ? { dir: path } : {} })
}

function goParent() {
  // parentPath 为空时表示父目录是根目录，此时应返回根目录；
  // 仅当当前已在根目录（currentPath 为空）时才不能继续上翻
  if (currentPath.value !== '') navigate(parentPath.value)
}

function openEntry(entry: FileEntry) {
  if (entry.isDirectory) {
    navigate(entry.path)
  } else if (isDbFile(entry.name)) {
    openSqlite(entry)
  } else if (isImageFile(entry.name)) {
    openImagePreview(entry)
  } else {
    openEditor(entry)
  }
}

// ── 图片预览（复用 Chat 的 ImageViewer） ──
const viewerOpen = ref(false)
const viewerSrc = ref('')

function imagePreviewUrl(entry: FileEntry): string {
  const token = localStorage.getItem('amn_token') || ''
  const base = getApiBaseUrl()
  const params = new URLSearchParams({ path: entry.path, access_token: token })
  return `${base}/api/files/image?${params.toString()}`
}

function openImagePreview(entry: FileEntry) {
  viewerSrc.value = imagePreviewUrl(entry)
  viewerOpen.value = true
}

// ── 选择 ──
function isSelected(path: string): boolean {
  return selected.value.has(path)
}

function toggleSelect(path: string) {
  const s = selected.value
  if (s.has(path)) s.delete(path)
  else s.add(path)
}

function onRowClick(entry: FileEntry) {
  // 文件夹行：点击整行进入该文件夹（复选框/操作列已阻止冒泡）
  if (entry.isDirectory) openEntry(entry)
}

function onRowDblClick(entry: FileEntry) {
  // 文件行：双击打开（文本文件进编辑器，db 文件进 SQLite 工作区）
  if (!entry.isDirectory) openEntry(entry)
}

function toggleSelectAll() {
  const s = selected.value
  if (allSelected.value) {
    s.clear()
  } else {
    s.clear()
    for (const e of sortedItems.value) s.add(e.path)
  }
}

function selectOnly(entry: FileEntry) {
  selected.value.clear()
  selected.value.add(entry.path)
}

// ── 新建 / 重命名 ──
type NameDialogKind = 'folder' | 'file' | 'rename'
const nameDialog = reactive({
  open: false,
  kind: 'folder' as NameDialogKind,
  name: '',
  content: '',
  error: '',
  loading: false,
})

function openNameDialog(kind: NameDialogKind, preset = '') {
  nameDialog.kind = kind
  nameDialog.name = preset
  nameDialog.content = ''
  nameDialog.error = ''
  nameDialog.open = true
}

function openNewFolder() {
  openNameDialog('folder')
}

function openNewFile() {
  openNameDialog('file')
}

function openRename() {
  const entry = selectedEntries.value[0]
  if (!entry) return
  openNameDialog('rename', entry.name)
}

/** 右键菜单：选中目标条目后打开重命名对话框（保持模板单函数调用，避免 prettier 拆行） */
function openRenameSelected(entry: FileEntry) {
  selectOnly(entry)
  openRename()
}

async function submitNameDialog() {
  const name = nameDialog.name.trim()
  if (!name) {
    nameDialog.error = '名称不能为空'
    return
  }
  nameDialog.loading = true
  nameDialog.error = ''
  try {
    let res
    if (nameDialog.kind === 'folder') {
      res = await createDirectory(joinPath(currentPath.value, name))
    } else if (nameDialog.kind === 'file') {
      res = await createFile(joinPath(currentPath.value, name), nameDialog.content)
    } else {
      const entry = selectedEntries.value[0]
      if (!entry) return
      res = await renameEntry(entry.path, name)
    }
    if (res.data.code === 0) {
      const tips = { folder: '文件夹已创建', file: '文件已创建', rename: '已重命名' } as const
      notify.success(tips[nameDialog.kind])
      nameDialog.open = false
      refresh()
    } else {
      nameDialog.error = res.data.message || '操作失败'
    }
  } catch (e) {
    nameDialog.error = getErrorMessage(e, '操作失败')
  } finally {
    nameDialog.loading = false
  }
}

// ── 复制 / 剪切 / 粘贴 ──
function setClipboard(kind: 'copy' | 'cut') {
  const paths = [...selected.value]
  if (!paths.length) return
  clipboard.value = { mode: kind, sources: paths }
  notify.info(kind === 'copy' ? `已复制 ${paths.length} 项` : `已剪切 ${paths.length} 项`)
}

async function paste() {
  if (!clipboard.value || pasteLoading.value) return
  pasteLoading.value = true
  try {
    const { mode: kind, sources } = clipboard.value
    // 同目录粘贴：移动为无操作，复制必然同名冲突
    const sameDir = sources.every((s) => {
      const idx = s.lastIndexOf('/')
      return (idx < 0 ? '' : s.slice(0, idx)) === currentPath.value
    })
    if (sameDir) {
      notify.info(kind === 'copy' ? '源文件已在当前目录' : '已在同一目录')
      if (kind === 'cut') clipboard.value = null
      return
    }
    const res =
      kind === 'copy'
        ? await copyEntries(sources, currentPath.value)
        : await moveEntries(sources, currentPath.value)
    if (res.data.code === 0) {
      notify.success(
        kind === 'copy'
          ? `已复制 ${sources.length} 项到当前目录`
          : `已移动 ${sources.length} 项到当前目录`,
      )
      if (kind === 'cut') clipboard.value = null
      refresh()
    } else {
      notify.error(res.data.message || '粘贴失败')
    }
  } catch (e) {
    notify.error(getErrorMessage(e, '粘贴失败'))
  } finally {
    pasteLoading.value = false
  }
}

// ── 删除 ──
const deleteDialog = reactive({ open: false, paths: [] as string[], loading: false })

function openDelete() {
  const paths = [...selected.value]
  if (!paths.length) return
  deleteDialog.paths = paths
  deleteDialog.open = true
}

/** 右键菜单：选中目标条目后打开删除确认（保持模板单函数调用，避免 prettier 拆行） */
function openDeleteSelected(entry: FileEntry) {
  selectOnly(entry)
  openDelete()
}

async function doDelete() {
  if (!deleteDialog.paths.length || deleteDialog.loading) return
  deleteDialog.loading = true
  try {
    const res = await deleteEntries(deleteDialog.paths)
    if (res.data.code === 0) {
      notify.success(`已删除 ${deleteDialog.paths.length} 项`)
      deleteDialog.open = false
      refresh()
    } else {
      notify.error(res.data.message || '删除失败')
      deleteDialog.open = false
    }
  } catch (e) {
    notify.error(getErrorMessage(e, '删除失败'))
    deleteDialog.open = false
  } finally {
    deleteDialog.loading = false
  }
}

// ── 上传 / 下载 ──
const uploadInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const downloading = ref(false)

async function onUploadChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''
  if (!files.length || uploading.value) return
  uploading.value = true
  try {
    const res = await uploadFiles(files, currentPath.value)
    if (res.data.code === 0) {
      notify.success(`已上传 ${files.length} 个文件`)
      refresh()
    } else {
      notify.error(res.data.message || '上传失败')
    }
  } catch (e) {
    notify.error(getErrorMessage(e, '上传失败'))
  } finally {
    uploading.value = false
  }
}

function getDownloadFileName(
  headers: Record<string, string> | undefined,
  fallback: string,
): string {
  const cd = headers?.['content-disposition']
  if (cd) {
    const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(cd)
    if (utf8) return decodeURIComponent(utf8[1])
    const plain = /filename="?([^";]+)"?/i.exec(cd)
    if (plain) return plain[1]
  }
  return fallback
}

async function download(entry: FileEntry) {
  await downloadPaths([entry], entry.isDirectory ? `${entry.name}.zip` : entry.name)
}

/** 多选下载：单个条目原样下载，多个条目（或多个 path）由后端打包 ZIP */
async function downloadSelected() {
  const entries = selectedEntries.value
  if (!entries.length || downloading.value) return
  await downloadPaths(entries)
}

async function downloadPaths(
  entries: FileEntry[],
  fallbackName = entries.length === 1 && entries[0].isDirectory
    ? `${entries[0].name}.zip`
    : 'download.zip',
) {
  downloading.value = true
  try {
    const res = await downloadFiles(entries.map((e) => e.path))
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = getDownloadFileName(
      res.headers as Record<string, string> | undefined,
      fallbackName,
    )
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    notify.error(getErrorMessage(e, '下载失败'))
  } finally {
    downloading.value = false
  }
}

async function computeFolderSize(entry: FileEntry) {
  if (folderSizes.value[entry.path] !== undefined || computingSize.value.has(entry.path)) return
  computingSize.value.add(entry.path)
  try {
    const res = await getFolderSize(entry.path)
    if (res.data.code === 0) {
      folderSizes.value[entry.path] = res.data.data.size
    } else {
      notify.error(res.data.message || '统计文件夹大小失败')
    }
  } catch (e) {
    notify.error(getErrorMessage(e, '统计文件夹大小失败'))
  } finally {
    computingSize.value.delete(entry.path)
  }
}

// ── 搜索（预留接口 GET /api/files/search） ──
const searchKeyword = ref('')
const searchOpen = ref(false)
const searchLoading = ref(false)
const searchSearched = ref(false)
const searchResults = ref<FileEntry[]>([])
const searchTotal = ref(0)
const searchError = ref('')
let searchTimer: number | undefined
let pendingSelectPath: string | null = null
let searchSeq = 0

function onSearchInput() {
  if (searchTimer) window.clearTimeout(searchTimer)
  const kw = searchKeyword.value.trim()
  if (!kw) {
    searchOpen.value = false
    searchLoading.value = false
    searchSearched.value = false
    searchResults.value = []
    searchTotal.value = 0
    searchError.value = ''
    return
  }
  searchOpen.value = true
  searchLoading.value = true
  searchSearched.value = false
  searchTimer = window.setTimeout(() => doSearch(kw), 350)
}

function onSearchEnter() {
  if (searchTimer) window.clearTimeout(searchTimer)
  const kw = searchKeyword.value.trim()
  if (!kw) return
  searchOpen.value = true
  searchLoading.value = true
  doSearch(kw)
}

function onSearchFocus() {
  const kw = searchKeyword.value.trim()
  if (!kw) return
  searchOpen.value = true
  if (!searchSearched.value && !searchLoading.value) {
    searchLoading.value = true
    doSearch(kw)
  }
}

async function doSearch(kw: string) {
  const seq = ++searchSeq
  try {
    // 从当前浏览目录开始递归搜索
    const res = await searchFiles(kw, currentPath.value)
    if (seq !== searchSeq) return
    if (res.data.code === 0) {
      searchResults.value = res.data.data.items
      searchTotal.value = res.data.data.total ?? res.data.data.items.length
      searchError.value = ''
    } else {
      searchResults.value = []
      searchTotal.value = 0
      searchError.value = res.data.message || '搜索失败'
    }
  } catch (e) {
    if (seq !== searchSeq) return
    searchResults.value = []
    searchTotal.value = 0
    searchError.value = getErrorMessage(e, '搜索失败')
  } finally {
    if (seq === searchSeq) {
      searchLoading.value = false
      searchSearched.value = true
    }
  }
}

function goSearchResult(entry: FileEntry) {
  pendingSelectPath = entry.path
  const idx = entry.path.lastIndexOf('/')
  const targetDir = idx > 0 ? entry.path.slice(0, idx) : ''
  if (targetDir === currentPath.value) {
    // 已在目标目录：直接重新加载以应用选中，避免路由无变化导致 pendingSelectPath 失效
    loadDirectory(targetDir)
  } else {
    navigate(targetDir)
  }
  closeSearch()
}

function closeSearch() {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchOpen.value = false
  searchLoading.value = false
  searchSearched.value = false
  searchResults.value = []
  searchTotal.value = 0
  searchError.value = ''
}

// ── 文本编辑 ──
const editorOpen = ref(false)
const editorPath = ref('')
const editorName = ref('')

function openEditor(entry: FileEntry) {
  editorPath.value = entry.path
  editorName.value = entry.name
  editorOpen.value = true
}

function editSelected() {
  const entry = selectedEntries.value[0]
  if (!entry) return
  // 图片：预览；SQLite 文件：进入 SQLite 工作区；其余进文本编辑器
  if (isImageFile(entry.name)) {
    openImagePreview(entry)
    return
  }
  if (isDbFile(entry.name)) {
    openSqlite(entry)
  } else {
    openEditor(entry)
  }
}

function closeEditor() {
  editorOpen.value = false
}

/** 编辑器内取消切换文件时，恢复原路径，避免内容与文件名错位 */
function onRevertPath(path: string) {
  editorPath.value = path
}

function onEditorSaved() {
  refresh()
}

// ── 左右分割：拖动分隔条调整宽度 ──
const splitRef = ref<HTMLElement | null>(null)
const dragging = ref(false)
const SPLIT_KEY = 'amn_files_split_width'
const leftWidthPx = ref(Number(localStorage.getItem(SPLIT_KEY)) || 620)

function startDrag() {
  dragging.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', stopDrag)
}

function onDragMove(e: MouseEvent) {
  if (!splitRef.value) return
  const rect = splitRef.value.getBoundingClientRect()
  const max = Math.max(280, rect.width - 380)
  const width = Math.min(Math.max(e.clientX - rect.left, 280), max)
  leftWidthPx.value = Math.round(width)
}

function stopDrag() {
  dragging.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', stopDrag)
  localStorage.setItem(SPLIT_KEY, String(leftWidthPx.value))
}

// ── SQLite ──
function openSqlite(entry: FileEntry) {
  dbPath.value = entry.path
  dbName.value = entry.name
  sqliteOpen.value = true
}

function closeSqlite() {
  sqliteOpen.value = false
}

// ── 展示辅助 ──
function formatSize(size: number | null): string {
  if (size === null) return '—'
  if (size < 1024) return `${size} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = size
  let i = -1
  do {
    v /= 1024
    i++
  } while (v >= 1024 && i < units.length - 1)
  return `${v.toFixed(1)} ${units[i]}`
}

function formatTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function iconFor(entry: FileEntry): string {
  if (entry.isDirectory) return 'mdi-folder-outline'
  const ext = entry.name.includes('.') ? entry.name.split('.').pop()!.toLowerCase() : ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext))
    return 'mdi-file-image-outline'
  if (['txt', 'md', 'log', 'json', 'xml', 'yaml', 'yml', 'ini', 'conf', 'csv'].includes(ext))
    return 'mdi-file-document-outline'
  if (['js', 'ts', 'vue', 'html', 'css', 'cs', 'py', 'sh', 'bat', 'ps1'].includes(ext))
    return 'mdi-file-code-outline'
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return 'mdi-archive-outline'
  if (['mp3', 'wav', 'flac', 'ogg', 'aac'].includes(ext)) return 'mdi-music-note-outline'
  if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) return 'mdi-video-outline'
  if (['db', 'sqlite', 'sqlite3'].includes(ext)) return 'mdi-database-outline'
  if (['exe', 'dll'].includes(ext)) return 'mdi-application-outline'
  return 'mdi-file-outline'
}

onMounted(async () => {
  await app.fetchWebUIConfig()
  if (!app.enableFileManager) {
    notify.warning('文件管理功能未启用')
    router.replace('/dashboard')
    return
  }
  // 首次进入：从 URL 的 dir 参数恢复目录，并同步 query（不新增历史记录）
  const initial = typeof route.query.dir === 'string' ? route.query.dir : ''
  await loadDirectory(initial)
  if (route.query.dir !== (initial || undefined)) {
    router.replace({ path: '/files', query: initial ? { dir: initial } : {} })
  }
})

// 浏览器回退/前进或外部改 URL：按 query 重新加载目录
watch(
  () => route.query.dir,
  (dir) => {
    const target = typeof dir === 'string' ? dir : ''
    if (target !== currentPath.value) {
      loadDirectory(target)
    }
  },
)

onBeforeUnmount(() => {
  stopDrag()
})
</script>

<template>
  <div>
    <div>
      <!-- 工具栏 -->
      <v-card class="glass-card pa-4 mb-4">
        <div class="d-flex flex-wrap ga-2 align-center">
          <v-btn
            variant="tonal"
            size="small"
            prepend-icon="mdi-arrow-up"
            :disabled="!currentPath"
            @click="goParent"
          >
            上级
          </v-btn>
          <v-btn
            variant="tonal"
            size="small"
            icon="mdi-refresh"
            :loading="loading"
            @click="refresh"
          />
          <v-divider vertical length="24" class="mx-1" />
          <v-btn
            variant="tonal"
            size="small"
            prepend-icon="mdi-folder-plus-outline"
            @click="openNewFolder"
          >
            新建文件夹
          </v-btn>
          <v-btn
            variant="tonal"
            size="small"
            prepend-icon="mdi-file-plus-outline"
            @click="openNewFile"
          >
            新建文件
          </v-btn>
          <v-btn
            variant="tonal"
            size="small"
            prepend-icon="mdi-rename-outline"
            :disabled="selectedEntries.length !== 1"
            @click="openRename"
          >
            重命名
          </v-btn>
          <v-btn
            variant="tonal"
            size="small"
            prepend-icon="mdi-content-copy"
            :disabled="!selected.size"
            @click="setClipboard('copy')"
          >
            复制
          </v-btn>
          <v-btn
            variant="tonal"
            size="small"
            prepend-icon="mdi-content-cut"
            :disabled="!selected.size"
            @click="setClipboard('cut')"
          >
            剪切
          </v-btn>
          <v-btn
            variant="tonal"
            size="small"
            color="primary"
            prepend-icon="mdi-content-paste"
            :disabled="!clipboard"
            :loading="pasteLoading"
            @click="paste"
          >
            粘贴{{ clipboard ? ` (${clipboard.sources.length})` : '' }}
          </v-btn>
          <v-btn
            variant="tonal"
            size="small"
            color="error"
            prepend-icon="mdi-delete-outline"
            :disabled="!selected.size"
            @click="openDelete"
          >
            删除
          </v-btn>
          <v-btn
            variant="tonal"
            size="small"
            prepend-icon="mdi-upload-outline"
            :loading="uploading"
            @click="uploadInput?.click()"
          >
            上传
          </v-btn>
          <v-btn
            variant="tonal"
            size="small"
            prepend-icon="mdi-download-outline"
            :disabled="!selectedEntries.length"
            :loading="downloading"
            @click="downloadSelected"
          >
            {{ selectedEntries.length > 1 ? `下载 (${selectedEntries.length})` : '下载' }}
          </v-btn>
          <v-btn
            variant="tonal"
            size="small"
            prepend-icon="mdi-file-edit-outline"
            :disabled="!(selectedEntries.length === 1 && !selectedEntries[0]?.isDirectory)"
            @click="editSelected"
          >
            编辑
          </v-btn>
          <input ref="uploadInput" type="file" multiple hidden @change="onUploadChange" />
        </div>
      </v-card>

      <!-- 路径栏 -->
      <v-card class="glass-card search-card pa-3 mb-4">
        <div class="d-flex flex-wrap align-center ga-2">
          <v-icon icon="mdi-folder-home-outline" size="20" class="text-medium-emphasis" />
          <v-breadcrumbs
            :items="crumbs"
            density="compact"
            class="px-0 py-0 search-breadcrumbs"
            style="min-width: 0"
          >
            <template #item="{ item }">
              <v-breadcrumbs-item
                :title="item.title"
                :disabled="item.path === currentPath"
                class="text-body-2"
                @click="navigate(item.path)"
              />
            </template>
          </v-breadcrumbs>
          <v-spacer class="search-spacer" />
          <div class="search-wrap">
            <v-text-field
              v-model="searchKeyword"
              placeholder="搜索文件/文件夹..."
              variant="outlined"
              density="compact"
              hide-details
              prepend-inner-icon="mdi-magnify"
              clearable
              @update:model-value="onSearchInput"
              @keyup.enter="onSearchEnter"
              @keydown.esc="closeSearch"
              @focus="onSearchFocus"
              @blur="closeSearch"
            />
            <div v-if="searchOpen" class="search-results" @mousedown.prevent>
              <div v-if="searchLoading" class="search-state">
                <v-progress-circular size="16" indeterminate />
                <span class="ml-2 text-caption text-medium-emphasis">搜索中...</span>
              </div>
              <div v-else-if="searchError" class="search-state">
                <v-icon icon="mdi-alert-circle-outline" size="18" color="error" />
                <span class="ml-2 text-caption">{{ searchError }}</span>
              </div>
              <div v-else-if="searchSearched && !searchResults.length" class="search-state">
                <v-icon icon="mdi-file-search-outline" size="18" class="text-medium-emphasis" />
                <span class="ml-2 text-caption text-medium-emphasis">未找到匹配项</span>
              </div>
              <v-list v-else-if="searchResults.length" density="compact" class="search-list">
                <v-list-item
                  v-for="item in searchResults"
                  :key="item.path"
                  @click="goSearchResult(item)"
                >
                  <template #prepend>
                    <v-icon
                      :icon="item.isDirectory ? 'mdi-folder-outline' : 'mdi-file-outline'"
                      size="18"
                      class="text-medium-emphasis"
                    />
                  </template>
                  <v-list-item-title class="text-body-2 text-truncate">
                    {{ item.name }}
                  </v-list-item-title>
                  <v-tooltip :text="item.path" location="top" open-delay="250" max-width="420">
                    <template #activator="{ props }">
                      <v-list-item-subtitle
                        v-bind="props"
                        class="text-caption text-medium-emphasis text-truncate"
                      >
                        {{ item.path }}
                      </v-list-item-subtitle>
                    </template>
                  </v-tooltip>
                </v-list-item>
                <div class="text-caption text-medium-emphasis pa-2">共 {{ searchTotal }} 项</div>
              </v-list>
            </div>
          </div>
        </div>
      </v-card>

      <!-- 左右分割：左侧文件列表 / 右侧编辑器 -->
      <div ref="splitRef" class="split-view" :class="{ 'split-view--stacked': !mdAndUp }">
        <div
          class="split-left glass-card d-flex flex-column"
          :class="{ 'split-left--fixed': mdAndUp && editorOpen }"
          :style="mdAndUp && editorOpen ? { width: `${leftWidthPx}px` } : undefined"
        >
          <div class="split-table-scroll">
            <v-skeleton-loader v-if="loading" type="table-row@8" />
            <template v-else>
              <v-table density="compact">
                <thead>
                  <tr>
                    <th class="text-center" style="width: 44px">
                      <v-checkbox
                        :model-value="allSelected"
                        density="compact"
                        hide-details
                        @click="toggleSelectAll"
                      />
                    </th>
                    <th class="sortable-th" @click="toggleSort('name')">
                      <span class="d-inline-flex align-center">
                        名称
                        <v-icon
                          v-if="sortKey === 'name'"
                          :icon="sortDesc ? 'mdi-arrow-down' : 'mdi-arrow-up'"
                          size="14"
                          class="ml-1"
                        />
                        <v-icon v-else icon="mdi-sort" size="14" class="ml-1 text-disabled" />
                      </span>
                    </th>
                    <th
                      class="text-right sortable-th"
                      style="width: 100px"
                      @click="toggleSort('size')"
                    >
                      <span class="d-inline-flex align-center justify-end">
                        大小
                        <v-icon
                          v-if="sortKey === 'size'"
                          :icon="sortDesc ? 'mdi-arrow-down' : 'mdi-arrow-up'"
                          size="14"
                          class="ml-1"
                        />
                        <v-icon v-else icon="mdi-sort" size="14" class="ml-1 text-disabled" />
                      </span>
                    </th>
                    <th
                      style="width: 170px"
                      class="sortable-th"
                      @click="toggleSort('lastWriteTime')"
                    >
                      <span class="d-inline-flex align-center">
                        修改时间
                        <v-icon
                          v-if="sortKey === 'lastWriteTime'"
                          :icon="sortDesc ? 'mdi-arrow-down' : 'mdi-arrow-up'"
                          size="14"
                          class="ml-1"
                        />
                        <v-icon v-else icon="mdi-sort" size="14" class="ml-1 text-disabled" />
                      </span>
                    </th>
                    <th class="text-center" style="width: 64px">操作</th>
                  </tr>
                </thead>
                <transition-group name="list" tag="tbody" appear>
                  <tr
                    v-for="entry in sortedItems"
                    :key="entry.path"
                    class="file-row"
                    :class="{ 'file-row--dir': entry.isDirectory }"
                    @click="onRowClick(entry)"
                    @dblclick="onRowDblClick(entry)"
                  >
                    <td class="text-center" @dblclick.stop>
                      <v-checkbox
                        :model-value="isSelected(entry.path)"
                        density="compact"
                        hide-details
                        @click.stop="toggleSelect(entry.path)"
                      />
                    </td>
                    <td
                      @click.stop="entry.isDirectory ? openEntry(entry) : toggleSelect(entry.path)"
                    >
                      <div class="d-flex align-center ga-2" style="min-width: 0">
                        <v-icon :icon="iconFor(entry)" size="20" class="text-medium-emphasis" />
                        <span class="text-body-2 text-truncate" :title="entry.name">
                          {{ entry.name }}
                        </span>
                      </div>
                    </td>
                    <td
                      class="text-right text-caption text-medium-emphasis"
                      style="white-space: nowrap"
                    >
                      <template v-if="entry.isDirectory">
                        <span v-if="folderSizes[entry.path] !== undefined">
                          {{ formatSize(folderSizes[entry.path]) }}
                        </span>
                        <span
                          v-else-if="computingSize.has(entry.path)"
                          class="d-inline-flex align-center"
                        >
                          <v-progress-circular size="12" indeterminate class="mr-1" />
                          计算中
                        </span>
                        <v-btn
                          v-else
                          size="x-small"
                          variant="text"
                          density="comfortable"
                          class="size-calc-btn"
                          @click.stop="computeFolderSize(entry)"
                        >
                          计算
                        </v-btn>
                      </template>
                      <template v-else>{{ formatSize(entry.size) }}</template>
                    </td>
                    <td class="text-caption text-medium-emphasis" style="white-space: nowrap">
                      {{ formatTime(entry.lastWriteTime) }}
                    </td>
                    <td class="text-center" @click.stop @dblclick.stop>
                      <v-menu location="bottom end">
                        <template #activator="{ props }">
                          <v-btn
                            v-bind="props"
                            icon="mdi-dots-horizontal"
                            variant="text"
                            size="x-small"
                            title="更多操作"
                            aria-label="更多操作"
                          />
                        </template>
                        <v-list density="compact">
                          <v-list-item
                            prepend-icon="mdi-open-in-new"
                            title="打开"
                            @click="openEntry(entry)"
                          />
                          <v-list-item
                            v-if="isImageFile(entry.name)"
                            prepend-icon="mdi-image-search-outline"
                            title="预览"
                            @click="openImagePreview(entry)"
                          />
                          <v-list-item
                            prepend-icon="mdi-download-outline"
                            title="下载"
                            @click="download(entry)"
                          />
                          <v-list-item
                            prepend-icon="mdi-rename-outline"
                            title="重命名"
                            @click="openRenameSelected(entry)"
                          />
                          <v-list-item
                            prepend-icon="mdi-delete-outline"
                            title="删除"
                            @click="openDeleteSelected(entry)"
                          />
                        </v-list>
                      </v-menu>
                    </td>
                  </tr>
                </transition-group>
              </v-table>

              <div v-if="!sortedItems.length" class="pa-8 text-center">
                <v-icon
                  icon="mdi-folder-open-outline"
                  size="48"
                  class="text-medium-emphasis mb-2"
                />
                <div class="text-body-1 text-medium-emphasis">空目录</div>
              </div>
            </template>
          </div>

          <v-divider />
          <div class="d-flex align-center pa-3 flex-shrink-0">
            <span class="text-caption text-medium-emphasis">
              共 {{ sortedItems.length }} 项
              <template v-if="clipboard">
                · 剪贴板：{{ clipboard.mode === 'copy' ? '复制' : '剪切' }}
                {{ clipboard.sources.length }} 项
              </template>
            </span>
            <v-spacer />
            <span v-if="selected.size" class="text-caption text-medium-emphasis">
              已选 {{ selected.size }} 项
            </span>
          </div>
        </div>

        <transition name="editor-panel">
          <div v-if="editorOpen" class="editor-mount" :class="{ 'editor-mount--desktop': mdAndUp }">
            <div
              v-if="mdAndUp"
              class="split-divider"
              :class="{ 'split-divider--dragging': dragging }"
              @mousedown.prevent="startDrag"
            />

            <div class="split-right">
              <FileEditorPanel
                :open="editorOpen"
                :path="editorPath"
                :name="editorName"
                @close="closeEditor"
                @saved="onEditorSaved"
                @revert-path="onRevertPath"
              />
            </div>
          </div>
        </transition>
      </div>
    </div>

    <!-- 新建 / 重命名 对话框 -->
    <v-dialog v-model="nameDialog.open" max-width="420" persistent>
      <v-card class="glass-card pa-4">
        <v-card-title class="text-body-1 font-weight-bold px-0 pt-0">
          {{
            nameDialog.kind === 'folder'
              ? '新建文件夹'
              : nameDialog.kind === 'file'
                ? '新建文件'
                : '重命名'
          }}
        </v-card-title>
        <v-card-text class="px-0">
          <v-alert
            v-if="nameDialog.error"
            type="error"
            density="compact"
            variant="tonal"
            class="mb-3"
          >
            {{ nameDialog.error }}
          </v-alert>
          <v-text-field
            v-model="nameDialog.name"
            :label="nameDialog.kind === 'rename' ? '新名称' : '名称'"
            variant="outlined"
            density="compact"
            autofocus
            hide-details
            @keyup.enter="submitNameDialog"
          />
          <v-textarea
            v-if="nameDialog.kind === 'file'"
            v-model="nameDialog.content"
            label="初始内容（可选）"
            variant="outlined"
            density="compact"
            rows="5"
            class="mt-3"
            hide-details
          />
        </v-card-text>
        <v-card-actions class="px-0 pb-0">
          <v-spacer />
          <v-btn variant="text" @click="nameDialog.open = false">取消</v-btn>
          <v-btn
            color="primary"
            variant="tonal"
            :loading="nameDialog.loading"
            @click="submitNameDialog"
          >
            确定
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 删除确认 -->
    <v-dialog v-model="deleteDialog.open" max-width="420">
      <v-card class="glass-card pa-4">
        <v-card-title class="text-body-1 font-weight-bold px-0 pt-0">确认删除</v-card-title>
        <v-card-text class="px-0">
          确定要删除选中的 {{ deleteDialog.paths.length }} 项吗？删除后将进入系统回收站。
        </v-card-text>
        <v-card-actions class="px-0 pb-0">
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog.open = false">取消</v-btn>
          <v-btn color="error" variant="tonal" :loading="deleteDialog.loading" @click="doDelete">
            删除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- SQLite 工作区（全屏覆盖，内容窗口缩小并居中） -->
    <v-dialog v-model="sqliteOpen" fullscreen persistent>
      <div class="sqlite-overlay">
        <div class="sqlite-overlay--boxed">
          <SqlitePanel :db-path="dbPath" :db-name="dbName" @back="closeSqlite" />
        </div>
      </div>
    </v-dialog>

    <!-- 图片预览（复用 Chat 的 ImageViewer） -->
    <ImageViewer v-model:open="viewerOpen" v-model:src="viewerSrc" />
  </div>
</template>

<style scoped>
/* SQLite 工作区模态覆盖层 */
.sqlite-overlay {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.sqlite-overlay--boxed {
  width: min(1400px, 100%);
  height: 100%;
  display: flex;
}

.sqlite-overlay--boxed > * {
  flex: 1 1 auto;
  min-width: 0;
}

/* 左右分割布局 */
.split-view {
  display: flex;
  gap: 10px;
  height: calc(100vh - 300px);
  min-height: 420px;
}

.split-left {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.split-left--fixed {
  flex: 0 0 auto;
}

.split-right {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
}

.editor-mount {
  display: flex;
  gap: 10px;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.editor-mount--desktop {
  position: relative;
}

/* 小屏：编辑器覆盖整个视口（等效全屏模态），组件保持挂载不丢状态 */
@media (max-width: 959px) {
  .editor-mount {
    position: fixed;
    inset: 0;
    z-index: 100;
    padding: 12px;
    background: rgb(var(--v-theme-surface));
  }
}

.split-divider {
  width: 8px;
  flex-shrink: 0;
  cursor: col-resize;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  transition: background-color 0.2s ease;
}

.split-divider:hover,
.split-divider--dragging {
  background: rgba(var(--v-theme-primary), 0.45);
}

.split-table-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

/* 小屏时上下堆叠 */
.split-view--stacked {
  flex-direction: column;
  height: calc(100vh - 280px);
}

.split-view--stacked .split-left {
  width: 100%;
  height: 100%;
}

/* 编辑器面板出现/消失过渡 */
.editor-panel-enter-active,
.editor-panel-leave-active {
  transition:
    opacity 0.25s var(--transition-smooth),
    transform 0.25s var(--transition-smooth);
}

.editor-panel-enter-from,
.editor-panel-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

.file-row {
  transition: background-color 0.2s ease;
}

.file-row td:nth-child(2) {
  cursor: pointer;
}

.file-row--dir {
  cursor: pointer;
}

.size-calc-btn {
  font-size: 0.75rem;
  padding: 0 6px;
}

/* 搜索框与结果下拉 */
.search-wrap {
  position: relative;
  flex: 0 0 340px;
}

/* 搜索输入框缩小字号（.v-field 默认 font-size:16px，输入框继承它；
   v-text-field 是子组件，内部元素需用 :deep() 穿透 scoped） */
.search-wrap :deep(.v-field) {
  font-size: 0.8125rem !important;
}

/* 搜索输入框填满 .search-wrap（v-text-field 默认宽度由内容决定） */
.search-wrap .v-text-field {
  width: 100%;
}

/* 下拉结果列表项缩小字号 */
.search-wrap .search-list .v-list-item-title,
.search-wrap .search-list .v-list-item-subtitle {
  font-size: 0.8125rem;
}

/* 面包屑按内容宽度展示，不挤占搜索框空间 */
.search-breadcrumbs {
  flex: 0 1 auto;
  min-width: 80px;
  max-width: calc(100% - 360px);
  overflow-x: auto;
  overflow-y: hidden;
  font-size: 0.8125rem;
}

/* 面包屑每一项缩小字号；不省略，超长时由容器横向滚动 */
.search-breadcrumbs .v-breadcrumbs-item {
  font-size: 0.8125rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.search-breadcrumbs .v-breadcrumbs-item--link {
  color: rgb(var(--v-theme-primary));
}

.search-breadcrumbs .v-breadcrumbs-divider {
  flex-shrink: 0;
}

/* 窄屏：搜索框换行到下一行，面包屑占满整行并支持横向滚动 */
@media (max-width: 600px) {
  .search-breadcrumbs {
    max-width: 100%;
    min-width: 0;
  }
}

/* 搜索框所在卡片：允许下拉结果溢出卡片边界（v-card 默认 overflow:hidden 会裁剪） */
.search-card {
  overflow: visible !important;
  position: relative;
  z-index: 60;
}

/* 搜索框靠右：撑开面包屑与搜索框之间的空间 */
.search-spacer {
  flex: 1 1 auto;
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  width: 340px;
  max-height: 320px;
  overflow: auto;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 10px;
  box-shadow: var(--glass-shadow);
  z-index: 50;
}

.search-state {
  display: flex;
  align-items: center;
  padding: 10px 12px;
}

.search-list {
  max-height: 280px;
  overflow: auto;
}

.sortable-th {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.sortable-th:hover {
  color: rgb(var(--v-theme-primary));
}

.file-row:hover {
  background: rgba(var(--v-theme-primary), 0.06);
}

/* 面包屑改为手型光标 */
.v-breadcrumbs-item {
  cursor: pointer;
}

/* 行入场动画：用 animation 而不是 transition，
   避免被 .file-row 的 background-color transition 覆盖导致不生效 */
.list-enter-active {
  animation: file-row-enter 0.35s var(--transition-spring) both;
}

@keyframes file-row-enter {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 目录切换时旧行淡出 */
.list-leave-active {
  transition: opacity 0.2s var(--transition-smooth);
}

.list-leave-to {
  opacity: 0;
}
</style>
