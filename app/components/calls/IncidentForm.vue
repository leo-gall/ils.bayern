<script setup lang="ts">
import { EINSATZSTICHWORTE, type KeywordOption } from '~/data/incident-keywords'
import { severityFromCode } from '~/utils/severity'

interface KeywordItem extends KeywordOption {
  display: string
}

const props = defineProps<{ callId: string }>()
const emit = defineEmits<{ created: [incidentId: string] }>()

const engine = useDispatchEngine()

const keyword = ref<KeywordItem | undefined>(undefined)
const customKeyword = ref('')

const keywordOptions: KeywordItem[] = EINSATZSTICHWORTE.map((kw) => ({ ...kw, display: `${kw.label} (${kw.code})` }))

const finalKeyword = computed(() => {
  if (customKeyword.value.trim()) return customKeyword.value.trim()
  if (keyword.value) return `${keyword.value.label} (${keyword.value.code})`
  return null
})
const canSubmit = computed(() => !!finalKeyword.value)

function submit() {
  if (!canSubmit.value) return
  const incident = engine.createIncidentFromCall(props.callId, {
    keyword: finalKeyword.value!,
    severity: keyword.value ? severityFromCode(keyword.value.code) : 'niedrig'
  })
  if (incident) emit('created', incident.id)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <p class="text-[10px] text-muted">
      Einsatzstichwort nach bayerischem Schema ({{ keywordOptions.length }} verfügbar, Feuerwehr und Rettungsdienst gemeinsam)
    </p>
    <USelectMenu
      v-model="keyword"
      :items="keywordOptions"
      label-key="display"
      :virtualize="keywordOptions.length > 50"
      size="xs"
      placeholder="Stichwort suchen…"
      class="w-full"
      @update:model-value="customKeyword = ''"
    />
    <UInput
      v-model="customKeyword"
      size="xs"
      placeholder="Eigenes Stichwort (optional)…"
      @update:model-value="keyword = undefined"
    />

    <UButton :disabled="!canSubmit" @click="submit">
      Einsatz anlegen
    </UButton>
  </div>
</template>
