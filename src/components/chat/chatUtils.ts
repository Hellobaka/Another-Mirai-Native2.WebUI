import { MessageItemType } from '@/models'
import type { MessageItemBase, ChatMessage } from '@/models'

export function formatMsgTime(ts: number | string) {
  if (!ts) return ''
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000)
  const t = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 0) return t
  if (diffDays === 1) return `昨天 ${t}`
  return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')} ${t}`
}

export function formatReplyTime(ts: string | number): string {
  return formatMsgTime(ts)
}

export function replyPreview(items: MessageItemBase[]): string {
  return items
    .map((m) => {
      if (m.messageItemType === MessageItemType.Text) return (m as unknown as { content: string }).content
      if (m.messageItemType === MessageItemType.At) {
        const at = m as unknown as { target: number; allTarget: boolean }
        return at.allTarget ? '@全体成员' : `@${at.target}`
      }
      if (m.messageItemType === MessageItemType.Image) return '[图片]'
      if (m.messageItemType === MessageItemType.Record) return '[语音]'
      if (m.messageItemType === MessageItemType.Face || m.messageItemType === MessageItemType.Bface) return '[表情]'
      if (m.messageItemType === MessageItemType.Reply) return '[回复]'
      if (m.messageItemType === MessageItemType.File) return `[文件] ${(m as unknown as { fileName: string }).fileName}`
      return ''
    })
    .filter(Boolean)
    .join('') || '[消息]'
}

export function isPureMedia(items: MessageItemBase[]): boolean {
  const filtered = trimmedItems(items)
  if (filtered.length === 0) return false
  return filtered.every(
    (m) =>
      m.messageItemType === MessageItemType.Image ||
      m.messageItemType === MessageItemType.Record ||
      m.messageItemType === MessageItemType.File,
  )
}

export function isTextOnly(items: MessageItemBase[]): boolean {
  return items.every((m) => m.messageItemType === MessageItemType.Text)
}

export function itemText(m: MessageItemBase): string {
  return (m as unknown as { content?: string }).content ?? ''
}

export function trimmedItems(items: MessageItemBase[]): MessageItemBase[] {
  const result = items.map((m) => {
    if (m.messageItemType === MessageItemType.Text) {
      const trimmed = itemText(m).trim()
      return { ...m, content: trimmed } as unknown as MessageItemBase
    }
    return m
  })
  return result.filter((m) => {
    if (m.messageItemType !== MessageItemType.Text) return true
    return itemText(m).length > 0
  })
}

export function canCopy(msg: ChatMessage): boolean {
  return msg.message.some(
    (m) =>
      m.messageItemType === MessageItemType.Text ||
      m.messageItemType === MessageItemType.At ||
      m.messageItemType === MessageItemType.Image,
  )
}

export function canRepeat(msg: ChatMessage): boolean {
  return msg.message.every((m) =>
    [MessageItemType.Text, MessageItemType.At, MessageItemType.Image, MessageItemType.Face, MessageItemType.Bface].includes(m.messageItemType),
  )
}

export function hasImage(msg: ChatMessage): boolean {
  return msg.message.some((m) => m.messageItemType === MessageItemType.Image)
}

export function getImageHash(msg: ChatMessage): string {
  const img = msg.message.find((m) => m.messageItemType === MessageItemType.Image) as unknown as { hash?: string; filePath?: string | null } | undefined
  return img?.hash || img?.filePath || ''
}

export function msgToCqCode(msg: ChatMessage): string {
  return msg.message
    .map((m) => {
      if (m.messageItemType === MessageItemType.Text) return (m as unknown as { content: string }).content
      if (m.messageItemType === MessageItemType.At) {
        const at = m as unknown as { target: number; allTarget: boolean }
        return at.allTarget ? '[CQ:at,qq=all]' : `[CQ:at,qq=${at.target}]`
      }
      if (m.messageItemType === MessageItemType.Image) {
        const img = m as unknown as { hash?: string; filePath?: string | null }
        return `[CQ:image,file=${img.filePath || img.hash || ''}]`
      }
      if (m.messageItemType === MessageItemType.Face) return `[CQ:face,id=${(m as unknown as { faceId: number }).faceId}]`
      if (m.messageItemType === MessageItemType.Bface) return `[CQ:bface,id=${(m as unknown as { faceId: number }).faceId}]`
      return ''
    })
    .filter(Boolean)
    .join('')
}

export function msgToText(msg: ChatMessage): string {
  return msg.message
    .map((m) => {
      if (m.messageItemType === MessageItemType.Text) return (m as unknown as { content: string }).content
      if (m.messageItemType === MessageItemType.At) {
        const at = m as unknown as { target: number; allTarget: boolean }
        return at.allTarget ? '@全体成员' : `@${at.target}`
      }
      return ''
    })
    .filter(Boolean)
    .join('')
}

export function formatFileSize(kb: number): string {
  if (kb >= 1073741824) return `${(kb / 1073741824).toFixed(1)} GB`
  if (kb >= 1048576) return `${(kb / 1048576).toFixed(1)} MB`
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} KB`
  if (kb >= 1) return `${kb.toFixed(0)} B`
  return `${kb} B`
}
