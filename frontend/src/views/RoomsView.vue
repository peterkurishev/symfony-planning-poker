<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, errorMessage } from '../lib/api'
import type { RoomSummary, ScaleType } from '../types/api'

interface RoomForm {
  name: string
  scale_type: ScaleType
  scale_values: string
  /** Поле type="number" отдаёт строку, поэтому приводим к числу при отправке. */
  default_timer_sec: number | string
}

const router = useRouter()
const rooms = ref<RoomSummary[]>([])
const error = ref('')
const busy = ref(false)
const loading = ref(true)
const form = ref<RoomForm>({ name: '', scale_type: 'fibonacci', scale_values: '', default_timer_sec: 60 })

const scaleTypes: { title: string; value: ScaleType }[] = [
  { title: 'Фибоначчи', value: 'fibonacci' },
  { title: 'Степени двойки', value: 'pow2' },
  { title: 'Произвольная', value: 'custom' },
]

const scaleTitle = (type: ScaleType) => scaleTypes.find((item) => item.value === type)?.title ?? type

onMounted(async () => {
  try {
    rooms.value = await api.rooms()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
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
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <v-card class="pa-6 mb-6">
    <v-card-title class="text-h6 px-0">Новая комната</v-card-title>
    <v-form @submit.prevent="create">
      <v-row dense>
        <v-col cols="12" md="6">
          <v-text-field v-model="form.name" label="Название" required />
        </v-col>
        <v-col cols="12" md="4">
          <v-select v-model="form.scale_type" :items="scaleTypes" label="Шкала оценки" />
        </v-col>
        <v-col cols="12" md="2">
          <v-text-field
            v-model="form.default_timer_sec"
            label="Таймер, сек"
            type="number"
            min="10"
            max="1800"
          />
        </v-col>
        <v-col v-if="form.scale_type === 'custom'" cols="12">
          <v-text-field
            v-model="form.scale_values"
            label="Значения через запятую"
            placeholder="XS, S, M, L, XL"
            hint="От 2 до 30 уникальных значений"
            persistent-hint
          />
        </v-col>
      </v-row>
      <v-alert v-if="error" type="error" variant="tonal" density="compact" class="my-4">
        {{ error }}
      </v-alert>
      <v-btn color="primary" type="submit" :loading="busy" prepend-icon="mdi-plus" class="mt-2">
        Создать комнату
      </v-btn>
    </v-form>
  </v-card>

  <v-card>
    <v-card-title class="text-h6">Мои комнаты</v-card-title>
    <v-skeleton-loader v-if="loading" type="list-item-two-line@2" />
    <v-card-text v-else-if="!rooms.length" class="text-medium-emphasis">
      Комнат пока нет.
    </v-card-text>
    <v-list v-else lines="two">
      <v-list-item
        v-for="room in rooms"
        :key="room.id"
        :to="{ name: 'room', params: { id: room.id } }"
        :title="room.name"
        :subtitle="`${room.members.length} участн. · ${scaleTitle(room.scale.type)}`"
        prepend-icon="mdi-account-group-outline"
      >
        <template #append>
          <v-icon icon="mdi-chevron-right" />
        </template>
      </v-list-item>
    </v-list>
  </v-card>
</template>
