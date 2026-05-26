import {
  HubConnectionBuilder,
  HubConnection,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr'
import { ref } from 'vue'
import { getApiBaseUrl } from '@/api/baseUrl'

export type HubStatus = 'connected' | 'reconnecting' | 'disconnected'

let connection: HubConnection | null = null

export const hubStatus = ref<HubStatus>('disconnected')

export function getHubConnection(): HubConnection | null {
  return connection
}

export async function startConnection(token: string): Promise<HubConnection> {
  if (connection?.state === HubConnectionState.Connected) {
    return connection
  }

  if (connection) {
    await connection.stop()
    connection = null
  }

  const baseUrl = getApiBaseUrl() || import.meta.env.VITE_HUB_BASE_URL || ''
  connection = new HubConnectionBuilder()
    .withUrl(`${baseUrl}/realtime?access_token=${token}`)
    .configureLogging(LogLevel.Warning)
    .withAutomaticReconnect()
    .build()

  connection.onreconnecting(() => {
    hubStatus.value = 'reconnecting'
  })
  connection.onreconnected(() => {
    hubStatus.value = 'connected'
  })
  connection.onclose(() => {
    hubStatus.value = 'disconnected'
  })

  await connection.start()
  hubStatus.value = 'connected'
  return connection
}

export async function stopConnection(): Promise<void> {
  if (connection) {
    await connection.stop()
    connection = null
  }
  hubStatus.value = 'disconnected'
}
