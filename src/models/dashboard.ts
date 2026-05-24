/** 系统基础信息 (GET /api/dashboard/base-information) */
export interface DashboardInfoData {
  /** 操作系统名称与版本 */
  osVersion: string
  /** CPU 型号与基准频率 */
  cpu: string
  /** 物理内存总量（MB） */
  totalMemory: number
  /** 框架运行时长（DD:HH:MM:SS） */
  startedTime: string
  /** 框架版本号 */
  version: string
  /** 当前登录的 Bot QQ 号 */
  currentBotQQ: number
  /** 当前登录的 Bot 昵称 */
  currentBotNick: string
  /** 已启用的插件数量 */
  loadedPluginCount: number
  /** .NET 运行时版本 */
  dotNetRuntimeVersion: string
  /** 工作目录 */
  workingDirectory: string
  /** 磁盘可用空间（GB） */
  diskFreeSpaceInGB: number
  /** 磁盘总空间（GB） */
  diskTotalSpaceInGB: number
}

/** 系统资源占用 (GET /api/dashboard/usages) */
export interface UsageData {
  /** 系统整体 CPU 占用百分比 */
  cpuUsage: number
  /** 内存占用百分比 */
  memoryUsage: number
  /** 已用内存（MB） */
  usedMemoryInMB: number
  /** 总内存（MB） */
  totalMemoryInMB: number
}

/** 各进程资源占用汇总 (GET /api/dashboard/plugin-usages) */
export interface PluginUsageData {
  /** 所有进程内存合计（MB） */
  totalProcessMemory: number
  /** 所有进程 CPU 合计（%） */
  totalProcessCPU: number
  /** 今日已处理消息条数 */
  processedMessageCount: number
  /** 今日已发送消息条数 */
  sentMessageCount: number
  /** 各进程详情 */
  pluginUsages: DashboardPluginItem[]
}

/** 单个进程（插件或主框架）的资源占用 */
export interface DashboardPluginItem {
  /** 插件授权码（0 表示主框架自身） */
  id: number
  /** 进程 ID */
  pid: number
  /** 插件名称 */
  pluginName: string
  /** 进程是否在运行中 */
  running: boolean
  /** 该进程 CPU 占用百分比 */
  cpuUsage: number
  /** 该进程内存占用（MB） */
  memoryUsage: number
}
