import { defineStore } from 'pinia'
import { reactive } from 'vue'

type Severity = 'success' | 'error' | 'warning' | 'info'

interface Notification {
  id: number
  message: string
  severity: Severity
  persistent: boolean
  duration: number
  remaining: number
}

let nextId = 0
const DEFAULT_DURATION = 4000

export const useNotifyStore = defineStore('notify', () => {
  const queue = reactive<Notification[]>([])

  function show(message: string, severity: Severity = 'info') {
    const persistent = severity === 'error' || severity === 'warning'
    const duration = persistent ? 0 : DEFAULT_DURATION
    queue.push({
      id: ++nextId,
      message,
      severity,
      persistent,
      duration,
      remaining: duration,
    })

    if (!persistent) {
      startCountdown(nextId)
    }
  }

  function startCountdown(id: number) {
    const idx = queue.findIndex((x) => x.id === id)
    if (idx === -1) return

    const step = 100
    const interval = setInterval(() => {
      const i = queue.findIndex((x) => x.id === id)
      if (i === -1) { clearInterval(interval); return }

      queue[i].remaining -= step
      if (queue[i].remaining <= 0) {
        clearInterval(interval)
        dismiss(id)
      }
    }, step)
  }

  function dismiss(id: number) {
    const idx = queue.findIndex((n) => n.id === id)
    if (idx !== -1) queue.splice(idx, 1)
  }

  function clear() { queue.splice(0) }

  function success(message: string) { show(message, 'success') }
  function error(message: string) { show(message, 'error') }
  function warning(message: string) { show(message, 'warning') }
  function info(message: string) { show(message, 'info') }

  return { queue, show, clear, success, error, warning, info, dismiss }
})
