<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useHubStore } from '@/stores/hub'
import { useNotifyStore } from '@/stores/notify'
import { getCoreConfig, setCoreConfig, getProtocolConfig, setProtocolConfig, getWebUIConfig, setWebUIConfig } from '@/api/config'
import { getProtocolList } from '@/api/protocol'
import { getErrorMessage } from '@/api/client'
import type { GetConfigResponseItem } from '@/models'

const router = useRouter()
const app = useAppStore()
const auth = useAuthStore()
const hub = useHubStore()
const notify = useNotifyStore()
app.setPageTitle('设置')

const tab = ref('core')

// --- Core config ---
const coreConfig = ref<Record<string, GetConfigResponseItem>>({})
const coreLoading = ref(false)
const coreSaveLoading = ref<Record<string, boolean>>({})

const configSections = [
  { title: '连接', icon: 'mdi-connection', keys: ['AutoConnect', 'AutoProtocol', 'ReconnectTime'] },
  {
    title: '插件',
    icon: 'mdi-puzzle',
    keys: [
      'PluginExitWhenCoreExit',
      'RestartPluginIfDead',
      'HeartBeatInterval',
      'PluginInvokeTimeout',
      'LoadTimeout',
    ],
  },
  { title: '数据', icon: 'mdi-database', keys: ['UseDatabase', 'MessageCacheSize'] },
  {
    title: '图片缓存',
    icon: 'mdi-image',
    keys: [
      'EnableChatImageCacheMaxSizeControl',
      'MaxChatImageCacheFolderSize',
      'EnableChatImageCacheExpireTimeControl',
      'ChatImageCacheExpireTime',
    ],
  },
  { title: '调试', icon: 'mdi-bug', keys: ['DebugMode'] },
  {
    title: '离线操作',
    icon: 'mdi-cloud-off',
    keys: [
      'ActionAfterOfflineSeconds',
      'OfflineActionSendEmail',
      'OfflineActionEmail_SMTPServer',
      'OfflineActionEmail_SMTPPort',
      'OfflineActionEmail_SMTPUsername',
      'OfflineActionEmail_SMTPPassport',
      'OfflineActionEmail_SMTPSenderEmail',
      'OfflineActionEmail_SMTPReceiveEmail',
      'OfflineActionRunCommand',
      'OfflineActionCommands',
    ],
  },
]

function sectionItems(keys: string[]) {
  return keys.filter((k) => coreConfig.value[k]).map((k) => [k, coreConfig.value[k]] as const)
}

async function fetchCoreConfig() {
  coreLoading.value = true
  try {
    const res = await getCoreConfig()
    if (res.data.code === 0) coreConfig.value = res.data.data
  } finally {
    coreLoading.value = false
  }
}

// Validation & draft state for core config fields
const fieldErrors = ref<Record<string, string>>({})
const originals = ref<Record<string, unknown>>({})
const listDrafts = ref<Record<string, string>>({})
const listErrors = ref<Record<string, string>>({})

function validateField(key: string, value: unknown, type: string): string {
  if (type === 'Int32' || type === 'Int64' || type === 'UInt16') {
    const n = typeof value === 'number' ? value : Number(value)
    if (isNaN(n)) return '请输入有效数字'
    if (type === 'UInt16' && (n < 0 || n > 65535)) return '范围 0–65535'
    if (type === 'Int32' && (n < -2147483648 || n > 2147483647)) return '数值超出范围'
  }
  return ''
}

function cacheOriginal(key: string) {
  const item = coreConfig.value[key]
  if (item && originals.value[key] === undefined) {
    originals.value[key] = item.value
  }
}

function updateDraft(key: string, value: unknown) {
  coreConfig.value[key] = { ...coreConfig.value[key], value }
  fieldErrors.value[key] = validateField(key, value, coreConfig.value[key].type)
}

async function commitField(key: string) {
  const item = coreConfig.value[key]
  if (!item) return
  const original = originals.value[key]

  // No change — skip save
  if (original !== undefined && String(item.value) === String(original)) {
    delete originals.value[key]
    fieldErrors.value[key] = ''
    return
  }

  const err = validateField(key, item.value, item.type)
  if (err) {
    fieldErrors.value[key] = err
    if (original !== undefined) {
      coreConfig.value[key] = { ...item, value: original }
    }
    delete originals.value[key]
    notify.error(`${item.title}: ${err}`)
    return
  }
  fieldErrors.value[key] = ''
  await doSave(key, item.value)
}

async function doSave(key: string, value: unknown) {
  coreSaveLoading.value[key] = true
  try {
    await setCoreConfig(key, value)
    notify.success('已保存')
  } catch (e) {
    notify.error(getErrorMessage(e, '保存失败'))
  } finally {
    coreSaveLoading.value[key] = false
  }
  delete originals.value[key]
}

async function saveCoreConfig(key: string, value: unknown) {
  const item = coreConfig.value[key]
  const err = validateField(key, value, item.type)
  if (err) {
    fieldErrors.value[key] = err
    coreConfig.value[key] = { ...item, value: !value }
    notify.error(`${item.title}: ${err}`)
    return
  }
  fieldErrors.value[key] = ''
  await doSave(key, value)
}

// --- Protocol ---
const protocolList = ref<string[]>([])
const protocolTab = ref('')
const protocolConfigs = ref<Record<string, Record<string, GetConfigResponseItem>>>({})
const protocolLoading = ref(false)
const protocolSaveLoading = ref<Record<string, boolean>>({})
const protocolOriginals = ref<Record<string, unknown>>({})

function protoKey(name: string, key: string) {
  return `${name}.${key}`
}

function cacheProtocolOriginal(name: string, key: string) {
  const fk = protoKey(name, key)
  const item = protocolConfigs.value[name]?.[key]
  if (item && protocolOriginals.value[fk] === undefined) {
    protocolOriginals.value[fk] = item.value
  }
}

function updateProtocolDraft(name: string, key: string, value: unknown) {
  if (protocolConfigs.value[name]) {
    protocolConfigs.value[name][key] = { ...protocolConfigs.value[name][key], value }
  }
}

async function commitProtocolField(name: string, key: string) {
  const fk = protoKey(name, key)
  const item = protocolConfigs.value[name]?.[key]
  if (!item) return
  const original = protocolOriginals.value[fk]
  if (original !== undefined && String(item.value) === String(original)) {
    delete protocolOriginals.value[fk]
    return
  }
  delete protocolOriginals.value[fk]
  await saveProtocolItem(name, key, item.value)
}

async function fetchProtocolList() {
  try {
    const res = await getProtocolList()
    if (res.data.code === 0) {
      protocolList.value = res.data.data
      if (!protocolTab.value && res.data.data.length > 0) {
        protocolTab.value = res.data.data[0]
        fetchOneConfig(res.data.data[0])
      }
    }
  } catch {
    /* */
  }
}

async function fetchOneConfig(name: string) {
  protocolLoading.value = true
  try {
    const res = await getProtocolConfig(name)
    if (res.data.code === 0) protocolConfigs.value[name] = res.data.data
  } finally {
    protocolLoading.value = false
  }
}

function onProtocolTabChange(name: string) {
  if (!protocolConfigs.value[name]) fetchOneConfig(name)
}

async function saveProtocolItem(protocolName: string, key: string, value: unknown) {
  const saveKey = `${protocolName}.${key}`
  protocolSaveLoading.value[saveKey] = true
  try {
    await setProtocolConfig(protocolName, key, value)
    if (protocolConfigs.value[protocolName]) {
      protocolConfigs.value[protocolName][key] = {
        ...protocolConfigs.value[protocolName][key],
        value,
      }
    }
    notify.success('已保存')
  } catch (e) {
    notify.error(getErrorMessage(e, '保存失败'))
  } finally {
    protocolSaveLoading.value[saveKey] = false
  }
}

// --- WebUI config ---
const webuiConfig = ref<Record<string, GetConfigResponseItem>>({})
const webuiDraft = ref<Record<string, unknown>>({})
const webuiLoading = ref(false)
const webuiSaveLoading = ref(false)
const webuiConfirmOpen = ref(false)
const showPassword = ref(false)

const webuiFieldOrder = [
  'ListenIP',
  'ListenPort',
  'EnableHTTPS',
  'Password',
  'CertificatePath',
  'CertificateKeyPath',
]

async function fetchWebUIConfig() {
  webuiLoading.value = true
  try {
    const res = await getWebUIConfig()
    if (res.data.code === 0) {
      webuiConfig.value = res.data.data
      webuiDraft.value = Object.fromEntries(
        Object.entries(res.data.data).map(([k, item]) => [k, item.value]),
      )
    }
  } finally {
    webuiLoading.value = false
  }
}

function updateWebuiDraft(key: string, value: unknown) {
  webuiDraft.value[key] = value
}

async function confirmWebuiSave() {
  webuiSaveLoading.value = true
  try {
    const changed = webuiFieldOrder.filter(
      (k) => webuiConfig.value[k] && String(webuiDraft.value[k]) !== String(webuiConfig.value[k].value),
    )
    for (const key of changed) {
      await setWebUIConfig(key, webuiDraft.value[key])
    }
    for (const key of changed) {
      webuiConfig.value[key] = { ...webuiConfig.value[key], value: webuiDraft.value[key] }
    }
    webuiConfirmOpen.value = false
    notify.warning('已保存，保存配置后将会登出')
    setTimeout(() => {
      notify.clear()
      hub.disconnect()
      auth.logout()
      router.push({ name: 'Login' })
    }, 1500)
  } catch (e) {
    notify.error(getErrorMessage(e, '保存失败'))
  } finally {
    webuiSaveLoading.value = false
  }
}

// --- Section nav + scroll spy ---
const sectionTab = ref(configSections[0].title)
const sectionRefs = ref<Record<string, HTMLElement>>({})

function setSectionRef(title: string, el: unknown) {
  if (el) {
    // Vuetify components pass the component instance; unwrap to DOM element
    const domEl = (el as { $el?: HTMLElement }).$el ?? (el as HTMLElement)
    sectionRefs.value[title] = domEl
  }
}

function scrollToSection(title: string) {
  sectionTab.value = title
  sectionRefs.value[title]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function updateActiveSection() {
  let best = ''
  let bestTop = Infinity
  for (const [title, el] of Object.entries(sectionRefs.value)) {
    if (!el) continue
    const top = el.getBoundingClientRect().top
    // Find the section whose top is closest to (but not below) the sticky header area
    if (top <= 150 && top > -el.offsetHeight * 0.5 && top < bestTop) {
      bestTop = top
      best = title
    }
  }
  if (best) sectionTab.value = best
}

onMounted(() => {
  fetchCoreConfig().then(() => {
    // Wait for DOM to render sections, then listen to scroll
    setTimeout(() => {
      window.addEventListener('scroll', updateActiveSection, { passive: true })
      updateActiveSection()
    }, 300)
  })
  fetchProtocolList()
  fetchWebUIConfig()
})
onUnmounted(() => window.removeEventListener('scroll', updateActiveSection))
</script>

<template>
  <div>
    <!-- Sticky: main tabs + section nav -->
    <div
      style="
        position: sticky;
        top: 0;
        z-index: 20;
        background: rgb(var(--v-theme-background));
        padding-bottom: 12px;
      "
    >
      <div class="pt-1">
        <v-tabs v-model="tab" color="primary">
          <v-tab value="core" prepend-icon="mdi-cog">核心配置</v-tab>
          <v-tab value="protocol" prepend-icon="mdi-power-plug">协议管理</v-tab>
          <v-tab value="webui" prepend-icon="mdi-web">WebUI</v-tab>
        </v-tabs>
      </div>
      <div v-show="tab === 'core'" style="max-width: 720px; margin: 0 auto">
        <v-card class="glass-card" style="margin-bottom: 12px">
          <v-tabs v-model="sectionTab" color="primary" density="compact" grow>
            <v-tab
              v-for="s in configSections"
              :key="s.title"
              :value="s.title"
              @click="scrollToSection(s.title)"
            >
              <v-icon :icon="s.icon" size="small" class="mr-1" />
              {{ s.title }}
            </v-tab>
          </v-tabs>
        </v-card>
      </div>
    </div>

    <!-- ========== Core Config ========== -->
    <div v-show="tab === 'core'">
      <v-row v-if="!coreLoading">
        <v-col v-for="section in configSections" :key="section.title" cols="12">
          <v-card
            class="glass-card mb-4 section-card"
            style="max-width: 720px; margin: 0 auto 16px auto"
            :ref="(el: unknown) => setSectionRef(section.title, el)"
          >
            <v-card-title class="d-flex align-center pa-4">
              <v-icon :icon="section.icon" class="mr-2" color="primary" />
              <span class="text-body-1">{{ section.title }}</span>
            </v-card-title>
            <v-card-text class="pt-0">
              <div
                v-for="[key, item] in sectionItems(section.keys)"
                :key="key"
                class="d-flex align-center py-2 config-row"
              >
                <div class="flex-grow-1 mr-3">
                  <div class="text-body-2">{{ item.title }}</div>
                  <div v-if="item.description" class="text-caption text-medium-emphasis">
                    {{ item.description }}
                  </div>
                </div>
                <div class="config-control">
                  <v-switch
                    v-if="item.type === 'Boolean'"
                    :model-value="item.value as boolean"
                    color="primary"
                    hide-details
                    density="compact"
                    :loading="coreSaveLoading[key]"
                    @update:model-value="
                      async (v: boolean | null) => {
                        if (v === null) return
                        await saveCoreConfig(key, v)
                        coreConfig[key] = { ...coreConfig[key], value: v }
                      }
                    "
                  />
                  <template
                    v-else-if="
                      item.type === 'Int32' || item.type === 'Int64' || item.type === 'UInt16'
                    "
                  >
                    <div>
                      <v-text-field
                        :model-value="String(item.value)"
                        type="number"
                        variant="outlined"
                        density="compact"
                        hide-details
                        style="width: 250px"
                        :loading="coreSaveLoading[key]"
                        :error-messages="fieldErrors[key] || ''"
                        @focus="cacheOriginal(key)"
                        @update:model-value="(v: string) => updateDraft(key, Number(v))"
                        @blur="commitField(key)"
                        @keyup.enter="($event.target as HTMLElement).blur()"
                      />
                    </div>
                  </template>
                  <template v-else-if="item.type === 'List`1'">
                    <v-dialog max-width="420">
                      <template #activator="{ props: dialogProps }">
                        <v-btn v-bind="dialogProps" size="x-small" variant="tonal" color="primary">
                          编辑 ({{ (item.value as string[]).length }})
                        </v-btn>
                      </template>
                      <template #default="{ isActive }">
                        <v-card class="pa-4">
                          <v-card-title class="text-body-1 d-flex align-center pa-0 mb-3">
                            {{ item.title }}
                            <v-spacer />
                            <v-btn
                              icon="mdi-close"
                              variant="text"
                              size="small"
                              @click="isActive.value = false"
                            />
                          </v-card-title>
                          <v-card-text class="pa-0">
                            <div
                              v-if="(item.value as string[]).length === 0"
                              class="text-caption text-medium-emphasis py-2"
                            >
                              列表为空
                            </div>
                            <v-list
                              v-else
                              density="compact"
                              class="mb-3 bg-transparent"
                              lines="one"
                            >
                              <v-list-item
                                v-for="(entry, idx) in item.value as string[]"
                                :key="idx"
                                :title="entry"
                                density="compact"
                              >
                                <template #append>
                                  <v-btn
                                    icon="mdi-delete-outline"
                                    variant="text"
                                    size="x-small"
                                    color="error"
                                    :loading="coreSaveLoading[key]"
                                    @click="
                                      async () => {
                                        const arr = [...(item.value as string[])]
                                        arr.splice(idx, 1)
                                        await saveCoreConfig(key, arr)
                                        coreConfig[key] = { ...coreConfig[key], value: arr }
                                      }
                                    "
                                  />
                                </template>
                              </v-list-item>
                            </v-list>
                            <div class="d-flex ga-2">
                              <v-text-field
                                v-model="listDrafts[key]"
                                placeholder="输入新项..."
                                variant="outlined"
                                density="compact"
                                hide-details
                                @keyup.enter="
                                  async () => {
                                    const val = listDrafts[key]?.trim()
                                    if (!val) return
                                    const arr = (item.value as string[]) || []
                                    if (arr.includes(val)) {
                                      listErrors[key] = '该项已存在'
                                      return
                                    }
                                    listErrors[key] = ''
                                    await saveCoreConfig(key, [...arr, val])
                                    coreConfig[key] = { ...coreConfig[key], value: [...arr, val] }
                                    listDrafts[key] = ''
                                  }
                                "
                              />
                              <v-btn
                                variant="tonal"
                                color="primary"
                                :loading="coreSaveLoading[key]"
                                @click="
                                  async () => {
                                    const val = listDrafts[key]?.trim()
                                    if (!val) return
                                    const arr = (item.value as string[]) || []
                                    if (arr.includes(val)) {
                                      listErrors[key] = '该项已存在'
                                      return
                                    }
                                    listErrors[key] = ''
                                    await saveCoreConfig(key, [...arr, val])
                                    coreConfig[key] = { ...coreConfig[key], value: [...arr, val] }
                                    listDrafts[key] = ''
                                  }
                                "
                              >
                                添加
                              </v-btn>
                            </div>
                            <div v-if="listErrors[key]" class="text-caption text-error mt-1">
                              {{ listErrors[key] }}
                            </div>
                          </v-card-text>
                        </v-card>
                      </template>
                    </v-dialog>
                  </template>
                  <div v-else>
                    <v-text-field
                      :model-value="String(item.value ?? '')"
                      variant="outlined"
                      density="compact"
                      hide-details
                      style="width: 250px"
                      :loading="coreSaveLoading[key]"
                      :error-messages="fieldErrors[key] || ''"
                      @focus="cacheOriginal(key)"
                      @update:model-value="(v: string) => updateDraft(key, v)"
                      @blur="commitField(key)"
                      @keyup.enter="($event.target as HTMLElement).blur()"
                    />
                  </div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
      <v-skeleton-loader v-else type="article, article, article" />
    </div>

    <!-- ========== Protocol ========== -->
    <div v-show="tab === 'protocol'">
      <v-card class="glass-card" style="max-width: 720px; margin: 0 auto 16px auto">
        <v-card-text>
          <v-tabs v-model="protocolTab" color="primary" @update:model-value="onProtocolTabChange">
            <v-tab v-for="name in protocolList" :key="name" :value="name">{{ name }}</v-tab>
          </v-tabs>
          <v-divider class="mb-4" />
          <v-tabs-window v-model="protocolTab" style="overflow: visible">
            <v-tabs-window-item
              v-for="name in protocolList"
              :key="name"
              :value="name"
              style="overflow: visible"
            >
              <v-skeleton-loader v-if="protocolLoading" type="list-item@4" />
              <div v-else-if="protocolConfigs[name]">
                <div
                  v-for="(item, key) in protocolConfigs[name]"
                  :key="key"
                  class="config-row d-flex align-center py-3"
                >
                  <div class="flex-grow-1 mr-3">
                    <div class="text-body-2">{{ item.title }}</div>
                    <div v-if="item.description" class="text-caption text-medium-emphasis">
                      {{ item.description }}
                    </div>
                  </div>
                  <div class="d-flex align-center">
                    <v-switch
                      v-if="item.type === 'Boolean'"
                      :model-value="item.value as boolean"
                      color="primary"
                      hide-details
                      density="compact"
                      :loading="protocolSaveLoading[`${name}.${key}`]"
                      @update:model-value="
                        (v: boolean | null) => {
                          if (v !== null) saveProtocolItem(name, key, v)
                        }
                      "
                    />
                    <template
                      v-else-if="
                        item.type === 'Int32' || item.type === 'Int64' || item.type === 'UInt16'
                      "
                    >
                      <v-text-field
                        :model-value="String(item.value)"
                        type="number"
                        variant="outlined"
                        density="compact"
                        hide-details
                        style="width: 250px"
                        :loading="protocolSaveLoading[`${name}.${key}`]"
                        @focus="cacheProtocolOriginal(name, key)"
                        @update:model-value="
                          (v: string) => {
                            const n = Number(v)
                            if (!isNaN(n)) updateProtocolDraft(name, key, n)
                          }
                        "
                        @blur="commitProtocolField(name, key)"
                        @keyup.enter="($event.target as HTMLElement).blur()"
                      />
                    </template>
                    <v-text-field
                      v-else
                      :model-value="String(item.value ?? '')"
                      variant="outlined"
                      density="compact"
                      hide-details
                      style="width: 250px"
                      :loading="protocolSaveLoading[`${name}.${key}`]"
                      @focus="cacheProtocolOriginal(name, key)"
                      @update:model-value="(v: string) => updateProtocolDraft(name, key, v)"
                      @blur="commitProtocolField(name, key)"
                      @keyup.enter="($event.target as HTMLElement).blur()"
                    />
                  </div>
                </div>
              </div>
              <div v-else class="text-caption text-medium-emphasis text-center py-6">
                加载配置失败
              </div>
            </v-tabs-window-item>
          </v-tabs-window>
        </v-card-text>
      </v-card>
    </div>

    <!-- ========== WebUI Config ========== -->
    <div v-show="tab === 'webui'">
      <v-card class="glass-card" style="max-width: 720px; margin: 0 auto">
        <v-card-title class="d-flex align-center pa-4">
          <v-icon icon="mdi-web" class="mr-2" color="primary" />
          <span class="text-body-1">WebUI 配置</span>
        </v-card-title>
        <v-card-text class="pt-0">
          <v-skeleton-loader v-if="webuiLoading" type="list-item-two-line@4" />
          <div v-else>
            <div
              v-for="key in webuiFieldOrder.filter((k) => webuiConfig[k])"
              :key="key"
              class="config-row d-flex align-center py-2"
            >
              <div class="flex-grow-1 mr-3">
                <div class="text-body-2">{{ webuiConfig[key].title }}</div>
                <div v-if="webuiConfig[key].description" class="text-caption text-medium-emphasis">
                  {{ webuiConfig[key].description }}
                </div>
              </div>
              <div class="config-control">
                <v-switch
                  v-if="webuiConfig[key].type === 'Boolean'"
                  :model-value="webuiDraft[key] as boolean"
                  color="primary"
                  hide-details
                  density="compact"
                  @update:model-value="(v: boolean | null) => { if (v !== null) updateWebuiDraft(key, v) }"
                />
                <v-text-field
                  v-else-if="webuiConfig[key].type === 'Int32' || webuiConfig[key].type === 'UInt16'"
                  :model-value="String(webuiDraft[key] ?? '')"
                  type="number"
                  variant="outlined"
                  density="compact"
                  hide-details
                  style="width: 250px"
                  @update:model-value="(v: string) => { const n = Number(v); if (!isNaN(n)) updateWebuiDraft(key, n) }"
                />
                <v-text-field
                  v-else-if="key === 'Password'"
                  :model-value="String(webuiDraft[key] ?? '')"
                  :type="showPassword ? 'text' : 'password'"
                  variant="outlined"
                  density="compact"
                  hide-details
                  style="width: 250px"
                  :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                  @update:model-value="(v: string) => updateWebuiDraft(key, v)"
                  @click:append-inner="showPassword = !showPassword"
                />
                <v-text-field
                  v-else
                  :model-value="String(webuiDraft[key] ?? '')"
                  variant="outlined"
                  density="compact"
                  hide-details
                  style="width: 250px"
                  @update:model-value="(v: string) => updateWebuiDraft(key, v)"
                />
              </div>
            </div>
          </div>
        </v-card-text>
        <v-card-actions class="px-4 pb-4 pt-2 d-flex justify-end ga-2">
          <v-btn
            variant="tonal"
            color="warning"
            prepend-icon="mdi-refresh"
            min-width="100"
            :loading="webuiLoading"
            @click="fetchWebUIConfig"
          >
            重置
          </v-btn>
          <v-btn
            variant="tonal"
            color="primary"
            prepend-icon="mdi-content-save"
            min-width="100"
            @click="webuiConfirmOpen = true"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </div>

    <!-- WebUI save confirm dialog -->
    <v-dialog v-model="webuiConfirmOpen" max-width="420" :persistent="webuiSaveLoading">
      <v-card class="glass-card">
        <v-card-title class="d-flex align-center pa-4 pb-2">
          <v-icon icon="mdi-alert-circle-outline" color="warning" class="mr-2" />
          <span class="text-body-1">保存 WebUI 配置</span>
        </v-card-title>
        <v-card-text class="text-body-2 pb-2">
          修改 WebUI 配置需要重启服务，在保存配置后请手动重启服务使配置生效。
        </v-card-text>
        <v-card-actions class="justify-end px-4 pb-4">
          <v-btn variant="text" min-width="100" :disabled="webuiSaveLoading" @click="webuiConfirmOpen = false">
            取消
          </v-btn>
          <v-btn
            variant="tonal"
            color="primary"
            min-width="100"
            :loading="webuiSaveLoading"
            @click="confirmWebuiSave"
          >
            确认保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.config-row {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.05);
  padding: 12px 6px;
}
.config-row:last-child {
  border-bottom: none;
}
.config-control {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.section-card {
  scroll-margin-top: 100px;
}

/* Prevent v-tabs-window from clipping protocol config controls */
:deep(.v-tabs-window) {
  overflow: visible !important;
}
:deep(.v-tabs-window__container) {
  overflow: visible !important;
}
</style>

<style>
.v-layout {
  overflow: visible !important;
}
.v-navigation-drawer {
  position: fixed !important;
  top: 0;
  left: 0;
  height: 100vh !important;
}
.v-container {
  container-type: normal !important;
}
</style>
