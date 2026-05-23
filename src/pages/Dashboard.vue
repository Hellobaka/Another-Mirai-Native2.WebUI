<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import StatusCard from '@/components/StatusCard.vue'
import AnimatedCounter from '@/components/AnimatedCounter.vue'
import CpuMemoryRing from '@/components/CpuMemoryRing.vue'
import { getBaseInformation, getUsages, getPluginUsages } from '@/api/dashboard'
import type { DashboardInfoData, UsageData, PluginUsageData } from '@/models'

const app = useAppStore()
app.setPageTitle('仪表盘')

const info = ref<DashboardInfoData | null>(null)
const usage = ref<UsageData | null>(null)
const pluginUsage = ref<PluginUsageData | null>(null)
const loading = ref(true)
let timer: ReturnType<typeof setInterval>

async function fetchData() {
  try {
    const [infoRes, usageRes, pluginRes] = await Promise.all([
      getBaseInformation(),
      getUsages(),
      getPluginUsages(),
    ])
    if (infoRes.data.code === 0) info.value = infoRes.data.data
    if (usageRes.data.code === 0) usage.value = usageRes.data.data
    if (pluginRes.data.code === 0) pluginUsage.value = pluginRes.data.data
  } catch {
    /* silently handle */
  } finally {
    loading.value = false
  }
}

function formatMemory(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb.toFixed(0)} MB`
}

onMounted(() => {
  fetchData()
  timer = setInterval(fetchData, 5000)
})

onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div>
    <v-fade-transition>
      <div v-if="!loading && info">
        <!-- Status Cards Row -->
      <v-row>
        <v-col cols="12" sm="6" lg="3">
          <StatusCard
            icon="mdi-microsoft-windows"
            label="操作系统"
            :value="info.osVersion"
            color="primary"
          />
        </v-col>
        <v-col cols="12" sm="6" lg="3">
          <StatusCard
            icon="mdi-cpu-64-bit"
            label="CPU"
            :value="info.cpu"
            color="accent"
          />
        </v-col>
        <v-col cols="12" sm="6" lg="3">
          <StatusCard
            icon="mdi-memory"
            label="总内存"
            :value="formatMemory(info.totalMemory)"
            color="success"
          />
        </v-col>
        <v-col cols="12" sm="6" lg="3">
          <StatusCard
            icon="mdi-puzzle"
            label="已启用插件"
            :value="info.loadedPluginCount"
            :subtitle="`v${info.version} | 运行 ${info.startedTime}`"
            color="warning"
          />
        </v-col>
      </v-row>

      <!-- CPU / Memory Rings Row -->
      <v-row class="mt-4" v-if="usage">
        <v-col cols="12" md="6">
          <v-card class="glass-card pa-6">
            <v-card-title class="text-body-1">系统资源占用</v-card-title>
            <div class="d-flex justify-center ga-6 mt-4">
              <CpuMemoryRing
                :value="usage.cpuUsage"
                label="CPU"
                color="#8CB4FF"
                :size="140"
              />
              <CpuMemoryRing
                :value="usage.memoryUsage"
                label="内存"
                color="#4CAF84"
                :size="140"
              />
            </div>
            <div class="d-flex justify-center ga-8 mt-4 text-caption text-medium-emphasis">
              <div>
                频率: <strong>{{ usage.cpuCurrentFrequency.toFixed(0) }} MHz</strong>
              </div>
              <div>
                已用: <strong>{{ formatMemory(usage.usedMemoryInMB) }}</strong> /
                {{ formatMemory(usage.totalMemoryInMB) }}
              </div>
            </div>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card class="glass-card pa-6" height="100%">
            <v-card-title class="d-flex align-center">
              <span class="text-body-1">当前 Bot</span>
              <v-spacer />
              <v-chip
                :color="info.currentBotQQ ? 'success' : 'error'"
                size="small"
                variant="tonal"
              >
                {{ info.currentBotQQ ? '在线' : '离线' }}
              </v-chip>
            </v-card-title>
            <div class="mt-4">
              <div class="text-medium-emphasis text-caption">Bot QQ</div>
              <div class="text-h5 font-weight-bold mt-1">
                <AnimatedCounter :target="info.currentBotQQ || 0" />
              </div>
              <div class="text-medium-emphasis text-caption mt-3">昵称</div>
              <div class="text-h6 mt-1">{{ info.currentBotNick || '未设置' }}</div>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Plugin Process Table -->
      <v-row class="mt-4" v-if="pluginUsage">
        <v-col cols="12">
          <v-card class="glass-card">
            <v-card-title class="d-flex align-center">
              <span class="text-body-1">进程资源</span>
              <v-spacer />
              <span class="text-caption text-medium-emphasis">
                合计 CPU:
                <strong>{{ pluginUsage.totalProcessCPU.toFixed(1) }}%</strong>
                &nbsp;内存:
                <strong>{{ pluginUsage.totalProcessMemory.toFixed(1) }} MB</strong>
              </span>
            </v-card-title>
            <v-table density="compact">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>PID</th>
                  <th>状态</th>
                  <th>CPU</th>
                  <th>内存</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in pluginUsage.pluginUsages" :key="item.pid">
                  <td>{{ item.pluginName }}</td>
                  <td>{{ item.pid }}</td>
                  <td>
                    <v-chip
                      :color="item.running ? 'success' : 'error'"
                      size="x-small"
                      variant="tonal"
                    >
                      {{ item.running ? '运行中' : '已停止' }}
                    </v-chip>
                  </td>
                  <td>{{ item.cpuUsage.toFixed(1) }}%</td>
                  <td>{{ item.memoryUsage.toFixed(1) }} MB</td>
                </tr>
              </tbody>
            </v-table>
          </v-card>
        </v-col>
      </v-row>
    </div>
  </v-fade-transition>

  <v-row v-if="loading">
    <v-col v-for="n in 4" :key="n" cols="12" sm="6" lg="3">
      <v-skeleton-loader type="card" class="glass-card" />
    </v-col>
  </v-row>
</div>
</template>
