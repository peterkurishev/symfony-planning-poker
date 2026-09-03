<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../lib/api.js'

const router = useRouter()
const rooms = ref([])
const error = ref('')
const busy = ref(false)
const form = ref({ name: '', scale_type: 'fibonacci', scale_values: '', default_timer_sec: 60 })

onMounted(async () => {
  try {
    rooms.value = await api.rooms()
  } catch (e) {
    error.value = e.message
  }
})

async function create() {
  error.value = ''
  busy.value = true
  try {
    const room = await api.createRoom({
      name: form.value.name,
      scale_type: form.value.scale_type,
      scale_values: form.value.scale_type === 'custom' ? form.value.scale_values : null,
      default_timer_sec: Number(form.value.default_timer_sec),
    })
    router.push({ name: 'room', params: { id: room.id } })
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="card">
    <h1>Новая комната</h1>
    <form @submit.prevent="create">
      <label>
        Название
        <input v-model="form.name" type="text" required />
      </label>
      <label>
        Шкала оценки
        <select v-model="form.scale_type">
          <option value="fibonacci">Фибоначчи</option>
          <option value="pow2">Степени двойки</option>
          <option value="custom">Произвольная</option>
        </select>
      </label>
      <label v-if="form.scale_type === 'custom'">
        Значения через запятую
        <input v-model="form.scale_values" type="text" placeholder="XS, S, M, L, XL" />
      </label>
      <label>
        Таймер раунда, секунд
        <input v-model="form.default_timer_sec" type="number" min="10" max="1800" />
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="busy">Создать комнату</button>
    </form>
  </div>

  <div class="card">
    <h2>Мои комнаты</h2>
    <p v-if="!rooms.length" class="muted">Комнат пока нет.</p>
    <ul class="plain">
      <li v-for="room in rooms" :key="room.id" class="between">
        <RouterLink :to="{ name: 'room', params: { id: room.id } }">{{ room.name }}</RouterLink>
        <span class="muted">{{ room.members.length }} участн. · {{ room.scale.type }}</span>
      </li>
    </ul>
  </div>
</template>
