<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useNotifyStore } from '@/stores/notify'

const router = useRouter()
const auth = useAuthStore()
const app = useAppStore()
const notify = useNotifyStore()
const display = useDisplay()

const isMobile = computed(() => display.smAndDown.value)
const drawerPermanent = computed(() => !isMobile.value)

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

</script>

<template>
  <v-layout>
    <v-navigation-drawer
      v-model="app.drawerOpen"
      v-model:rail="app.rail"
      :permanent="drawerPermanent"
      elevation="0"
    >
      <v-list-item
        class="pa-4"
        title="AMN2"
        subtitle="管理面板"
        prepend-avatar="mdi-robot"
        nav
        @click="router.push('/dashboard')"
        style="cursor: pointer"
      />

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
        <v-app-bar-nav-icon
          v-if="isMobile"
          @click="app.toggleDrawer()"
        />
        <v-app-bar-nav-icon
          v-else
          @click="app.toggleRail()"
        />
      </template>
      <v-app-bar-title>{{ app.pageTitle }}</v-app-bar-title>

      <template #append>
        <v-btn
          :icon="app.themeMode === 'dark' ? 'mdi-weather-sunny' : 'mdi-weather-night'"
          variant="text"
          size="small"
          @click="app.toggleTheme()"
        />
        <v-btn
          icon="mdi-logout"
          variant="text"
          size="small"
          @click="logout"
        />
      </template>
    </v-app-bar>

    <v-main :style="{ paddingLeft: app.rail ? '56px' : '256px' }">
      <v-container fluid class="pa-4">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </v-container>
    </v-main>

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
            <v-icon :icon="n.severity === 'success' ? 'mdi-check-circle' : n.severity === 'error' ? 'mdi-alert-circle' : n.severity === 'warning' ? 'mdi-alert' : 'mdi-information'"
              class="mr-2" size="20" />
            <span class="text-body-2 flex-grow-1">{{ n.message }}</span>
            <v-btn variant="text" icon="mdi-close" size="x-small" density="compact" @click="notify.dismiss(n.id)" />
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
</style>
