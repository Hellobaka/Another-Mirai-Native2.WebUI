import { defineStore } from 'pinia'
import { computed } from 'vue'
import { hubStatus, startConnection, stopConnection } from '@/signalr/hub'
import { SignalREvents } from '@/signalr/events'

type AnyHandler = (...args: any[]) => void

export const useHubStore = defineStore('hub', () => {
  const connectionStatus = computed(() => hubStatus.value)
  const isConnected = computed(() => hubStatus.value === 'connected')

  // Component-level subscriber sets, keyed by event name
  const subscribers = new Map<string, Set<AnyHandler>>()

  // Whether SignalR→store dispatchers have been registered on the current connection
  let dispatchersRegistered = false

  function registerDispatchers(conn: { on: (event: string, handler: AnyHandler) => void }) {
    for (const eventName of Object.values(SignalREvents)) {
      conn.on(eventName, (...args: any[]) => {
        subscribers.get(eventName)?.forEach((h) => h(...args))
      })
    }
    dispatchersRegistered = true
  }

  async function connect(token: string): Promise<void> {
    try {
      const conn = await startConnection(token)
      if (!dispatchersRegistered) {
        registerDispatchers(conn)
      }
    } catch {
      // Silent — withAutomaticReconnect handles retries
    }
  }

  async function disconnect(): Promise<void> {
    dispatchersRegistered = false
    await stopConnection()
  }

  function on(event: string, handler: AnyHandler): void {
    if (!subscribers.has(event)) subscribers.set(event, new Set())
    subscribers.get(event)!.add(handler)
  }

  function off(event: string, handler: AnyHandler): void {
    subscribers.get(event)?.delete(handler)
  }

  return { connectionStatus, isConnected, connect, disconnect, on, off }
})
