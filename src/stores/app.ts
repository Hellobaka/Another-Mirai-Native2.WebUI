import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getWebUIConfig } from '@/api/config'

type ThemeMode = 'light' | 'dark' | 'auto'

const THEME_KEY = 'amn_theme'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function loadTheme(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'dark' || saved === 'light' || saved === 'auto') return saved
  return 'dark'
}

export const useAppStore = defineStore('app', () => {
  const themeMode = ref<ThemeMode>(loadTheme())
  const systemTheme = ref<'light' | 'dark'>(getSystemTheme())
  const drawerOpen = ref(true)
  const rail = ref(false)
  const pageTitle = ref('')

  // WebUI feature flags
  const enableChat = ref(true)
  const enableFileManager = ref(false)
  const enableTerminal = ref(false)
  const webuiConfigLoaded = ref(false)

  // Follow system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    systemTheme.value = e.matches ? 'dark' : 'light'
  })

  const effectiveTheme = computed<'light' | 'dark'>(() =>
    themeMode.value === 'auto' ? systemTheme.value : themeMode.value
  )

  function toggleTheme() {
    const cycle: ThemeMode[] = ['dark', 'light', 'auto']
    themeMode.value = cycle[(cycle.indexOf(themeMode.value) + 1) % cycle.length]
    localStorage.setItem(THEME_KEY, themeMode.value)
  }

  function toggleDrawer() {
    drawerOpen.value = !drawerOpen.value
  }

  function toggleRail() {
    rail.value = !rail.value
  }

  function setPageTitle(title: string) {
    pageTitle.value = title
  }

  async function fetchWebUIConfig() {
    if (webuiConfigLoaded.value) return
    try {
      const res = await getWebUIConfig()
      if (res.data.code === 0) {
        const cfg = res.data.data
        enableChat.value = cfg.EnableChat?.value !== false
        enableFileManager.value = cfg.EnableFileManager?.value === true
        enableTerminal.value = cfg.EnableTerminal?.value === true
        webuiConfigLoaded.value = true
      }
    } catch { /* keep defaults */ }
  }

  return {
    themeMode, effectiveTheme, drawerOpen, rail, pageTitle,
    enableChat, enableFileManager, enableTerminal, webuiConfigLoaded,
    toggleTheme, toggleDrawer, toggleRail, setPageTitle, fetchWebUIConfig,
  }
})
