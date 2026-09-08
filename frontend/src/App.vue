<script setup lang="ts">
import { useRouter } from 'vue-router'
import { logout, session } from './lib/session'

const router = useRouter()

async function onLogout() {
  await logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable" flat>
      <v-app-bar-title>
        <RouterLink to="/rooms" class="text-white text-decoration-none">Оценка задач</RouterLink>
      </v-app-bar-title>
      <template v-if="session.user" #append>
        <span class="mr-3 text-body-2">{{ session.user.name }}</span>
        <v-btn variant="text" prepend-icon="mdi-logout" @click="onLogout">Выйти</v-btn>
      </template>
    </v-app-bar>

    <v-main>
      <v-container class="py-6" style="max-width: 960px">
        <RouterView />
      </v-container>
    </v-main>
  </v-app>
</template>
