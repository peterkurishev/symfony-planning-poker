<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../lib/api.js'
import { setUser } from '../lib/session.js'

const route = useRoute()
const router = useRouter()

const form = ref({ email: '', name: '', password: '' })
const errors = ref({})
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  errors.value = {}
  busy.value = true
  try {
    setUser(await api.register(form.value))
    router.push(route.query.redirect ?? { name: 'rooms' })
  } catch (e) {
    errors.value = e.errors ?? {}
    error.value = e.errors ? '' : e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <v-card class="mx-auto pa-6" max-width="440">
    <v-card-title class="text-h6 px-0">Регистрация</v-card-title>
    <v-form @submit.prevent="submit">
      <v-text-field
        v-model="form.email"
        label="Email"
        type="email"
        prepend-inner-icon="mdi-email-outline"
        :error-messages="errors.email"
        required
      />
      <v-text-field
        v-model="form.name"
        label="Имя"
        prepend-inner-icon="mdi-account-outline"
        :error-messages="errors.name"
        required
      />
      <v-text-field
        v-model="form.password"
        label="Пароль"
        type="password"
        prepend-inner-icon="mdi-lock-outline"
        :error-messages="errors.password"
        autocomplete="new-password"
        required
      />
      <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">
        {{ error }}
      </v-alert>
      <div class="d-flex align-center justify-space-between">
        <v-btn color="primary" type="submit" :loading="busy">Создать аккаунт</v-btn>
        <v-btn variant="text" :to="{ name: 'login', query: route.query }">У меня есть аккаунт</v-btn>
      </div>
    </v-form>
  </v-card>
</template>
