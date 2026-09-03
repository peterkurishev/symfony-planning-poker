<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../lib/api.js'

const props = defineProps({ code: { type: String, required: true } })
const router = useRouter()
const error = ref('')

onMounted(async () => {
  try {
    const room = await api.joinRoom(props.code)
    router.replace({ name: 'room', params: { id: room.id } })
  } catch (e) {
    error.value = e.status === 404 ? 'Комната не найдена' : e.message
  }
})
</script>

<template>
  <div class="card narrow">
    <h1 v-if="!error">Подключаемся к комнате…</h1>
    <template v-else>
      <h1>Не удалось войти</h1>
      <p class="error">{{ error }}</p>
      <RouterLink to="/rooms">К списку комнат</RouterLink>
    </template>
  </div>
</template>
