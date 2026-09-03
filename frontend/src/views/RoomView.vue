<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { api } from '../lib/api.js'
import { session } from '../lib/session.js'
import { subscribeToRoom } from '../lib/roomEvents.js'
import RoundTimer from '../components/RoundTimer.vue'

const props = defineProps({ id: { type: String, required: true } })

const room = ref(null)
const error = ref('')
const notice = ref('')
const myVote = ref(null)
const newTask = ref({ title: '', description: '', external_url: '' })
const duration = ref(60)
let unsubscribe = null

const isOwner = computed(() => room.value && session.user && room.value.owner.id === session.user.id)

const activeTask = computed(
  () => room.value?.tasks.find((task) => task.last_round?.status === 'active') ?? null,
)
const activeRound = computed(() => activeTask.value?.last_round ?? null)

const finishedTask = computed(() => {
  if (activeTask.value) return null
  const withRounds = (room.value?.tasks ?? []).filter((task) => task.last_round?.status === 'finished')
  return withRounds.sort(
    (a, b) => new Date(b.last_round.finished_at) - new Date(a.last_round.finished_at),
  )[0] ?? null
})

async function reload() {
  try {
    room.value = await api.room(props.id)
    duration.value = room.value.default_timer_sec
    if (!activeRound.value) myVote.value = null
  } catch (e) {
    error.value = e.message
  }
}

function run(action) {
  error.value = ''
  return action().then(reload).catch((e) => {
    error.value = e.message
  })
}

watch(
  () => props.id,
  async (id) => {
    unsubscribe?.()
    myVote.value = null
    await reload()
    unsubscribe = subscribeToRoom(id, (event) => {
      if (event === 'round.started') myVote.value = null
      if (event === 'round.all_voted' && isOwner.value) {
        notice.value = 'Проголосовали все участники — можно остановить раунд.'
      }
      if (event === 'round.finished') notice.value = ''
      reload()
    })
  },
  { immediate: true },
)

onUnmounted(() => unsubscribe?.())

const inviteLink = computed(() =>
  room.value ? `${window.location.origin}/join/${room.value.invite_code}` : '',
)

function copyInvite() {
  navigator.clipboard?.writeText(inviteLink.value)
  notice.value = 'Ссылка скопирована'
}

function memberName(userId) {
  return room.value?.members.find((member) => member.id === userId)?.name ?? '—'
}

function hasVoted(userId) {
  return (activeRound.value?.voted_user_ids ?? []).includes(userId)
}

const createTask = () =>
  run(async () => {
    await api.createTask(props.id, newTask.value)
    newTask.value = { title: '', description: '', external_url: '' }
  })

const startRound = (task) => run(() => api.startRound(task.id, { duration_sec: Number(duration.value) }))
const finishRound = () => run(() => api.finishRound(activeRound.value.id))

const castVote = (value) =>
  run(async () => {
    if (myVote.value === value) {
      await api.retractVote(activeRound.value.id)
      myVote.value = null
    } else {
      await api.vote(activeRound.value.id, value)
      myVote.value = value
    }
  })

const finalize = (task, value) => run(() => api.estimate(task.id, value))
const removeTask = (task) => run(() => api.deleteTask(task.id))
</script>

<template>
  <p v-if="error" class="error">{{ error }}</p>
  <div v-if="room">
    <div class="card">
      <div class="between">
        <h1>{{ room.name }}</h1>
        <span class="badge">{{ room.scale.type }}</span>
      </div>
      <p class="muted">Участники: {{ room.members.map((m) => m.name).join(', ') }}</p>
      <div class="row">
        <input :value="inviteLink" readonly />
        <button class="secondary" type="button" @click="copyInvite">Скопировать ссылку</button>
      </div>
      <p v-if="notice" class="muted">{{ notice }}</p>
    </div>

    <div v-if="activeRound" class="card">
      <div class="between">
        <h2>Оценка: {{ activeTask.title }}</h2>
        <RoundTimer :deadline="activeRound.deadline_at" @expired="reload" />
      </div>
      <div class="cards">
        <button
          v-for="value in room.scale.votable"
          :key="value"
          type="button"
          class="vote-card"
          :class="{ selected: myVote === value }"
          @click="castVote(value)"
        >
          {{ value }}
        </button>
      </div>
      <p class="muted">
        Проголосовали {{ activeRound.voted_user_ids.length }} из {{ room.members.length }}:
        <template v-for="member in room.members" :key="member.id">
          <span class="badge" :class="{ active: hasVoted(member.id) }">{{ member.name }}</span>
        </template>
      </p>
      <button v-if="isOwner" class="secondary" type="button" @click="finishRound">
        Остановить оценку
      </button>
    </div>

    <div v-else-if="finishedTask" class="card">
      <h2>Результат: {{ finishedTask.title }}</h2>
      <table>
        <tbody>
          <tr v-for="vote in finishedTask.last_round.votes" :key="vote.user.id">
            <td>{{ vote.user.name }}</td>
            <td>{{ vote.value }}</td>
          </tr>
        </tbody>
      </table>
      <p class="muted" v-if="finishedTask.last_round.stats.numeric">
        Среднее {{ finishedTask.last_round.stats.average }}, медиана
        {{ finishedTask.last_round.stats.median }}
      </p>
      <p class="muted" v-else>
        Чаще всего выбирали: {{ finishedTask.last_round.stats.mode ?? '—' }}
      </p>
      <p v-if="finishedTask.last_round.stats.spread" class="error">
        Голоса сильно расходятся — стоит обсудить и переголосовать.
      </p>
      <div v-if="isOwner && !finishedTask.final_estimate" class="row">
        <span class="muted">Зафиксировать итог:</span>
        <button
          v-for="value in room.scale.values"
          :key="value"
          type="button"
          class="vote-card"
          :class="{ selected: value === finishedTask.last_round.stats.suggestion }"
          @click="finalize(finishedTask, value)"
        >
          {{ value }}
        </button>
      </div>
    </div>

    <div class="card">
      <div class="between">
        <h2>Задачи</h2>
        <label v-if="isOwner" class="muted">
          Таймер, сек
          <input v-model="duration" type="number" min="10" max="1800" style="width: 90px" />
        </label>
      </div>
      <p v-if="!room.tasks.length" class="muted">Задач пока нет.</p>
      <ul class="plain">
        <li v-for="task in room.tasks" :key="task.id" class="between">
          <span>
            {{ task.title }}
            <span v-if="task.final_estimate" class="badge done">{{ task.final_estimate }}</span>
            <span v-else-if="task.last_round?.status === 'active'" class="badge active">идёт оценка</span>
          </span>
          <span v-if="isOwner" class="row">
            <button type="button" :disabled="!!activeRound" @click="startRound(task)">
              Начать оценку
            </button>
            <button class="secondary" type="button" :disabled="!!activeRound" @click="removeTask(task)">
              Удалить
            </button>
          </span>
        </li>
      </ul>
    </div>

    <div v-if="isOwner" class="card">
      <h2>Новая задача</h2>
      <form @submit.prevent="createTask">
        <label>
          Название
          <input v-model="newTask.title" type="text" required />
        </label>
        <label>
          Описание
          <textarea v-model="newTask.description" rows="2"></textarea>
        </label>
        <label>
          Ссылка на тикет
          <input v-model="newTask.external_url" type="url" />
        </label>
        <button type="submit">Добавить</button>
      </form>
    </div>
  </div>
</template>
