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
          background: '#141218',
          surface: '#1C1B1F',
          'surface-variant': '#2D2832',
          primary: '#D0BCFF',
          secondary: '#CCC2DC',
          accent: '#EFB8C8',
          error: '#FFB4AB',
          warning: '#FFB77D',
          success: '#6DD58C',
        },
      },
      light: {
        dark: false,
        colors: {
          background: '#F7F2FA',
          surface: '#FFFBFE',
          'surface-variant': '#E7E0EC',
          primary: '#6750A4',
          secondary: '#625B71',
          accent: '#7D5260',
          error: '#BA1A1A',
          warning: '#7D5700',
          success: '#1A7A4A',
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
