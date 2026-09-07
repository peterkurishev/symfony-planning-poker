import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import { ru } from 'vuetify/locale'

export const vuetify = createVuetify({
  locale: {
    locale: 'ru',
    messages: { ru },
  },
  icons: {
    defaultSet: 'mdi',
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1976d2',
          secondary: '#546e7a',
          surface: '#ffffff',
          background: '#f4f5f7',
          error: '#c62828',
          success: '#2e7d32',
        },
      },
    },
  },
  defaults: {
    VTextField: { variant: 'outlined', density: 'comfortable' },
    VTextarea: { variant: 'outlined', density: 'comfortable' },
    VSelect: { variant: 'outlined', density: 'comfortable' },
    VCard: { elevation: 1, rounded: 'lg' },
    VBtn: { variant: 'flat' },
  },
})
