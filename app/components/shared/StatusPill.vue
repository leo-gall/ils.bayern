<script setup lang="ts">
import { BOS_STATUS } from '~/utils/bosStatus'
import type { UnitStatus } from '~/types/unit'

withDefaults(defineProps<{ status: UnitStatus, labeled?: boolean }>(), { labeled: false })
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
    :class="BOS_STATUS[status].className"
    :title="BOS_STATUS[status].label"
  >
    <span>{{ BOS_STATUS[status].code }}</span>
    <span
      v-if="labeled"
      class="font-normal"
    >{{ BOS_STATUS[status].label }}</span>
  </span>
</template>
