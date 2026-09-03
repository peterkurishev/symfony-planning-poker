<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'

const props = defineProps({ deadline: { type: String, required: true } })
const emit = defineEmits(['expired'])

const now = ref(Date.now())
let interval = null
let expiredSent = false

function tick() {
  now.value = Date.now()
  if (!expiredSent && remaining.value === 0) {
    expiredSent = true
    emit('expired')
  }
}

// Отсчёт ведётся от серверного дедлайна, а не от локальной длительности.
const remaining = computed(() => {
  const left = Math.floor((new Date(props.deadline).getTime() - now.value) / 1000)
  return left > 0 ? left : 0
})

const label = computed(() => {
  const value = remaining.value
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
})

watch(
  () => props.deadline,
  () => {
    expiredSent = false
    clearInterval(interval)
    interval = setInterval(tick, 250)
    tick()
  },
  { immediate: true },
)

onUnmounted(() => clearInterval(interval))
</script>

<template>
  <span class="timer">{{ label }}</span>
</template>
