<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { replyPreview } from './chatUtils'
import { cacheUrl } from '@/api/cache'

type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'face'; id: number }
  | { kind: 'at'; qq: number }
  | { kind: 'reply'; id: number }
  | { kind: 'image'; file: string }

const model = defineModel<string>({ default: '' })

import type { ChatMessage } from '@/models'

const props = defineProps<{
  disabled?: boolean
  replyCache?: Record<number, ChatMessage | null>
  getNick?: (qq: number) => string
}>()

const emit = defineEmits<{
  send: []
  'image-paste': [file: File]
}>()

const root = ref<HTMLDivElement | null>(null)
const segments = ref<Segment[]>([])
const focused = ref(false)

// ── Parse CQ codes from input string into segments ──
function parseToSegments(raw: string): Segment[] {
  const result: Segment[] = []
  const re = /\[CQ:(\w+)(?:,([^\]]*))?\]/g
  let lastIdx = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    if (m.index > lastIdx) {
      result.push({ kind: 'text', text: raw.slice(lastIdx, m.index) })
    }
    const type = m[1]
    const args = m[2] || ''
    const kv: Record<string, string> = {}
    args.split(',').forEach((p) => {
      const eq = p.indexOf('=')
      if (eq > 0) kv[p.slice(0, eq)] = p.slice(eq + 1)
    })
    if (type === 'face') {
      result.push({ kind: 'face', id: Number(kv.id) || 0 })
    } else if (type === 'at') {
      result.push({ kind: 'at', qq: kv.qq === 'all' ? 0 : Number(kv.qq) || 0 })
    } else if (type === 'reply') {
      result.push({ kind: 'reply', id: Number(kv.id) || 0 })
    } else if (type === 'image') {
      result.push({ kind: 'image', file: kv.file || '' })
    } else {
      result.push({ kind: 'text', text: m[0] })
    }
    lastIdx = re.lastIndex
  }
  if (lastIdx < raw.length) {
    result.push({ kind: 'text', text: raw.slice(lastIdx) })
  }
  if (result.length === 0) result.push({ kind: 'text', text: '' })
  return result
}

// ── Serialize segments back to CQ code string ──
function segmentsToCqCode(segs: Segment[]): string {
  return segs
    .map((s) => {
      if (s.kind === 'text') return s.text
      if (s.kind === 'face') return `[CQ:face,id=${s.id}]`
      if (s.kind === 'at') return s.qq === 0 ? '[CQ:at,qq=all]' : `[CQ:at,qq=${s.qq}]`
      if (s.kind === 'reply') return `[CQ:reply,id=${s.id}]`
      if (s.kind === 'image') return `[CQ:image,file=${s.file}]`
      return ''
    })
    .join('')
}

// ── Sync segments → model (CQ string) ──
function syncModel() {
  model.value = segmentsToCqCode(segments.value)
}

// ── Render segments to DOM ──
function render() {
  const el = root.value
  if (!el) return

  // Save cursor position
  const sel = window.getSelection()
  let cursorOffset = 0
  if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0)
    const preRange = document.createRange()
    preRange.selectNodeContents(el)
    preRange.setEnd(range.endContainer, range.endOffset)
    cursorOffset = preRange.toString().length
  }

  el.innerHTML = ''
  let charCount = 0
  let cursorNode: Node | null = null
  let cursorOffsetInNode = 0

  for (const seg of segments.value) {
    if (seg.kind === 'text') {
      const textNode = document.createTextNode(seg.text)
      el.appendChild(textNode)
      const len = seg.text.length
      if (!cursorNode && cursorOffset <= charCount + len) {
        cursorNode = textNode
        cursorOffsetInNode = cursorOffset - charCount
      }
      charCount += len
    } else {
      const span = document.createElement('span')
      span.className = 'rich-chip'
      span.contentEditable = 'false'
      span.setAttribute('data-kind', seg.kind)
      span.setAttribute('data-data', JSON.stringify(seg))

      if (seg.kind === 'face') {
        const img = document.createElement('img')
        img.src = `/qq-face/${seg.id}.png`
        img.className = 'rich-face-img'
        span.appendChild(img)
      } else if (seg.kind === 'at') {
        span.textContent = seg.qq === 0 ? '@全体成员' : `@${seg.qq}`
        span.className += ' rich-chip--at'
      } else if (seg.kind === 'reply') {
        span.className += ' rich-chip--reply-block'
        const replyData = props.replyCache?.[seg.id]
        if (replyData) {
          const nick = props.getNick?.(replyData.senderID) || String(replyData.senderID)
          const time = replyData.time ? new Date(replyData.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''
          const preview = replyPreview(replyData.message)
          span.innerHTML = `<div class="reply-chip-header">${nick}<span style="opacity:0.5;margin-left:4px">${time}</span></div><div class="reply-chip-body">${preview.slice(0, 50)}</div>`
        } else {
          span.textContent = `回复 #${seg.id}`
        }
      } else if (seg.kind === 'image') {
        span.className += ' rich-chip--image'
        const img = document.createElement('img')
        img.src = cacheUrl('image', seg.file)
        img.className = 'rich-image-thumb'
        span.appendChild(img)
      }

      // Zero-width space after chip for cursor placement
      const zwsp = document.createTextNode('​')
      el.appendChild(span)
      el.appendChild(zwsp)
      const segLen = 1 // chip counts as 1 char
      if (!cursorNode && cursorOffset <= charCount + segLen) {
        cursorNode = zwsp
        cursorOffsetInNode = 0
      }
      charCount += segLen
    }
  }

  // Empty placeholder
  if (el.childNodes.length === 0) {
    const br = document.createElement('br')
    el.appendChild(br)
  }

  // Restore cursor
  if (cursorNode && sel) {
    try {
      const range = document.createRange()
      range.setStart(cursorNode, Math.min(cursorOffsetInNode, (cursorNode.textContent || '').length))
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    } catch { /* */ }
  }
}

// ── Extract segments from current DOM ──
function extractSegments(): Segment[] {
  const el = root.value
  if (!el) return []
  const result: Segment[] = []

  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      // Filter out zero-width spaces
      const clean = text.replace(/​/g, '')
      if (clean) result.push({ kind: 'text', text: clean })
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as HTMLElement
      if (elem.classList.contains('rich-chip')) {
        const data = elem.getAttribute('data-data')
        if (data) {
          try { result.push(JSON.parse(data)) } catch { /* */ }
        }
      }
    }
  })

  if (result.length === 0) result.push({ kind: 'text', text: '' })
  return result
}

// ── Input handler ──
function onInput() {
  segments.value = extractSegments()
  syncModel()
}

// ── Keydown handler ──
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    emit('send')
    return
  }

  // Backspace: if previous sibling is a chip, remove it
  if (e.key === 'Backspace') {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    if (!range.collapsed) return // let browser handle selection delete

    const node = range.startContainer
    const offset = range.startOffset

    // If cursor is at start of a text node right after a chip (ZWSP), delete the chip
    if (node.nodeType === Node.TEXT_NODE && offset === 0 && node.previousSibling) {
      const prev = node.previousSibling
      if (prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).classList.contains('rich-chip')) {
        e.preventDefault()
        prev.remove()
        if (node.textContent === '​') node.remove()
        onInput()
        return
      }
    }

    // If cursor is right after a chip (in ZWSP), select and delete chip
    if (node.nodeType === Node.TEXT_NODE && node.textContent === '​') {
      const prev = node.previousSibling
      if (prev && prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).classList.contains('rich-chip')) {
        e.preventDefault()
        prev.remove()
        node.remove()
        onInput()
        return
      }
    }
  }
}

// ── Copy handler: convert rendered chips back to CQ codes ──
function onCopy(e: ClipboardEvent) {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return
  const range = sel.getRangeAt(0)
  const fragment = range.cloneContents()
  const div = document.createElement('div')
  div.appendChild(fragment)

  // Walk cloned nodes and convert chips back to CQ
  let text = ''
  div.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += (node.textContent || '').replace(/​/g, '')
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as HTMLElement
      if (elem.classList.contains('rich-chip')) {
        const data = elem.getAttribute('data-data')
        if (data) {
          try {
            const seg: Segment = JSON.parse(data)
            if (seg.kind === 'face') text += `[CQ:face,id=${seg.id}]`
            else if (seg.kind === 'at') text += seg.qq === 0 ? '[CQ:at,qq=all]' : `[CQ:at,qq=${seg.qq}]`
            else if (seg.kind === 'reply') text += `[CQ:reply,id=${seg.id}]`
            else if (seg.kind === 'image') text += `[CQ:image,file=${seg.file}]`
          } catch { /* */ }
        }
      }
    }
  })

  e.clipboardData?.setData('text/plain', text)
  e.preventDefault()
}

// ── Paste handler ──
function onPaste(e: ClipboardEvent) {
  // Check for images first
  const items = e.clipboardData?.items
  if (items) {
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) emit('image-paste', file)
        return
      }
    }
  }
  // Plain text paste
  const text = e.clipboardData?.getData('text/plain')
  if (text) {
    e.preventDefault()
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      range.insertNode(document.createTextNode(text))
      range.collapse(false)
    }
    onInput()
  }
}

// ── Insert a segment from outside ──
function insertSegment(seg: Segment) {
  segments.value = [...segments.value.filter(s => s.kind !== 'text' || s.text !== ''), seg]
  // If there's no trailing text segment, add one
  const last = segments.value[segments.value.length - 1]
  if (last && last.kind !== 'text') {
    segments.value.push({ kind: 'text', text: '' })
  }
  syncModel()
  nextTick(render)
  root.value?.focus()
}

// ── Clear ──
function clear() {
  segments.value = [{ kind: 'text', text: '' }]
  syncModel()
  nextTick(render)
}

// ── Watch for external model changes (e.g., from insertEmoji) ──
watch(() => model.value, (val) => {
  const expected = segmentsToCqCode(segments.value)
  if (val !== expected) {
    segments.value = parseToSegments(val)
    nextTick(render)
  }
})

// ── Track focus for styling ──
function onFocus() { focused.value = true }
function onBlur() { focused.value = false }

onMounted(() => {
  segments.value = parseToSegments(model.value || '')
  render()
})

// Re-render when reply data arrives
watch(() => props.replyCache, () => {
  const hasReply = segments.value.some(s => s.kind === 'reply')
  if (hasReply) render()
}, { deep: true })

defineExpose({ insertSegment, clear })
</script>

<template>
  <div
    ref="root"
    class="rich-input"
    :class="{ 'rich-input--focused': focused, 'rich-input--disabled': disabled }"
    contenteditable="true"
    :disabled="disabled"
    @input="onInput"
    @keydown="onKeydown"
    @copy="onCopy"
    @paste="onPaste"
    @focus="onFocus"
    @blur="onBlur"
  />
</template>

<style scoped>
.rich-input {
  min-height: 40px;
  max-height: 180px;
  overflow-y: auto;
  padding: 8px 14px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.22);
  border-radius: 8px;
  outline: none;
  font-size: 0.875rem;
  line-height: 1.6;
  word-break: break-word;
  cursor: text;
  background: transparent;
  transition: border-color 0.2s ease;
}
.rich-input--focused {
  border-color: rgb(var(--v-theme-primary));
}
.rich-input--disabled {
  opacity: 0.5;
  pointer-events: none;
}
.rich-input:empty::before {
  content: '输入消息... (Enter 发送，Shift+Enter 换行)';
  color: rgba(var(--v-theme-on-surface), 0.45);
  pointer-events: none;
}

:deep(.rich-chip) {
  display: inline;
  vertical-align: middle;
  padding: 1px 6px;
  margin: 0 1px;
  border-radius: 5px;
  font-size: 0.8rem;
  user-select: all;
  cursor: default;
}
:deep(.rich-chip--at) {
  background: rgba(var(--v-theme-primary), 0.15);
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
}
:deep(.rich-chip--reply-block) {
  display: block;
  border-left: 3px solid rgb(var(--v-theme-primary));
  padding: 4px 10px;
  margin: 4px 0;
  background: rgba(var(--v-theme-primary), 0.08);
  border-radius: 0 8px 8px 0;
}
:deep(.reply-chip-header) {
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
  font-size: 0.7rem;
  margin-bottom: 2px;
}
:deep(.reply-chip-body) {
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}
:deep(.rich-chip--image) {
  display: inline-block;
  vertical-align: middle;
  padding: 0;
  border-radius: 6px;
  overflow: hidden;
  line-height: 0;
}
:deep(.rich-image-thumb) {
  max-height: 200px;
  max-width: 200px;
  object-fit: cover;
  display: block;
}

:deep(.rich-face-img) {
  width: 22px;
  height: 22px;
  vertical-align: middle;
  pointer-events: none;
}
</style>
