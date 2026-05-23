<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useNotifyStore } from '@/stores/notify'
import { getProtocolList, getCurrentProtocol, disconnectProtocol, connectProtocol, getProtocolConfig as getProtoConnectionConfig, setProtocolConfig as setProtoConnectionConfig } from '@/api/protocol'
import { setCoreConfig } from '@/api/config'
import { getErrorMessage } from '@/api/client'
import type { ProtocolStatusData } from '@/models'

const app = useAppStore()
const notify = useNotifyStore()
app.setPageTitle('协议管理')

const protocolList = ref<string[]>([])
const currentProtocol = ref<ProtocolStatusData | null>(null)
const actionLoading = ref(false)
const firstLoad = ref(true)

// Confirm dialog — shared for both disconnect and connect
const confirmOpen = ref(false)
const confirmTitle = ref('')
const confirmText = ref('')
const confirmAction = ref<() => void>(() => {})

// Config modal
const configOpen = ref(false)
const selectedProtocol = ref('')
const configData = ref<Record<string, string>>({})
const configLoading = ref(false)
const connecting = ref(false)
const autoConnect = ref(false)

const protocolIcons: Record<string, string> = {
  MiraiAPIHttp: 'mdi-api',
  'LagrangeCore': 'mdi-star',
  NoConnection: 'mdi-link-off',
  'OneBot v11': 'mdi-robot',
  'Satori v1': 'mdi-robot-outline',
}

function protocolIcon(name: string) {
  return protocolIcons[name] ?? 'mdi-power-plug'
}

async function fetchData() {
  try {
    const [listRes, currentRes] = await Promise.all([getProtocolList(), getCurrentProtocol()])
    if (listRes.data.code === 0) protocolList.value = listRes.data.data
    if (currentRes.data.code === 0) currentProtocol.value = currentRes.data.data
  } catch { /* */ }
  finally { firstLoad.value = false }
}

// --- Disconnect ---
function onDisconnectClick() {
  confirmTitle.value = '确认断开连接'
  confirmText.value = '确定要断开连接吗？操作会导致与机器人断开连接，无法处理消息。'
  confirmAction.value = doDisconnect
  confirmOpen.value = true
}

async function doDisconnect() {
  actionLoading.value = true
  try {
    const wasName = currentProtocol.value?.name
    await disconnectProtocol()
    await fetchData()
    notify.success('已断开')
    if (protocolList.value.length > 0) {
      const defaultProtocol = wasName && protocolList.value.includes(wasName)
        ? wasName : protocolList.value[0]
      openConfigModal(defaultProtocol)
    }
  }
  catch (e) { notify.error(getErrorMessage(e, '断开失败')) }
  finally { actionLoading.value = false }
}

// --- Connect ---
const confirmLoading = ref(false)

function onConnectClick(name: string) {
  if (currentProtocol.value?.isConnected) {
    confirmTitle.value = '确认切换协议'
    confirmText.value = '确定要切换协议吗？操作会导致与机器人断开连接，无法处理消息。'
    confirmOpen.value = true
    confirmLoading.value = false
    confirmAction.value = () => doSwitchProtocol(name)
  } else {
    openConfigModal(name)
  }
}

async function doSwitchProtocol(name: string) {
  confirmLoading.value = true
  try {
    await disconnectProtocol()
    // Open config modal immediately to bridge the gap
    confirmOpen.value = false
    selectedProtocol.value = name
    configData.value = {}
    configOpen.value = true
    configLoading.value = true
    await fetchData()
    const res = await getProtoConnectionConfig(name)
    if (res.data.code === 0) configData.value = res.data.data
    configLoading.value = false
  } catch (e) {
    notify.error(getErrorMessage(e, '断开当前协议失败，无法切换'))
    confirmOpen.value = false
    configOpen.value = false
  } finally {
    confirmLoading.value = false
  }
}

async function openConfigModal(name: string) {
  selectedProtocol.value = name
  configOpen.value = true
  configLoading.value = true
  autoConnect.value = false
  try {
    const res = await getProtoConnectionConfig(name)
    if (res.data.code === 0) configData.value = res.data.data
  } catch (e) { notify.error(getErrorMessage(e, '获取协议配置失败')) }
  finally { configLoading.value = false }
}

async function onProtocolSelect(name: string) {
  selectedProtocol.value = name
  configLoading.value = true
  try {
    const res = await getProtoConnectionConfig(name)
    if (res.data.code === 0) configData.value = res.data.data
  } finally { configLoading.value = false }
}

async function onConnect() {
  connecting.value = true
  try {
    await setProtoConnectionConfig(selectedProtocol.value, configData.value)
    await connectProtocol(selectedProtocol.value)

    // Save auto-connect to core config
    if (autoConnect.value) {
      await setCoreConfig('AutoProtocol', selectedProtocol.value)
    }

    configOpen.value = false
    await fetchData()
    notify.success(`已连接到 ${selectedProtocol.value}`)
  } catch (e) {
    notify.error(getErrorMessage(e, `切换到 ${selectedProtocol.value} 协议失败`))
  } finally {
    connecting.value = false
  }
}

function closeConfig() {
  if (!connecting.value) {
    configOpen.value = false
  }
}

onMounted(fetchData)
</script>

<template>
  <div>
    <v-fade-transition>
      <div v-if="firstLoad" class="pa-4">
        <v-skeleton-loader type="card" class="mb-4" />
        <v-row>
          <v-col v-for="n in 3" :key="n" cols="12" sm="6" md="4">
            <v-skeleton-loader type="card" />
          </v-col>
        </v-row>
      </div>
      <div v-else>
        <!-- Status Banner -->
    <v-card class="glass-card mb-4 pa-4">
      <div class="d-flex align-center">
        <v-icon
          :icon="currentProtocol?.isConnected ? 'mdi-check-circle' : 'mdi-alert-circle'"
          :color="currentProtocol?.isConnected ? 'success' : 'grey'"
          size="32"
          class="mr-3"
        />
        <div>
          <div class="text-h6 font-weight-bold">{{ currentProtocol?.name || '未连接' }}</div>
          <div class="text-caption text-medium-emphasis">
            {{ currentProtocol?.isConnected ? '连接正常' : currentProtocol ? '已断开' : '未配置协议' }}
          </div>
        </div>
        <v-spacer />
        <v-btn
          v-if="currentProtocol?.isConnected"
          variant="tonal"
          color="error"
          prepend-icon="mdi-link-off"
          :loading="actionLoading"
          @click="onDisconnectClick"
        >
          断开连接
        </v-btn>
      </div>
    </v-card>

    <!-- Protocol Cards -->
    <v-row>
      <v-col v-for="name in protocolList" :key="name" cols="12" sm="6" md="4">
        <v-card
          class="glass-card pa-4"
          :class="{ 'border-primary': name === currentProtocol?.name && currentProtocol?.isConnected }"
          height="100%"
        >
          <div class="d-flex align-center mb-3">
            <v-icon :icon="protocolIcon(name)" size="28" color="primary" />
            <v-spacer />
            <v-chip
              v-if="name === currentProtocol?.name && currentProtocol?.isConnected"
              color="success"
              size="small"
              variant="tonal"
            >
              已连接
            </v-chip>
          </div>
          <div class="text-body-1 font-weight-medium mb-2">{{ name }}</div>
          <v-btn
            v-if="!(name === currentProtocol?.name && currentProtocol?.isConnected)"
            variant="tonal"
            color="primary"
            block
            @click="onConnectClick(name)"
          >
            连接
          </v-btn>
          <v-btn
            v-else
            variant="text"
            color="success"
            block
            disabled
          >
            当前连接
          </v-btn>
        </v-card>
      </v-col>
    </v-row>

    <!-- Confirm Dialog -->
    <v-dialog v-model="confirmOpen" max-width="420" :persistent="confirmLoading">
      <v-card class="pa-4">
        <v-card-title class="text-h6">{{ confirmTitle }}</v-card-title>
        <v-card-text class="pt-2">{{ confirmText }}</v-card-text>

        <v-progress-linear v-if="confirmLoading" indeterminate class="mb-4" />

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="confirmLoading" @click="confirmOpen = false">取消</v-btn>
          <v-btn variant="tonal" color="primary" :loading="confirmLoading" min-width="100" @click="confirmAction()">
            <template #loader>
              <v-progress-circular indeterminate size="16" width="2" class="mr-1" />
              断开中...
            </template>
            确定
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Config & Connect Modal -->
    <v-dialog v-model="configOpen" max-width="520" :persistent="connecting">
      <v-card class="pa-4">
        <v-card-title class="d-flex align-center text-h6">
          <v-select
            :model-value="selectedProtocol"
            :items="protocolList"
            variant="plain"
            density="compact"
            hide-details
            style="max-width: 200px"
            :disabled="connecting"
            @update:model-value="onProtocolSelect"
          />
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            :disabled="connecting"
            @click="closeConfig"
          />
        </v-card-title>

        <v-card-text>
          <v-progress-linear v-if="configLoading" indeterminate class="mb-4" />

          <template v-else>
            <div class="text-body-2 font-weight-medium mb-3">协议配置</div>
            <div v-if="Object.keys(configData).length === 0" class="text-caption text-medium-emphasis py-2">
              此协议无配置项
            </div>
            <div
              v-for="(value, key) in configData"
              :key="key"
              class="mb-3"
            >
              <div class="text-caption font-weight-medium mb-1">{{ key }}</div>
              <v-text-field
                :model-value="value"
                variant="outlined"
                density="compact"
                hide-details
                :disabled="connecting"
                @update:model-value="(v: string) => configData[key] = v"
              />
            </div>

            <v-divider class="my-3" />
            <v-switch
              v-model="autoConnect"
              label="自动连接（启动时自动连接此协议）"
              color="primary"
              density="compact"
              hide-details
              :disabled="connecting"
            />
          </template>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="connecting" @click="closeConfig">取消</v-btn>
          <v-btn
            variant="tonal"
            color="primary"
            :loading="connecting"
            :disabled="configLoading"
            min-width="100"
            @click="onConnect"
          >
            <template #loader>
              <v-progress-circular indeterminate size="16" width="2" class="mr-1" />
              连接中...
            </template>
            连接
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
      </div>
    </v-fade-transition>
  </div>
</template>

<style scoped>
.border-primary {
  border: 1px solid rgb(var(--v-theme-primary)) !important;
}
</style>
