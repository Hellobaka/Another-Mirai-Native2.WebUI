<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useNotifyStore } from '@/stores/notify'
import { getBaseInformation } from '@/api/dashboard'

const router = useRouter()
const auth = useAuthStore()
const app = useAppStore()
const notify = useNotifyStore()
const display = useDisplay()

const isMobile = computed(() => display.smAndDown.value)
const drawerPermanent = computed(() => !isMobile.value)

const botQQ = ref(0)
const botNick = ref('')

async function fetchBotInfo() {
  try {
    const res = await getBaseInformation()
    if (res.data.code === 0) {
      botQQ.value = res.data.data.currentBotQQ
      botNick.value = res.data.data.currentBotNick
    }
  } catch {
    /* silent */
  }
}

const navItems = [
  { title: '仪表盘', icon: 'mdi-view-dashboard', to: '/dashboard' },
  { title: '插件管理', icon: 'mdi-puzzle', to: '/plugins' },
  { title: '日志', icon: 'mdi-text-box-outline', to: '/logs' },
  { title: '协议管理', icon: 'mdi-power-plug', to: '/protocol' },
  { title: '设置', icon: 'mdi-cog', to: '/settings' },
]

function logout() {
  auth.logout()
  router.push({ name: 'Login' })
}

function closeOnMobile() {
  if (isMobile.value) app.drawerOpen = false
}

const APP_VERSION = '1.0.0'
// SignalR connection state — always disconnected until hub is wired up
const hubConnected = ref(false)

onMounted(() => {
  fetchBotInfo()
})
</script>

<template>
  <v-layout>
    <v-navigation-drawer
      v-model="app.drawerOpen"
      v-model:rail="app.rail"
      :permanent="drawerPermanent"
      elevation="0"
    >
      <!-- Rail mode: centered avatar only -->
      <div v-if="app.rail" class="d-flex justify-center py-3" style="cursor:pointer" @click="router.push('/dashboard')">
        <v-avatar size="40">
          <v-img v-if="botQQ > 0" :src="`https://q.qlogo.cn/g?b=qq&nk=${botQQ}&s=160`" :alt="botNick" />
          <v-icon v-else icon="mdi-robot" size="24" />
        </v-avatar>
      </div>

      <!-- Expanded mode: avatar + nick + QQ -->
      <v-list-item v-else class="pa-4" nav @click="router.push('/dashboard')" style="cursor: pointer">
        <template #prepend>
          <v-avatar size="40">
            <v-img
              v-if="botQQ > 0"
              :src="`https://q.qlogo.cn/g?b=qq&nk=${botQQ}&s=160`"
              :alt="botNick"
            />
            <v-icon v-else icon="mdi-robot" size="24" />
          </v-avatar>
        </template>
        <v-list-item-title class="font-weight-bold">
          {{ botNick || 'AMN2' }}
        </v-list-item-title>
        <v-list-item-subtitle class="text-caption">
          {{ botQQ > 0 ? botQQ : '管理面板' }}
        </v-list-item-subtitle>
      </v-list-item>

      <v-divider class="mx-3" />

      <v-list nav density="compact" class="pa-2">
        <v-list-item
          v-for="item in navItems"
          :key="item.to"
          :title="item.title"
          :prepend-icon="item.icon"
          :to="item.to"
          rounded="lg"
          color="primary"
          @click="closeOnMobile"
        />
      </v-list>
    </v-navigation-drawer>

    <v-app-bar class="glass-card" elevation="0" density="compact">
      <template #prepend>
        <v-app-bar-nav-icon v-if="isMobile" @click="app.toggleDrawer()" />
        <v-app-bar-nav-icon v-else @click="app.toggleRail()" />
      </template>
      <v-app-bar-title>{{ app.pageTitle }}</v-app-bar-title>

      <template #append>
        <v-btn
          :icon="app.themeMode === 'dark' ? 'mdi-weather-sunny' : 'mdi-weather-night'"
          variant="text"
          size="small"
          @click="app.toggleTheme()"
        />
        <v-btn icon="mdi-logout" variant="text" size="small" @click="logout" />
      </template>
    </v-app-bar>

    <v-main style="padding-bottom: 40px">
      <v-container fluid class="pa-4">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </v-container>
    </v-main>

    <v-footer class="footer-bar" elevation="0" height="40">
      <div class="footer-inner">
        <span class="status-dot" :class="hubConnected ? 'status-dot--on' : 'status-dot--off'" />
        <span class="footer-label ml-2">
          实时推送服务:
          <span :class="hubConnected ? 'text-success' : 'text-error'">
            {{ hubConnected ? '已连接' : '已断开' }}
          </span>
        </span>
        <div class="footer-divider" />
        <a
          href="https://github.com/Hellobaka/Another-Mirai-Native2.WebUI"
          target="_blank"
          rel="noopener"
          class="footer-link"
        >
          <v-icon icon="mdi-github" size="14" class="mr-1" />GitHub
        </a>
        <span class="footer-dot">·</span>
        <span class="footer-label">WebUI v{{ APP_VERSION }}</span>
      </div>
    </v-footer>

    <!-- Stacked snackbar container -->
    <div class="snackbar-stack">
      <v-fade-transition group>
        <v-card
          v-for="n in notify.queue"
          :key="n.id"
          :color="n.severity"
          class="snackbar-item pa-3"
          variant="elevated"
        >
          <div class="d-flex align-center">
            <v-icon
              :icon="
                n.severity === 'success'
                  ? 'mdi-check-circle'
                  : n.severity === 'error'
                    ? 'mdi-alert-circle'
                    : n.severity === 'warning'
                      ? 'mdi-alert'
                      : 'mdi-information'
              "
              class="mr-2"
              size="20"
            />
            <span class="text-body-2 flex-grow-1">{{ n.message }}</span>
            <v-btn
              variant="text"
              icon="mdi-close"
              size="x-small"
              density="compact"
              @click="notify.dismiss(n.id)"
            />
          </div>
          <v-progress-linear
            v-if="!n.persistent"
            :model-value="(n.remaining / n.duration) * 100"
            color="white"
            height="2"
            class="mt-2"
            bg-opacity="0.3"
          />
        </v-card>
      </v-fade-transition>
    </div>
  </v-layout>
</template>

<style scoped>
.snackbar-stack {
  position: fixed;
  top: 72px;
  right: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 380px;
}
.snackbar-item {
  min-width: 300px;
  backdrop-filter: blur(12px);
}

/* ── Footer ── */
.footer-bar {
  position: fixed !important;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 200;
  background: rgba(var(--v-theme-surface), 0.88) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08) !important;
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0 4px;
}

.footer-label {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.56);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot--on {
  background: rgb(var(--v-theme-success));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-success), 0.2);
}

.status-dot--off {
  background: rgb(var(--v-theme-error));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-error), 0.2);
}

.footer-divider {
  width: 1px;
  height: 14px;
  background: rgba(var(--v-theme-on-surface), 0.18);
  margin: 0 12px;
  flex-shrink: 0;
}

.footer-dot {
  margin: 0 6px;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.28);
}

.footer-link {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.56);
  text-decoration: none;
  transition: color 0.2s;
}

.footer-link:hover {
  color: rgb(var(--v-theme-primary));
}
</style>
