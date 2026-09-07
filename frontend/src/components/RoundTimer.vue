<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Серверный дедлайн раунда в ISO 8601. */
    deadline: string
    /** Длительность раунда в секундах, нужна для прогресса. */
    duration?: number
  }>(),
  { duration: 0 },
)
const emit = defineEmits<{ expired: [] }>()

const now = ref(Date.now())
let interval: ReturnType<typeof setInterval> | null = null
let expiredSent = false

// Отсчёт ведётся от серверного дедлайна, а не от локальной длительности.
const remaining = computed(() => {
  const left = Math.floor((new Date(props.deadline).getTime() - now.value) / 1000)
  return left > 0 ? left : 0
})

const label = computed(() => {
  const value = remaining.value
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
})

const progress = computed(() =>
  props.duration > 0 ? Math.round((remaining.value / props.duration) * 100) : 0,
)

const color = computed(() => (remaining.value <= 10 ? 'error' : 'primary'))

function tick() {
  now.value = Date.now()
  if (!expiredSent && remaining.value === 0) {
    expiredSent = true
    emit('expired')
  }
}

function stop() {
  if (interval !== null) clearInterval(interval)
  interval = null
}

watch(
  () => props.deadline,
  () => {
    expiredSent = false
    stop()
    interval = setInterval(tick, 250)
    tick()
  },
  { immediate: true },
)

onUnmounted(stop)
</script>

<template>
  <v-progress-circular :model-value="progress" :color="color" size="72" width="6">
    <span class="text-body-1 font-weight-medium" data-testid="timer">{{ label }}</span>
  </v-progress-circular>
</template>
