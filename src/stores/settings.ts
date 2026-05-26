import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getApiBaseUrl, setApiBaseUrl as persistBaseUrl } from '@/api/baseUrl'
import http from '@/api/client'

export const useSettingsStore = defineStore('settings', () => {
  const apiBaseUrl = ref(getApiBaseUrl())
  const modalOpen = ref(false)

  function openModal() {
    modalOpen.value = true
  }

  function closeModal() {
    modalOpen.value = false
  }

  function applyBaseUrl(url: string) {
    const trimmed = url.trim().replace(/\/+$/, '')
    apiBaseUrl.value = trimmed
    persistBaseUrl(trimmed)
    http.defaults.baseURL = trimmed ? `${trimmed}/api` : '/api'
  }

  function resetBaseUrl() {
    const envUrl = import.meta.env.VITE_API_BASE_URL || ''
    apiBaseUrl.value = envUrl
    persistBaseUrl('')
    http.defaults.baseURL = envUrl ? `${envUrl}/api` : '/api'
  }

  return { apiBaseUrl, modalOpen, openModal, closeModal, applyBaseUrl, resetBaseUrl }
})
