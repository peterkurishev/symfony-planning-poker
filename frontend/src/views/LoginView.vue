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
  <div class="card narrow">
    <h1>Вход</h1>
    <form @submit.prevent="submit">
      <label>
        Email
        <input v-model="email" type="email" required autocomplete="email" />
      </label>
      <label>
        Пароль
        <input v-model="password" type="password" required autocomplete="current-password" />
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="between">
        <button type="submit" :disabled="busy">Войти</button>
        <RouterLink :to="{ name: 'register', query: route.query }">Зарегистрироваться</RouterLink>
      </div>
    </form>
  </div>
</template>
