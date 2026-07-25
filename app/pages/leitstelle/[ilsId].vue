<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const catalog = useCatalogStore()
const game = useGameStore()
const engine = useDispatchEngine()

const ilsId = computed(() => String(route.params.ilsId))
const ils = computed(() => catalog.getIls(ilsId.value))

if (!ils.value || !isIlsActive(ilsId.value)) {
  await navigateTo('/')
}

if (game.selectedIlsId !== ilsId.value || game.needsReset) {
  game.resetForIls(ilsId.value, engine.initializeUnitsForIls(ilsId.value))
}

useGameClock(ilsId)

const clockText = ref('')
let clockTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  const update = () => {
    clockText.value = new Date().toLocaleTimeString('de-DE')
  }
  update()
  clockTimer = setInterval(update, 1000)
})
onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})

function backToBavaria() {
  router.push('/')
}

// Notrufe (bottom-left) and Funk (bottom-right) are core, time-sensitive parts of the
// job and stay permanently visible under the map. Einsätze and the full vehicle browser
// are secondary/occasional lookups, so those live in on-demand slideovers/modals instead
// of eating screen space (and scroll) all the time.
const incidentsListOpen = ref(false)
const fleetOpen = ref(false)
const incidentOpen = ref(false)

const selectedIncidentId = ref<string | null>(null)
const selectedUnitId = ref<string | null>(null)

function openIncident(id: string) {
  selectedIncidentId.value = id
  incidentsListOpen.value = false
  incidentOpen.value = true
}

function selectUnit(unitId: string) {
  selectedUnitId.value = unitId
  fleetOpen.value = false
}

const openIncidentsCount = computed(() => game.openIncidents.filter(i => i.ilsId === ilsId.value).length)

const mapFocusPoint = ref<{ lat: number, lon: number } | null>(null)
function showCallOnMap(point: { lat: number, lon: number }) {
  mapFocusPoint.value = point
}
</script>

<template>
  <div
    v-if="ils"
    class="flex h-screen flex-col"
  >
    <header class="flex items-center justify-between border-b border-default px-4 py-1.5">
      <div class="flex items-center gap-3">
        <UButton
          size="xs"
          variant="ghost"
          icon="i-lucide-arrow-left"
          @click="backToBavaria"
        >
          Leitstellen
        </UButton>
        <h1 class="text-base font-semibold">
          {{ ils.name }}
        </h1>
      </div>
      <div class="flex items-center gap-2">
        <span class="mr-1 font-mono text-sm tabular-nums text-muted">{{ clockText }}</span>
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          icon="i-lucide-shield-alert"
          @click="incidentsListOpen = true"
        >
          Einsätze
          <UBadge
            v-if="openIncidentsCount"
            size="xs"
            color="neutral"
          >
            {{ openIncidentsCount }}
          </UBadge>
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          icon="i-lucide-truck"
          @click="fleetOpen = true"
        >
          Fahrzeuge
        </UButton>
        <UTooltip text="Standorte von Feuer-/Rettungswachen basieren auf OpenStreetMap-Daten. Fahrzeugbestückung je Wache ist mangels offener Daten simuliert.">
          <UBadge
            color="neutral"
            variant="subtle"
            size="xs"
          >
            <UIcon
              name="i-lucide-info"
              class="mr-1"
            />Datenhinweis
          </UBadge>
        </UTooltip>
      </div>
    </header>

    <div class="grid min-h-0 flex-1 grid-rows-[minmax(0,3fr)_minmax(0,2fr)]">
      <main class="min-h-0">
        <ClientOnly>
          <DispatchMap
            :ils-id="ilsId"
            :selected-incident-id="selectedIncidentId"
            :focus-point="mapFocusPoint"
            @select-incident="openIncident"
          />
        </ClientOnly>
      </main>

      <div class="grid min-h-0 grid-cols-2 border-t border-default">
        <!-- unten links: Notrufe (immer sichtbar, nicht scrollbar) -->
        <aside class="flex min-h-0 flex-col gap-2 border-r border-default p-3">
          <CallQueuePanel :ils-id="ilsId" />
          <USeparator />
          <CallDialog
            class="min-h-0 flex-1"
            @incident-created="openIncident"
            @show-on-map="showCallOnMap"
          />
        </aside>

        <!-- unten rechts: Funk (immer sichtbar) - gemeinsamer TMO-Kanal. Wer gerade "dran"
             ist, ergibt sich daraus, wer sich meldet (siehe RadioPanel) - die Leitstelle
             ruft nie von sich aus, daher keine separate anrufbare Fahrzeugliste mehr. -->
        <aside class="min-h-0 p-3">
          <RadioPanel
            :ils-id="ilsId"
            :selected-unit-id="selectedUnitId"
            @select="selectedUnitId = $event"
          />
        </aside>
      </div>
    </div>

    <USlideover
      v-model:open="incidentsListOpen"
      title="Einsätze"
      side="right"
      :transition="false"
    >
      <template #body>
        <IncidentList
          :ils-id="ilsId"
          :selected-incident-id="selectedIncidentId"
          @select="openIncident"
        />
      </template>
    </USlideover>

    <USlideover
      v-model:open="fleetOpen"
      title="Fahrzeuge"
      side="left"
      :transition="false"
    >
      <template #body>
        <FleetOverview
          :ils-id="ilsId"
          @select-unit="selectUnit"
        />
      </template>
    </USlideover>

    <IncidentModal
      v-model:open="incidentOpen"
      :incident-id="selectedIncidentId"
      @select-unit="selectUnit"
    />
  </div>
</template>
