<script setup lang="ts">
const props = defineProps<{ ilsId: string, selectedIncidentId: string | null }>()
const emit = defineEmits<{ select: [incidentId: string] }>()

const game = useGameStore()

const incidents = computed(() =>
  game.openIncidents
    .filter((i) => i.ilsId === props.ilsId)
    .sort((a, b) => b.createdAt - a.createdAt)
)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <h2 class="text-xs font-semibold text-muted uppercase tracking-wide">
      Einsätze ({{ incidents.length }})
    </h2>
    <p v-if="incidents.length === 0" class="text-sm text-muted">
      Noch keine Einsätze angelegt.
    </p>
    <button
      v-for="i in incidents"
      :key="i.id"
      class="rounded-md border px-2 py-1.5 text-left text-xs"
      :class="i.id === props.selectedIncidentId ? 'border-primary bg-primary/10' : 'border-default hover:bg-elevated'"
      @click="emit('select', i.id)"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="font-medium">{{ i.keyword }}</span>
      </div>
      <p class="mt-0.5 text-muted">
        {{ i.address ?? 'Adresse unbekannt' }}
      </p>
      <p class="mt-0.5 text-muted">
        {{ i.assignedUnitIds.length }} Einheit(en) zugewiesen
      </p>
    </button>
  </div>
</template>
