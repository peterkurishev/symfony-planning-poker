<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, errorMessage, errorStatus } from '../lib/api'

const props = defineProps<{ code: string }>()
const router = useRouter()
const error = ref('')

onMounted(async () => {
  try {
    const room = await api.joinRoom(props.code)
    router.replace({ name: 'room', params: { id: room.id } })
  } catch (e) {
    error.value = errorStatus(e) === 404 ? 'Комната не найдена' : errorMessage(e)
  }
})
</script>

<template>
  <v-card class="mx-auto pa-6 text-center" max-width="440">
    <template v-if="!error">
      <v-progress-circular indeterminate color="primary" class="mb-4" />
      <div>Подключаемся к комнате…</div>
    </template>
    <template v-else>
      <v-icon icon="mdi-door-closed-lock" size="48" color="error" class="mb-3" />
      <v-alert type="error" variant="tonal" density="compact" class="mb-4">{{ error }}</v-alert>
      <v-btn color="primary" to="/rooms">К списку комнат</v-btn>
    </template>
  </v-card>
</template>
