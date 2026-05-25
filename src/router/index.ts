import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

import Login from '@/pages/Login.vue'
import MainLayout from '@/layouts/MainLayout.vue'
import Dashboard from '@/pages/Dashboard.vue'
import Plugins from '@/pages/Plugins.vue'
import Logs from '@/pages/Logs.vue'
import Settings from '@/pages/Settings.vue'
import Protocol from '@/pages/Protocol.vue'
import Chat from '@/pages/Chat.vue'

const router = createRouter({
  history: createWebHistory('/'),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: Login,
      meta: { public: true },
    },
    {
      path: '/',
      component: MainLayout,
      redirect: '/dashboard',
      children: [
        { path: 'dashboard', name: 'Dashboard', component: Dashboard },
        { path: 'plugins', name: 'Plugins', component: Plugins },
        { path: 'logs', name: 'Logs', component: Logs },
        { path: 'chat', name: 'Chat', component: Chat },
        { path: 'protocol', name: 'Protocol', component: Protocol },
        { path: 'settings', name: 'Settings', component: Settings },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard',
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.meta.public) return true

  if (!auth.token) return { name: 'Login' }

  await auth.tryRefreshIfNeeded()

  if (!auth.token) return { name: 'Login' }

  return true
})

export default router
