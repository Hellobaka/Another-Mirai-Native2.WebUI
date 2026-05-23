import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { md3 } from 'vuetify/blueprints'

import App from './App.vue'
import router from './router'

const vuetify = createVuetify({
  blueprint: md3,
  components,
  directives,
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          background: '#0F1219',
          surface: '#1A1D26',
          'surface-variant': '#262A35',
          primary: '#8CB4FF',
          secondary: '#B4C8E6',
          accent: '#FFB978',
          error: '#FF6B6B',
          warning: '#FFC857',
          success: '#4CAF84',
        },
      },
      light: {
        dark: false,
        colors: {
          background: '#F0F2F5',
          surface: '#FFFFFF',
          'surface-variant': '#E8ECF1',
          primary: '#3960A4',
          secondary: '#5A6D8C',
          accent: '#C75A1E',
          error: '#CF3A3A',
          warning: '#B8860B',
          success: '#2E7D5B',
        },
      },
    },
  },
})

const app = createApp(App)

app.use(createPinia())
app.use(vuetify)
app.use(router)

app.mount('#app')
