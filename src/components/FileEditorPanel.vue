<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import 'monaco-editor/nls/lang/zh-cn.js'
import * as monaco from 'monaco-editor'
import { useAppStore } from '@/stores/app'
import { useNotifyStore } from '@/stores/notify'
import { readTextFile, writeTextFile } from '@/api/file'
import { getErrorMessage } from '@/api/client'

const props = defineProps<{
  open: boolean
  path: string
  name: string
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const app = useAppStore()
const notify = useNotifyStore()

const LANG_BY_EXT: Record<string, string> = {
  json: 'json',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  html: 'html',
  htm: 'html',
  vue: 'html',
  css: 'css',
  scss: 'css',
  less: 'css',
  md: 'markdown',
  xml: 'xml',
  svg: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  ini: 'ini',
  conf: 'ini',
  cfg: 'ini',
  toml: 'ini',
  sql: 'sql',
  py: 'python',
  cs: 'csharp',
  bat: 'bat',
  cmd: 'bat',
  ps1: 'powershell',
  sh: 'shell',
  bash: 'shell',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  go: 'go',
  rs: 'rust',
  php: 'php',
  rb: 'ruby',
  kt: 'kotlin',
}

function langForName(name: string): string {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  return LANG_BY_EXT[ext] ?? 'plaintext'
}

const LANG_LABELS: Record<string, string> = {
  plaintext: '纯文本',
  json: 'JSON',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  less: 'Less',
  markdown: 'Markdown',
  yaml: 'YAML',
  xml: 'XML',
  sql: 'SQL',
  python: 'Python',
  csharp: 'C#',
  bat: '批处理',
  powershell: 'PowerShell',
  shell: 'Shell 脚本',
  ini: 'INI',
}

// 支持的编码（与后端 text 接口一致；空值 = 自动探测）
const ENCODING_OPTIONS: { label: string; value: string }[] = [
  { label: '自动检测', value: '' },
  { label: 'UTF-8', value: 'utf-8' },
  { label: 'GBK', value: 'gbk' },
  { label: 'ANSI', value: 'ansi' },
  { label: 'GB18030', value: 'gb18030' },
  { label: 'UTF-16', value: 'utf-16' },
  { label: 'UTF-16 BE', value: 'utf-16be' },
]

const languageLabel = computed(() => {
  if (!props.open) return '未打开'
  return LANG_LABELS[languageId.value] ?? languageId.value
})

const loading = ref(false)
const saving = ref(false)
const encoding = ref('')
const selectedEncoding = ref('')
const error = ref('')
const languageId = ref('plaintext')
const editorEl = ref<HTMLElement | null>(null)
const showPathTooltip = ref(false)
let suppressReadError = false

const encodingDisplay = computed(() => {
  if (selectedEncoding.value) {
    return (
      ENCODING_OPTIONS.find((o) => o.value === selectedEncoding.value)?.label ??
      selectedEncoding.value
    )
  }
  return encoding.value || '自动'
})

async function selectEncoding(value: string) {
  if (value === selectedEncoding.value) return
  const previous = selectedEncoding.value
  // 切换编码期间不展示错误：解码失败时静默回退
  suppressReadError = true
  selectedEncoding.value = value
  const ok = await loadContent()
  suppressReadError = false
  if (!ok) {
    selectedEncoding.value = previous
    await loadContent()
  }
}

// ── 缩进方式与状态栏信息 ──
type IndentStyle = 'tab' | 'spaces'

const INDENT_STYLE_KEY = 'amn_editor_indent_style'
const INDENT_SIZE_KEY = 'amn_editor_indent_size'
const INDENT_SIZES = [2, 4, 8]
const INDENT_OPTIONS: { label: string; value: IndentStyle; sizes: number[] }[] = [
  { label: '制表符', value: 'tab', sizes: INDENT_SIZES },
  { label: '空格', value: 'spaces', sizes: INDENT_SIZES },
]

const indentStyle = ref<IndentStyle>(
  localStorage.getItem(INDENT_STYLE_KEY) === 'tab' ? 'tab' : 'spaces',
)
const indentSize = ref(
  INDENT_SIZES.includes(Number(localStorage.getItem(INDENT_SIZE_KEY)))
    ? Number(localStorage.getItem(INDENT_SIZE_KEY))
    : 2,
)

const charCount = ref(0)
const cursorLine = ref(1)
const cursorCol = ref(1)

const indentLabel = computed(() =>
  indentStyle.value === 'spaces' ? `空格: ${indentSize.value}` : `制表符: ${indentSize.value}`,
)

function setIndent(style: IndentStyle, size: number) {
  indentStyle.value = style
  indentSize.value = size
  currentModel?.updateOptions({ tabSize: size, insertSpaces: style === 'spaces' })
  localStorage.setItem(INDENT_STYLE_KEY, style)
  localStorage.setItem(INDENT_SIZE_KEY, String(size))
}

let editor: monaco.editor.IStandaloneCodeEditor | null = null
let currentModel: monaco.editor.ITextModel | null = null

watch(
  () => app.effectiveTheme,
  (theme) => {
    monaco.editor.setTheme(theme === 'light' ? 'vs' : 'vs-dark')
  },
  { immediate: true },
)

watch(
  [() => props.open, () => props.path],
  async ([open]) => {
    if (!open) {
      disposeEditor()
      return
    }
    selectedEncoding.value = ''
    await loadContent()
  },
  { immediate: true },
)

async function loadContent(): Promise<boolean> {
  loading.value = true
  error.value = ''
  let ok = false
  try {
    const res = await readTextFile(props.path, selectedEncoding.value)
    if (res.data.code === 0) {
      encoding.value = res.data.data.encoding
      await nextTick()
      ensureEditor()
      setModel(res.data.data.content, langForName(props.name))
      ok = true
    } else if (!suppressReadError) {
      error.value = res.data.message || '读取文件失败'
    }
  } catch (e) {
    if (!suppressReadError) error.value = getErrorMessage(e, '读取文件失败')
  } finally {
    loading.value = false
  }
  return ok
}

function ensureEditor() {
  if (editor || !editorEl.value) return
  editor = monaco.editor.create(editorEl.value, {
    value: '',
    language: 'plaintext',
    theme: app.effectiveTheme === 'light' ? 'vs' : 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    tabSize: 2,
    wordWrap: 'on',
    renderWhitespace: 'selection',
  })
  editor.onDidChangeModelContent(() => {
    if (editor) charCount.value = editor.getValue().length
  })
  editor.onDidChangeCursorPosition((e) => {
    cursorLine.value = e.position.lineNumber
    cursorCol.value = e.position.column
  })
}

function setModel(value: string, language: string) {
  if (!editor) return
  const model = monaco.editor.createModel(value, language, undefined, {
    tabSize: indentSize.value,
    insertSpaces: indentStyle.value === 'spaces',
  })
  editor.setModel(model)
  if (currentModel) currentModel.dispose()
  currentModel = model
  languageId.value = language
  charCount.value = value.length
  cursorLine.value = 1
  cursorCol.value = 1
}

function disposeEditor() {
  if (currentModel) {
    currentModel.dispose()
    currentModel = null
  }
  if (editor) {
    editor.dispose()
    editor = null
  }
  encoding.value = ''
  languageId.value = 'plaintext'
  charCount.value = 0
  cursorLine.value = 1
  cursorCol.value = 1
}

async function formatDocument() {
  if (!editor || saving.value) return
  const isJson = languageId.value === 'json'
  if (isJson) {
    try {
      JSON.parse(editor.getValue())
    } catch {
      notify.error('JSON 格式错误')
      return
    }
  }
  const action = editor.getAction('editor.action.formatDocument')
  if (action) await action.run()
  if (isJson) notify.success('JSON 已格式化')
}

async function save() {
  if (!editor || saving.value) return
  saving.value = true
  error.value = ''
  try {
    const res = await writeTextFile(props.path, editor.getValue(), selectedEncoding.value)
    if (res.data.code === 0) {
      notify.success('文件已保存')
      emit('saved')
    } else {
      error.value = res.data.message || '保存失败'
    }
  } catch (e) {
    error.value = getErrorMessage(e, '保存文件失败')
  } finally {
    saving.value = false
  }
}

function close() {
  emit('close')
}

function onInfoClick() {
  // PC 端悬停展示；移动端点击切换展示
  showPathTooltip.value = !showPathTooltip.value
}

onBeforeUnmount(() => {
  disposeEditor()
})
</script>

<template>
  <v-card class="glass-card editor-panel d-flex flex-column" height="100%">
    <!-- 头部 -->
    <div class="d-flex align-center ga-2 px-3 py-2" style="min-width: 0">
      <v-icon icon="mdi-file-document-edit-outline" size="small" class="text-medium-emphasis" />
      <div class="flex-grow-1 text-truncate" style="min-width: 0">
        <div class="file-name text-truncate">{{ name || '未打开文件' }}</div>
      </div>
      <v-tooltip v-model="showPathTooltip" :text="path" location="bottom" max-width="420">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            icon="mdi-information-outline"
            variant="text"
            size="x-small"
            density="comfortable"
            class="text-medium-emphasis"
            :disabled="!open"
            @click.stop="onInfoClick"
          />
        </template>
      </v-tooltip>
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="mdi-format-align-left"
        :disabled="!open || loading || saving || !!error"
        @click="formatDocument"
      >
        格式化
      </v-btn>
      <v-btn
        size="small"
        color="primary"
        variant="tonal"
        prepend-icon="mdi-content-save-outline"
        :loading="saving"
        :disabled="!open || loading || !!error"
        @click="save"
      >
        保存
      </v-btn>
      <v-btn size="small" icon="mdi-close" variant="text" :disabled="!open" @click="close" />
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="flex-shrink-0" />

    <v-divider />

    <!-- 主体 -->
    <div class="flex-grow-1 editor-body" style="min-height: 0">
      <!-- 文件格式不支持时的空状态 -->
      <div v-if="open && error" class="editor-unsupported">
        <v-icon icon="mdi-file-alert-outline" size="52" class="text-medium-emphasis mb-3" />
        <div class="text-body-1 text-medium-emphasis">
          {{ error }}
        </div>
      </div>

      <div
        v-if="open"
        ref="editorEl"
        class="monaco-host"
        :class="{
          'monaco-host--hidden': loading || !!error,
          'monaco-host--ready': !loading && !error,
        }"
      />

      <v-fade-transition>
        <div v-if="open && loading" class="editor-overlay">
          <v-progress-circular indeterminate color="primary" size="36" />
          <span class="text-caption text-medium-emphasis mt-2">正在加载文件…</span>
        </div>
      </v-fade-transition>

      <div v-if="!open" class="editor-placeholder">
        <v-icon icon="mdi-file-document-outline" size="56" class="text-medium-emphasis mb-3" />
        <div class="text-body-1 text-medium-emphasis">未打开文件</div>
        <div class="text-caption text-medium-emphasis">单击左侧文件即可开始编辑</div>
      </div>
    </div>

    <v-divider />

    <!-- 状态栏 -->
    <div class="d-flex align-center px-3 py-1 status-bar">
      <span class="status-text">{{ languageLabel }}</span>
      <v-divider vertical length="12" class="mx-2" />
      <span class="status-text">字符 {{ charCount }}</span>
      <v-divider vertical length="12" class="mx-2" />
      <span class="status-text">Ln {{ cursorLine }}, Col {{ cursorCol }}</span>
      <v-spacer />
      <v-divider vertical length="12" class="mx-2" />
      <v-menu location="top end">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            size="x-small"
            variant="text"
            density="comfortable"
            class="status-btn"
            :disabled="!open || !!error"
          >
            {{ indentLabel }}
          </v-btn>
        </template>
        <v-list density="compact" min-width="180">
          <template v-for="opt in INDENT_OPTIONS" :key="opt.value">
            <v-list-subheader class="text-caption">{{ opt.label }}</v-list-subheader>
            <v-list-item
              v-for="size in opt.sizes"
              :key="opt.value + size"
              density="compact"
              :active="indentStyle === opt.value && indentSize === size"
              @click="setIndent(opt.value, size)"
            >
              <template #prepend>
                <v-icon
                  :icon="indentStyle === opt.value && indentSize === size ? 'mdi-check' : ''"
                  size="16"
                />
              </template>
              <v-list-item-title class="text-body-2">{{ size }}</v-list-item-title>
            </v-list-item>
          </template>
        </v-list>
      </v-menu>
      <template v-if="open">
        <v-divider vertical length="12" class="mx-2" />
        <v-menu location="top end">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              size="x-small"
              variant="text"
              density="comfortable"
              class="status-btn"
              :disabled="!open || !!error"
            >
              {{ encodingDisplay }}
            </v-btn>
          </template>
          <v-list density="compact" min-width="150">
            <v-list-item
              v-for="opt in ENCODING_OPTIONS"
              :key="opt.value"
              density="compact"
              :active="(opt.value || '') === (selectedEncoding || '')"
              @click="selectEncoding(opt.value)"
            >
              <template #prepend>
                <v-icon
                  :icon="(opt.value || '') === (selectedEncoding || '') ? 'mdi-check' : ''"
                  size="16"
                />
              </template>
              <v-list-item-title class="text-body-2">{{ opt.label }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </div>
  </v-card>
</template>

<style scoped>
.editor-panel {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.editor-body {
  position: relative;
}

.monaco-host {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.25s var(--transition-smooth);
}

.monaco-host--hidden {
  visibility: hidden;
}

.monaco-host--ready {
  opacity: 1;
}

.editor-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-surface), 0.55);
}

.editor-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* 文件格式不支持时的空状态：占满编辑器主体、垂直居中 */
.editor-unsupported {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
}

.file-name {
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.4;
}

.status-btn {
  font-size: 0.65rem;
  min-width: 0;
  padding: 0 8px;
}

.status-bar {
  min-height: 28px;
}

.status-bar :deep(.v-divider--vertical) {
  align-self: center;
}

.status-text {
  font-size: 0.65rem;
  line-height: 1.4;
  color: rgba(var(--v-theme-on-surface), 0.7);
  white-space: nowrap;
}
</style>
