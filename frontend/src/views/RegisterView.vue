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
  <div class="card narrow">
    <h1>Регистрация</h1>
    <form @submit.prevent="submit">
      <label>
        Email
        <input v-model="form.email" type="email" required autocomplete="email" />
      </label>
      <p v-if="errors.email" class="error">{{ errors.email }}</p>
      <label>
        Имя
        <input v-model="form.name" type="text" required />
      </label>
      <p v-if="errors.name" class="error">{{ errors.name }}</p>
      <label>
        Пароль
        <input v-model="form.password" type="password" required autocomplete="new-password" />
      </label>
      <p v-if="errors.password" class="error">{{ errors.password }}</p>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="between">
        <button type="submit" :disabled="busy">Создать аккаунт</button>
        <RouterLink :to="{ name: 'login', query: route.query }">У меня есть аккаунт</RouterLink>
      </div>
    </form>
  </div>
</template>
