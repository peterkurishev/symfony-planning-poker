<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../lib/api.js'
import { setUser } from '../lib/session.js'

const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    setUser(await api.login({ email: email.value, password: password.value }))
    router.push(route.query.redirect ?? { name: 'rooms' })
  } catch (e) {
    error.value = e.status === 401 ? 'Неверный email или пароль' : e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <v-card class="mx-auto pa-6" max-width="440">
    <v-card-title class="text-h6 px-0">Вход</v-card-title>
    <v-form @submit.prevent="submit">
      <v-text-field
        v-model="email"
        label="Email"
        type="email"
        prepend-inner-icon="mdi-email-outline"
        autocomplete="email"
        required
      />
      <v-text-field
        v-model="password"
        label="Пароль"
        type="password"
        prepend-inner-icon="mdi-lock-outline"
        autocomplete="current-password"
        required
      />
      <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">
        {{ error }}
      </v-alert>
      <div class="d-flex align-center justify-space-between">
        <v-btn color="primary" type="submit" :loading="busy">Войти</v-btn>
        <v-btn variant="text" :to="{ name: 'register', query: route.query }">
          Зарегистрироваться
        </v-btn>
      </div>
    </v-form>
  </v-card>
</template>
