<script setup lang="ts">
import type { UnitState } from '~/types/unit'

const props = defineProps<{ ilsId: string }>()
const emit = defineEmits<{ selectUnit: [unitId: string] }>()

const game = useGameStore()

const search = ref('')

const allUnits = computed(() => game.unitList.filter(u => u.ilsId === props.ilsId))
const busyUnits = computed(() => allUnits.value.filter(u => u.status !== 'frei'))

const freeUnits = computed(() => {
  const free = allUnits.value.filter(u => u.status === 'frei')
  const q = search.value.trim().toLowerCase()
  const filtered = q ? free.filter(u => u.callSign.toLowerCase().includes(q) || u.stationName.toLowerCase().includes(q)) : free
  return filtered.slice(0, 60)
})

function openUnit(u: UnitState) {
  emit('selectUnit', u.id)
}
</script>

<template>
  <div class="flex h-full flex-col gap-3 font-mono text-xs">
    <h2 class="text-xs font-semibold text-muted uppercase tracking-wide">
      Fahrzeuge ({{ allUnits.length }})
    </h2>

    <div
      v-if="busyUnits.length"
      class="space-y-px"
    >
      <p class="text-[10px] font-semibold text-muted uppercase tracking-wide">
        Im Einsatz ({{ busyUnits.length }})
      </p>
      <button
        v-for="u in busyUnits"
        :key="u.id"
        class="flex w-full items-center justify-between border-b border-default px-1.5 py-1 text-left hover:bg-elevated"
        :title="u.stationName"
        @click="openUnit(u)"
      >
        <span class="truncate">{{ u.callSign }}</span>
        <StatusPill
          class="ml-2"
          :status="u.status"
        />
      </button>
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-1">
      <p class="text-[10px] font-semibold text-muted uppercase tracking-wide">
        Frei ({{ allUnits.length - busyUnits.length }})
      </p>
      <UInput
        v-model="search"
        size="xs"
        placeholder="Fahrzeug oder Wache suchen…"
        icon="i-lucide-search"
      />
      <div class="min-h-0 flex-1 overflow-y-auto">
        <div
          v-for="u in freeUnits"
          :key="u.id"
          class="flex items-center gap-1.5 border-b border-default px-1.5 py-1"
          :title="u.stationName"
        >
          <StatusPill :status="u.status" />
          <span class="truncate">{{ u.callSign }}</span>
        </div>
        <p
          v-if="freeUnits.length === 0"
          class="p-1.5 text-muted"
        >
          Keine Treffer.
        </p>
      </div>
    </div>
  </div>
</template>
