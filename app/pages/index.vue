<script setup lang="ts">
const catalog = useCatalogStore()
const router = useRouter()

function selectIls(ilsId: string) {
  if (!isIlsActive(ilsId)) return
  router.push(`/leitstelle/${ilsId}`)
}

const sortedRegions = computed(() =>
  [...catalog.ilsRegions].sort((a, b) => a.name.localeCompare(b.name, 'de'))
)
</script>

<template>
  <div class="flex h-screen flex-col">
    <header class="border-b border-default px-6 py-4">
      <h1 class="text-xl font-bold">
        ils.bayern
      </h1>
      <p class="text-sm text-muted">
        Wähle eine echte bayerische Integrierte Leitstelle und übernimm die Disposition.
      </p>
      <p class="mt-1 text-xs text-muted">
        Aktuell ist nur die ILS Fürstenfeldbruck spielbar - hier wurden Wachen und Fahrzeuge gegen echte Quellen geprüft. Die übrigen Leitstellen folgen.
      </p>
    </header>

    <div class="flex min-h-0 flex-1">
      <aside class="w-72 shrink-0 overflow-y-auto border-r border-default p-3">
        <ul class="space-y-1">
          <li v-for="ils in sortedRegions" :key="ils.id">
            <button
              class="w-full rounded-md px-3 py-2 text-left text-sm"
              :class="isIlsActive(ils.id) ? 'hover:bg-elevated' : 'cursor-not-allowed opacity-40'"
              :disabled="!isIlsActive(ils.id)"
              @click="selectIls(ils.id)"
            >
              <span class="font-medium">{{ ils.name }}</span>
              <span class="block text-xs text-muted">
                {{ ils.city }}
                <template v-if="!isIlsActive(ils.id)">· bald verfügbar</template>
              </span>
            </button>
          </li>
        </ul>
      </aside>

      <main class="min-w-0 flex-1">
        <ClientOnly>
          <RegionOverviewMap class="h-full w-full" @select="selectIls" />
        </ClientOnly>
      </main>
    </div>
  </div>
</template>
