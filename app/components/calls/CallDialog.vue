<script setup lang="ts">
const emit = defineEmits<{ incidentCreated: [incidentId: string], showOnMap: [point: { lat: number, lon: number }] }>()

const game = useGameStore()

const transcriptEl = ref<HTMLDivElement | null>(null)
const incidentFormOpen = ref(false)

const call = computed(() => game.activeCall)
// Still available after the call itself has ended (status 'beendet') - the dispatcher
// can log an Einsatz from what was learned even after the caller hung up.
const needsIncident = computed(() => !!call.value && !call.value.incidentId)

// Only the follow-ups this call hasn't been asked yet - each is fixed Q+A, no LLM.
const availableFollowUps = computed(() => {
  if (!call.value) return []
  const asked = new Set(call.value.messages.filter(m => m.role === 'disponent').map(m => m.text))
  return Object.entries(call.value.followUps).filter(([question]) => !asked.has(question))
})

watch(() => call.value?.messages.length, async () => {
  await nextTick()
  if (transcriptEl.value) transcriptEl.value.scrollTop = transcriptEl.value.scrollHeight
})

const engine = useDispatchEngine()

function askFollowUp(question: string) {
  if (!call.value) return
  engine.askFollowUp(call.value.id, question)
}

function endCall() {
  if (!call.value) return
  call.value.status = 'beendet'
  game.activeCallId = null
}

// Once an Einsatz has been logged, hanging up also gives the caller the standard
// reassurance that help is on the way - before that there's nothing to confirm yet, so
// the plain endCall() above is used instead. Doesn't clear activeCallId (unlike endCall)
// so the dispatcher can still see that final line land before moving on.
function endCallWithConfirmation() {
  if (!call.value) return
  engine.addCallMessage(call.value.id, 'disponent', 'Die Rettungskräfte sind bereits unterwegs zu Ihnen.')
  call.value.status = 'beendet'
}

function onIncidentCreated(incidentId: string) {
  incidentFormOpen.value = false
  emit('incidentCreated', incidentId)
}

function showOnMap() {
  if (!call.value) return
  emit('showOnMap', { lat: call.value.lat, lon: call.value.lon })
}
</script>

<template>
  <div
    v-if="call"
    class="flex h-full min-h-0 flex-col gap-2"
  >
    <div class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-1.5">
        <p class="min-w-0 truncate text-xs text-muted">
          {{ call.address ?? 'Adresse unbekannt' }}
        </p>
        <UBadge
          v-if="call.status === 'beendet'"
          size="xs"
          color="neutral"
          variant="subtle"
        >
          Anruf beendet
        </UBadge>
      </div>
      <UButton
        size="xs"
        color="neutral"
        variant="soft"
        icon="i-lucide-map-pin"
        @click="showOnMap"
      >
        Auf Karte anzeigen
      </UButton>
    </div>

    <div
      ref="transcriptEl"
      class="min-h-0 flex-1 space-y-1.5 overflow-y-auto rounded-md border border-default p-2"
    >
      <div
        v-for="msg in call.messages"
        :key="msg.id"
        class="max-w-[85%] rounded-lg px-2.5 py-1 text-xs"
        :class="msg.role === 'anrufer'
          ? 'bg-elevated'
          : 'ml-auto bg-primary text-inverted'"
      >
        {{ msg.text }}
      </div>
    </div>

    <div
      v-if="call.status !== 'beendet' && availableFollowUps.length"
      class="flex flex-wrap gap-1"
    >
      <UButton
        v-for="[question] in availableFollowUps"
        :key="question"
        size="xs"
        color="neutral"
        variant="soft"
        @click="askFollowUp(question)"
      >
        {{ question }}
      </UButton>
    </div>

    <div
      v-if="call.status !== 'beendet'"
      class="flex gap-1.5"
    >
      <template v-if="needsIncident">
        <UButton
          class="flex-1"
          block
          @click="incidentFormOpen = true"
        >
          Einsatz anlegen
        </UButton>
        <UButton
          color="error"
          icon="i-lucide-phone-off"
          @click="endCall"
        >
          Auflegen
        </UButton>
      </template>
      <UButton
        v-else
        color="success"
        block
        icon="i-lucide-phone-off"
        @click="endCallWithConfirmation"
      >
        Auflegen
      </UButton>
    </div>

    <UModal
      v-model:open="incidentFormOpen"
      title="Einsatz anlegen"
      :transition="false"
    >
      <template #body>
        <IncidentForm
          :call-id="call.id"
          @created="onIncidentCreated"
        />
      </template>
    </UModal>
  </div>
  <div
    v-else
    class="flex h-full items-center justify-center text-sm text-muted"
  >
    Kein aktiver Anruf.
  </div>
</template>
