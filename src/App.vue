<script setup lang="ts">
import { useAppStore } from '@/stores/app'

const app = useAppStore()
</script>

<template>
  <v-app :theme="app.themeMode">
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </v-app>
</template>

<style>
@import '@/styles/variables.css';

body,
body * {
  font-family: 'Noto Sans Mono', sans-serif !important;
  font-optical-sizing: auto;
  font-variation-settings: 'wdth' 100;
}
</style>
