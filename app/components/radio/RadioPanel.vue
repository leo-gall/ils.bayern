<script setup lang="ts">
import { radioQuickReplies } from '~/data/quick-replies'
import type { UnitStatus } from '~/types/unit'

const props = defineProps<{ ilsId: string, selectedUnitId: string | null }>()
const emit = defineEmits<{ select: [unitId: string] }>()

const game = useGameStore()
const { sendDispatcherMessage, acceptProactiveReport, pending } = useLlmRadio()

const draft = ref('')
const logEl = ref<HTMLDivElement | null>(null)
const accepting = ref(false)

// Units with an outstanding Sprechwunsch - they've called "kommen" but the dispatcher
// hasn't accepted yet, so the actual report content is still withheld (see
// useLlmRadio's requestProactiveReport/acceptProactiveReport). Shown first/most urgent.
const pendingUnits = computed(() =>
  game.unitList
    .filter(u => u.ilsId === props.ilsId && u.pendingReportKind != null)
    .sort((a, b) => (b.radioLog[b.radioLog.length - 1]?.timestamp ?? 0) - (a.radioLog[a.radioLog.length - 1]?.timestamp ?? 0))
)

// Units already accepted whose last message hasn't been answered by the dispatcher yet.
const openUnits = computed(() =>
  game.unitList
    .filter(u =>
      u.ilsId === props.ilsId && u.missionId && u.pendingReportKind == null
      && u.contactedForMissionId === u.missionId && u.radioLog.length > 0
      && u.radioLog[u.radioLog.length - 1]!.role === 'einheit')
    .sort((a, b) => b.radioLog[b.radioLog.length - 1]!.timestamp - a.radioLog[a.radioLog.length - 1]!.timestamp)
)

const explicitUnit = computed(() => (props.selectedUnitId ? game.units[props.selectedUnitId] : null))
// An explicit pick (from Fahrzeuge/Einsatz) wins; otherwise default to the most urgent
// unit needing attention, so the dispatcher doesn't have to hunt for who's on the line.
const activeUnit = computed(() => explicitUnit.value ?? pendingUnits.value[0] ?? openUnits.value[0] ?? null)

const isPending = computed(() => !!activeUnit.value?.pendingReportKind)
const isContacted = computed(() =>
  !!activeUnit.value && activeUnit.value.missionId != null && activeUnit.value.contactedForMissionId === activeUnit.value.missionId
)

interface FeedEntry {
  id: string
  callSign: string
  role: 'leitstelle' | 'einheit' | 'status'
  text: string
  status?: UnitStatus
  timestamp: number
}

// Bavarian BOS digital radio runs as a TMO group call - every unit on the channel hears
// every transmission, so this is one shared feed across all units, not per-unit logs.
// Capped to the most recent entries since status pills now log every FMS transition too.
const feed = computed<FeedEntry[]>(() => {
  const entries: FeedEntry[] = []
  for (const unit of game.unitList) {
    if (unit.ilsId !== props.ilsId) continue
    for (const msg of unit.radioLog) {
      entries.push({ id: msg.id, callSign: unit.callSign, role: msg.role, text: msg.text, status: msg.status, timestamp: msg.timestamp })
    }
  }
  return entries.sort((a, b) => a.timestamp - b.timestamp).slice(-200)
})

const quickReplyItems = computed(() =>
  radioQuickReplies.map(phrase => ({ label: phrase, onSelect: () => send(phrase) }))
)

watch(() => feed.value.length, async () => {
  await nextTick()
  if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
})

async function accept(unitId: string) {
  if (accepting.value) return
  accepting.value = true
  try {
    await acceptProactiveReport(unitId)
  } finally {
    accepting.value = false
  }
}

function selectUnit(unitId: string) {
  emit('select', unitId)
}

async function send(text: string) {
  if (!activeUnit.value || !isContacted.value || !text.trim() || pending.value) return
  draft.value = ''
  await sendDispatcherMessage(activeUnit.value.id, text.trim())
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-1.5">
    <div class="flex shrink-0 items-center justify-between gap-2">
      <h2 class="text-xs font-semibold text-muted uppercase tracking-wide">
        Funkverkehr (TMO)
      </h2>
      <span
        v-if="activeUnit"
        class="truncate text-[10px] text-muted"
      >
        an {{ activeUnit.callSign }}
      </span>
    </div>

    <div
      v-if="pendingUnits.length + openUnits.length > 1"
      class="flex shrink-0 flex-wrap gap-1"
    >
      <button
        v-for="u in pendingUnits"
        :key="u.id"
        class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono"
        :class="u.id === activeUnit?.id ? 'border-warning bg-warning/10' : 'border-default hover:bg-elevated'"
        @click="selectUnit(u.id)"
      >
        <UIcon
          name="i-lucide-phone-incoming"
          class="animate-pulse text-warning"
        />
        {{ u.callSign }}
      </button>
      <button
        v-for="u in openUnits"
        :key="u.id"
        class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono"
        :class="u.id === activeUnit?.id ? 'border-primary bg-primary/10' : 'border-default hover:bg-elevated'"
        @click="selectUnit(u.id)"
      >
        <UIcon
          name="i-lucide-radio-tower"
          class="animate-pulse text-primary"
        />
        {{ u.callSign }}
      </button>
    </div>

    <div
      ref="logEl"
      class="min-h-0 flex-1 space-y-1.5 overflow-y-auto rounded-md border border-default p-2"
    >
      <template
        v-for="msg in feed"
        :key="msg.id"
      >
        <div
          v-if="msg.role === 'status'"
          class="flex items-center justify-center gap-1.5 py-0.5 text-[10px] text-muted"
        >
          <span class="font-mono">{{ msg.callSign }}</span>
          <StatusPill
            v-if="msg.status"
            :status="msg.status"
            labeled
          />
        </div>
        <div
          v-else
          class="max-w-[85%] rounded-lg px-2.5 py-1 text-xs"
          :class="msg.role === 'einheit' ? 'bg-elevated' : 'ml-auto bg-primary text-inverted'"
        >
          <p class="mb-0.5 text-[10px] font-semibold opacity-70">
            {{ msg.callSign }}
          </p>
          {{ msg.text }}
        </div>
      </template>
      <p
        v-if="feed.length === 0"
        class="text-xs text-muted"
      >
        Noch kein Funkkontakt.
      </p>
      <p
        v-if="pending"
        class="text-xs text-muted italic"
      >
        Einheit antwortet…
      </p>
    </div>

    <p
      v-if="!activeUnit"
      class="shrink-0 text-xs text-muted"
    >
      Keine Einheit meldet sich gerade.
    </p>
    <div
      v-else-if="isPending"
      class="flex shrink-0 items-center justify-between gap-2 rounded-md border border-warning bg-warning/10 px-2 py-1.5"
    >
      <span class="flex items-center gap-1.5 text-xs font-medium">
        <UIcon
          name="i-lucide-phone-incoming"
          class="animate-pulse text-warning"
        />
        Sprechwunsch von {{ activeUnit.callSign }}
      </span>
      <UButton
        size="xs"
        color="warning"
        :loading="accepting"
        @click="accept(activeUnit.id)"
      >
        Annehmen
      </UButton>
    </div>
    <p
      v-else-if="!isContacted"
      class="shrink-0 text-xs text-muted italic"
    >
      Warte auf Funkkontakt von {{ activeUnit.callSign }}…
    </p>
    <form
      v-else
      class="flex shrink-0 gap-1.5"
      @submit.prevent="send(draft)"
    >
      <UDropdownMenu
        :items="quickReplyItems"
        :content="{ side: 'top' }"
      >
        <UButton
          icon="i-lucide-list"
          size="xs"
          color="neutral"
          variant="soft"
          :disabled="pending"
        />
      </UDropdownMenu>
      <UInput
        v-model="draft"
        size="xs"
        class="flex-1"
        placeholder="Funkspruch…"
        :disabled="pending"
      />
      <UButton
        size="xs"
        type="submit"
        :loading="pending"
      >
        Senden
      </UButton>
    </form>
  </div>
</template>
