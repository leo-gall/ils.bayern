<script setup lang="ts">
import * as turf from '@turf/turf'
import { getIncidentProgress } from '~/utils/incidentProgress'
import { getLeadUnit } from '~/utils/incidentCommand'
import type { UnitState } from '~/types/unit'

interface UnitDistance {
  unit: UnitState
  distanceKm: number
  etaMinutes: number | null
  routed: boolean
}

// Real routing distance/ETA is only fetched for the nearest-by-air candidates - querying
// it for every unit in the ILS area (Fürstenfeldbruck alone has ~400) would be far too
// many network round trips. Straight-line distance and real road distance are highly
// correlated at this range, so the far tail keeps its straight-line estimate.
const ROUTE_UPGRADE_COUNT = 25

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ incidentId: string | null }>()
const emit = defineEmits<{ selectUnit: [unitId: string] }>()

const game = useGameStore()
const catalog = useCatalogStore()
const engine = useDispatchEngine()
const { getEta } = useRouting()

const incident = computed(() => (props.incidentId ? game.incidents[props.incidentId] : null))
const search = ref('')

const statusLabel: Record<string, string> = {
  neu: 'Neu',
  in_bearbeitung: 'In Bearbeitung',
  einheiten_unterwegs: 'Einheiten unterwegs',
  vor_ort: 'Vor Ort',
  abgeschlossen: 'Abgeschlossen'
}

const assignedUnits = computed(() => {
  if (!incident.value) return []
  return incident.value.assignedUnitIds
    .map(id => game.units[id])
    .filter((u): u is UnitState => u != null)
})

const leadUnit = computed(() => (incident.value ? getLeadUnit(incident.value, game.units) : null))

// Progress is time-based (see getIncidentProgress), so it needs its own tick to visibly
// advance while the modal sits open rather than only updating on unrelated store changes.
const nowTick = ref(Date.now())
let tickTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  tickTimer = setInterval(() => { nowTick.value = Date.now() }, 2000)
})
onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer)
})
const progress = computed(() => {
  void nowTick.value
  return incident.value ? getIncidentProgress(incident.value, game.units) : 0
})

const allUnitsSorted = ref<UnitDistance[]>([])

watch(incident, async (inc) => {
  if (!inc) {
    allUnitsSorted.value = []
    return
  }

  const point = turf.point([inc.lon, inc.lat])
  const entries: UnitDistance[] = game.unitList
    .filter(u => u.ilsId === inc.ilsId)
    .map((u) => {
      const station = catalog.getStation(u.stationId)
      const distanceKm = station ? turf.distance(point, turf.point([station.lon, station.lat])) : Infinity
      return { unit: u, distanceKm, etaMinutes: null, routed: false }
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)

  allUnitsSorted.value = entries

  const nearest = entries.slice(0, ROUTE_UPGRADE_COUNT)
  await Promise.all(nearest.map(async (entry) => {
    const station = catalog.getStation(entry.unit.stationId)
    if (!station) return
    try {
      const eta = await getEta({ lat: station.lat, lon: station.lon }, { lat: inc.lat, lon: inc.lon })
      entry.distanceKm = eta.distanceMeters / 1000
      entry.etaMinutes = eta.durationSeconds / 60
      entry.routed = true
    } catch {
      // keep the straight-line fallback for this unit
    }
  }))

  allUnitsSorted.value = [...allUnitsSorted.value].sort((a, b) => a.distanceKm - b.distanceKm)
}, { immediate: true })

const filteredUnits = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return allUnitsSorted.value
  return allUnitsSorted.value.filter(e => e.unit.callSign.toLowerCase().includes(q) || e.unit.stationName.toLowerCase().includes(q))
})

function dispatch(unitId: string) {
  if (!incident.value) return
  engine.dispatchUnit(unitId, incident.value.id)
}

function openUnit(unitId: string) {
  open.value = false
  emit('selectUnit', unitId)
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="incident?.keyword ?? 'Einsatz'"
    :transition="false"
  >
    <template #body>
      <div
        v-if="incident"
        class="flex flex-col gap-3 font-mono text-xs"
      >
        <div class="flex items-center justify-between gap-2">
          <UBadge
            color="neutral"
            variant="subtle"
          >
            {{ statusLabel[incident.status] }}
          </UBadge>
          <UBadge
            v-if="incident.backupRequested"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
          >
            Nachforderung
          </UBadge>
        </div>
        <p class="text-muted">
          {{ incident.address ?? 'Adresse unbekannt' }}
        </p>

        <div class="flex items-center gap-2">
          <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
            <div
              class="h-full rounded-full bg-primary transition-all"
              :style="{ width: progress + '%' }"
            />
          </div>
          <span class="shrink-0 text-muted">{{ progress }} %</span>
        </div>
        <p
          v-if="leadUnit"
          class="text-muted"
        >
          Einsatzleitung: {{ leadUnit.callSign }}
        </p>

        <div
          v-if="assignedUnits.length"
          class="space-y-px"
        >
          <p class="text-[10px] font-semibold text-muted uppercase tracking-wide">
            Zugewiesene Einheiten
          </p>
          <button
            v-for="u in assignedUnits"
            :key="u.id"
            class="flex w-full items-center justify-between border-b border-default px-1.5 py-1 text-left hover:bg-elevated"
            @click="openUnit(u.id)"
          >
            <span>{{ u.callSign }}</span>
            <StatusPill :status="u.status" />
          </button>
        </div>

        <div class="flex min-h-0 flex-1 flex-col gap-1">
          <p class="text-[10px] font-semibold text-muted uppercase tracking-wide">
            Fahrzeuge im Bereich der Leitstelle ({{ allUnitsSorted.length }}, sortiert nach Entfernung)
          </p>
          <UInput
            v-model="search"
            size="xs"
            placeholder="Fahrzeug oder Wache suchen…"
            icon="i-lucide-search"
          />
          <div class="max-h-72 space-y-px overflow-y-auto">
            <div
              v-for="entry in filteredUnits"
              :key="entry.unit.id"
              class="flex items-center justify-between gap-2 border-b border-default px-1.5 py-1"
            >
              <div class="flex min-w-0 items-center gap-1.5">
                <StatusPill :status="entry.unit.status" />
                <span class="truncate">{{ entry.unit.callSign }}</span>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span class="text-muted">
                  {{ entry.distanceKm.toFixed(1) }} km<template v-if="entry.etaMinutes != null"> · ~{{ Math.round(entry.etaMinutes) }} min</template>
                </span>
                <UButton
                  size="xs"
                  :disabled="entry.unit.status !== 'frei'"
                  @click="dispatch(entry.unit.id)"
                >
                  Alarmieren
                </UButton>
              </div>
            </div>
            <p
              v-if="filteredUnits.length === 0"
              class="p-1.5 text-muted"
            >
              Keine Treffer.
            </p>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
