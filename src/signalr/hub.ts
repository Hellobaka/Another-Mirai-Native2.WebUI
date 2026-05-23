import {
  HubConnectionBuilder,
  HubConnection,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr'

let connection: HubConnection | null = null

export function getHubConnection(): HubConnection | null {
  return connection
}

export async function startConnection(token: string): Promise<HubConnection> {
  if (connection?.state === HubConnectionState.Connected) {
    return connection
  }

  const hubUrl = `/hub/amn?access_token=${token}`

  connection = new HubConnectionBuilder()
    .withUrl(hubUrl)
    .configureLogging(LogLevel.Information)
    .withAutomaticReconnect()
    .build()

  await connection.start()
  return connection
}

export async function stopConnection(): Promise<void> {
  if (connection) {
    await connection.stop()
    connection = null
  }
}
