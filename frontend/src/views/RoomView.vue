<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { api } from '../lib/api.js'
import { session } from '../lib/session.js'
import { subscribeToRoom } from '../lib/roomEvents.js'
import RoundTimer from '../components/RoundTimer.vue'

const props = defineProps({ id: { type: String, required: true } })

const room = ref(null)
const error = ref('')
const snackbar = ref({ show: false, text: '' })
const myVote = ref(null)
const newTask = ref({ title: '', description: '', external_url: '' })
const duration = ref(60)
const taskDialog = ref(false)
let unsubscribe = null

const isOwner = computed(() => room.value && session.user && room.value.owner.id === session.user.id)

const activeTask = computed(
  () => room.value?.tasks.find((task) => task.last_round?.status === 'active') ?? null,
)
const activeRound = computed(() => activeTask.value?.last_round ?? null)

const finishedTask = computed(() => {
  if (activeTask.value) return null
  const withRounds = (room.value?.tasks ?? []).filter((task) => task.last_round?.status === 'finished')
  return (
    withRounds.sort((a, b) => new Date(b.last_round.finished_at) - new Date(a.last_round.finished_at))[0] ??
    null
  )
})

const inviteLink = computed(() =>
  room.value ? `${window.location.origin}/join/${room.value.invite_code}` : '',
)

const votedCount = computed(() => activeRound.value?.voted_user_ids.length ?? 0)

function toast(text) {
  snackbar.value = { show: true, text }
}

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
  return action()
    .then(reload)
    .catch((e) => {
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
        toast('Проголосовали все участники — можно остановить раунд')
      }
      reload()
    })
  },
  { immediate: true },
)

onUnmounted(() => unsubscribe?.())

function copyInvite() {
  navigator.clipboard?.writeText(inviteLink.value)
  toast('Ссылка скопирована')
}

const hasVoted = (userId) => (activeRound.value?.voted_user_ids ?? []).includes(userId)

const createTask = () =>
  run(async () => {
    await api.createTask(props.id, newTask.value)
    newTask.value = { title: '', description: '', external_url: '' }
    taskDialog.value = false
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
  <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4" closable>
    {{ error }}
  </v-alert>

  <template v-if="room">
    <v-card class="pa-6 mb-6">
      <div class="d-flex align-center justify-space-between flex-wrap ga-2">
        <h1 class="text-h6 ma-0">{{ room.name }}</h1>
        <div class="d-flex ga-2">
          <v-chip size="small" variant="tonal" prepend-icon="mdi-scale-balance" data-testid="room-scale">
            {{ room.scale.type }}
          </v-chip>
          <v-chip size="small" variant="tonal" prepend-icon="mdi-timer-outline">
            {{ room.default_timer_sec }} c
          </v-chip>
        </div>
      </div>

      <div class="d-flex align-center flex-wrap ga-1 my-3" data-testid="members">
        <v-chip
          v-for="member in room.members"
          :key="member.id"
          size="small"
          data-testid="member"
          :class="{ active: hasVoted(member.id) }"
          :color="hasVoted(member.id) ? 'success' : undefined"
          :variant="hasVoted(member.id) ? 'flat' : 'outlined'"
          :prepend-icon="hasVoted(member.id) ? 'mdi-check' : 'mdi-account-outline'"
        >
          {{ member.name }}
        </v-chip>
      </div>

      <v-text-field
        :model-value="inviteLink"
        label="Ссылка-приглашение"
        readonly
        hide-details
      >
        <template #append-inner>
          <v-btn
            icon="mdi-content-copy"
            variant="text"
            size="small"
            aria-label="Скопировать ссылку"
            title="Скопировать ссылку"
            @click="copyInvite"
          />
        </template>
      </v-text-field>
    </v-card>

    <v-card v-if="activeRound" class="pa-6 mb-6" data-testid="active-round">
      <div class="d-flex align-center justify-space-between flex-wrap ga-4">
        <div>
          <div class="text-overline text-medium-emphasis">Идёт оценка</div>
          <h2 class="text-h6 ma-0">{{ activeTask.title }}</h2>
        </div>
        <RoundTimer
          :deadline="activeRound.deadline_at"
          :duration="activeRound.duration_sec"
          @expired="reload"
        />
      </div>

      <v-divider class="my-4" />

      <div class="d-flex flex-wrap ga-2">
        <v-btn
          v-for="value in room.scale.votable"
          :key="value"
          :color="myVote === value ? 'primary' : undefined"
          :variant="myVote === value ? 'flat' : 'outlined'"
          size="large"
          :class="['vote-card', { selected: myVote === value }]"
          :aria-pressed="myVote === value"
          @click="castVote(value)"
        >
          {{ value }}
        </v-btn>
      </div>

      <v-progress-linear
        :model-value="(votedCount / room.members.length) * 100"
        color="success"
        height="6"
        rounded
        class="mt-4"
      />
      <div class="text-body-2 text-medium-emphasis mt-2">
        Проголосовали {{ votedCount }} из {{ room.members.length }}
      </div>

      <v-btn
        v-if="isOwner"
        class="mt-4"
        color="secondary"
        prepend-icon="mdi-stop-circle-outline"
        @click="finishRound"
      >
        Остановить оценку
      </v-btn>
    </v-card>

    <v-card v-else-if="finishedTask" class="pa-6 mb-6" data-testid="finished-round">
      <div class="text-overline text-medium-emphasis">Результат раунда</div>
      <h2 class="text-h6 ma-0 mb-3">{{ finishedTask.title }}</h2>

      <v-table density="compact">
        <tbody>
          <tr v-for="vote in finishedTask.last_round.votes" :key="vote.user.id">
            <td>{{ vote.user.name }}</td>
            <td class="text-right font-weight-medium">{{ vote.value }}</td>
          </tr>
        </tbody>
      </v-table>

      <div class="d-flex ga-2 flex-wrap mt-4">
        <template v-if="finishedTask.last_round.stats.numeric">
          <v-chip variant="tonal">Среднее: {{ finishedTask.last_round.stats.average }}</v-chip>
          <v-chip variant="tonal">Медиана: {{ finishedTask.last_round.stats.median }}</v-chip>
        </template>
        <v-chip v-else variant="tonal">
          Чаще всего: {{ finishedTask.last_round.stats.mode ?? '—' }}
        </v-chip>
      </div>

      <v-alert
        v-if="finishedTask.last_round.stats.spread"
        type="warning"
        variant="tonal"
        density="compact"
        class="mt-4"
      >
        Голоса сильно расходятся — стоит обсудить и переголосовать.
      </v-alert>

      <template v-if="isOwner && !finishedTask.final_estimate">
        <v-divider class="my-4" />
        <div class="text-body-2 text-medium-emphasis mb-2">Зафиксировать итоговую оценку</div>
        <div class="d-flex flex-wrap ga-2">
          <v-btn
            v-for="value in room.scale.values"
            :key="value"
            :color="value === finishedTask.last_round.stats.suggestion ? 'primary' : undefined"
            :variant="value === finishedTask.last_round.stats.suggestion ? 'flat' : 'outlined'"
            :class="['vote-card', { selected: value === finishedTask.last_round.stats.suggestion }]"
            @click="finalize(finishedTask, value)"
          >
            {{ value }}
          </v-btn>
        </div>
      </template>
    </v-card>

    <v-card data-testid="tasks">
      <v-card-title class="d-flex align-center justify-space-between flex-wrap ga-2">
        <h2 class="text-h6 ma-0">Задачи</h2>
        <div v-if="isOwner" class="d-flex align-center ga-2">
          <v-text-field
            v-model="duration"
            label="Таймер, сек"
            type="number"
            min="10"
            max="1800"
            density="compact"
            hide-details
            style="width: 140px"
          />
          <v-btn color="primary" prepend-icon="mdi-plus" @click="taskDialog = true">Задача</v-btn>
        </div>
      </v-card-title>

      <v-card-text v-if="!room.tasks.length" class="text-medium-emphasis">
        Задач пока нет.
      </v-card-text>

      <v-list v-else lines="two">
        <v-list-item v-for="task in room.tasks" :key="task.id" :title="task.title">
          <template #subtitle>
            <span v-if="task.description">{{ task.description }}</span>
            <a v-else-if="task.external_url" :href="task.external_url" target="_blank">
              {{ task.external_url }}
            </a>
          </template>
          <template #prepend>
            <v-chip v-if="task.final_estimate" color="success" size="small" class="mr-3" data-testid="task-estimate">
              {{ task.final_estimate }}
            </v-chip>
            <v-chip
              v-else-if="task.last_round?.status === 'active'"
              color="primary"
              size="small"
              class="mr-3"
              data-testid="task-status"
            >
              идёт
            </v-chip>
            <v-chip v-else size="small" variant="outlined" class="mr-3" data-testid="task-status">—</v-chip>
          </template>
          <template v-if="isOwner" #append>
            <v-btn
              variant="text"
              icon="mdi-play-circle-outline"
              aria-label="Начать оценку"
              title="Начать оценку"
              :disabled="!!activeRound"
              @click="startRound(task)"
            />
            <v-btn
              variant="text"
              icon="mdi-delete-outline"
              aria-label="Удалить"
              title="Удалить"
              :disabled="!!activeRound"
              @click="removeTask(task)"
            />
          </template>
        </v-list-item>
      </v-list>
    </v-card>

    <v-dialog v-model="taskDialog" max-width="520">
      <v-card class="pa-6">
        <v-card-title class="px-0"><h2 class="text-h6 ma-0">Новая задача</h2></v-card-title>
        <v-form @submit.prevent="createTask">
          <v-text-field v-model="newTask.title" label="Название" required />
          <v-textarea v-model="newTask.description" label="Описание" rows="3" />
          <v-text-field v-model="newTask.external_url" label="Ссылка на тикет" type="url" />
          <div class="d-flex justify-end ga-2">
            <v-btn variant="text" @click="taskDialog = false">Отмена</v-btn>
            <v-btn color="primary" type="submit">Добавить</v-btn>
          </div>
        </v-form>
      </v-card>
    </v-dialog>
  </template>

  <v-skeleton-loader v-else type="card" />

  <v-snackbar v-model="snackbar.show" timeout="3000">{{ snackbar.text }}</v-snackbar>
</template>

<style scoped>
.vote-card {
  min-width: 64px;
}
</style>
