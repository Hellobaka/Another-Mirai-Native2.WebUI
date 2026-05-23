import { defineStore } from 'pinia'
import { ref } from 'vue'

type ThemeMode = 'light' | 'dark'

const THEME_KEY = 'amn_theme'

function loadTheme(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'dark') return 'dark'
  if (saved === 'light') return 'light'
  return 'dark'
}

export const useAppStore = defineStore('app', () => {
  const themeMode = ref<ThemeMode>(loadTheme())
  const drawerOpen = ref(true)
  const rail = ref(false)
  const pageTitle = ref('')

  function toggleTheme() {
    themeMode.value = themeMode.value === 'dark' ? 'light' : 'dark'
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

  return { themeMode, drawerOpen, rail, pageTitle, toggleTheme, toggleDrawer, toggleRail, setPageTitle }
})
