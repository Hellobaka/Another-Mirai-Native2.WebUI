/** 当前协议连接状态 (GET /api/protocol/current) */
export interface ProtocolStatusData {
  /** 协议名称 */
  name: string
  /** 是否已连接 */
  isConnected: boolean
}
