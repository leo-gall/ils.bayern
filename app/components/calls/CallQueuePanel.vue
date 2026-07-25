<script setup lang="ts">
const props = defineProps<{ ilsId: string }>()
const game = useGameStore()
const engine = useDispatchEngine()

const ringing = computed(() =>
  game.ringingCalls.filter((c) => c.ilsId === props.ilsId)
)

const spawning = ref(false)

async function newCall() {
  if (spawning.value) return
  spawning.value = true
  try {
    const call = await engine.spawnRandomCall(props.ilsId)
    if (call) {
      // Mutate through the store's own reference, not the plain object the action
      // returned - assigning through game.calls[id] is what makes this reactive
      // (mutating the returned object directly leaves e.g. ringingCalls stale).
      const stored = game.calls[call.id]
      if (stored) {
        stored.status = 'aktiv'
        game.activeCallId = stored.id
      }
    }
  } finally {
    spawning.value = false
  }
}

function takeCall(callId: string) {
  const call = game.calls[callId]
  if (!call) return
  call.status = 'aktiv'
  game.activeCallId = callId
}
</script>

<template>
  <div class="flex shrink-0 flex-col gap-1.5">
    <div class="flex items-center justify-between">
      <h2 class="text-xs font-semibold text-muted uppercase tracking-wide">
        Notrufe
      </h2>
      <UButton size="xs" icon="i-lucide-phone-incoming" :loading="spawning" @click="newCall">
        Neuer Notruf
      </UButton>
    </div>
    <div v-if="ringing.length" class="max-h-20 space-y-1 overflow-y-auto">
      <button
        v-for="call in ringing"
        :key="call.id"
        class="flex w-full animate-pulse items-center justify-between rounded-md border border-default bg-elevated px-2 py-1 text-left"
        @click="takeCall(call.id)"
      >
        <span class="flex items-center gap-1.5 text-xs font-medium">
          <UIcon name="i-lucide-phone-incoming" class="text-error" />
          Notruf 112
        </span>
        <UButton size="xs" color="error">
          Annehmen
        </UButton>
      </button>
    </div>
  </div>
</template>
