<script setup>
import { useRouter } from 'vue-router'
import { logout, session } from './lib/session.js'

const router = useRouter()

async function onLogout() {
  await logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="topbar">
    <RouterLink class="brand" to="/rooms">Оценка задач</RouterLink>
    <div v-if="session.user" class="topbar-user">
      <span>{{ session.user.name }}</span>
      <button class="link" type="button" @click="onLogout">Выйти</button>
    </div>
  </header>

  <main class="page">
    <RouterView />
  </main>
</template>
