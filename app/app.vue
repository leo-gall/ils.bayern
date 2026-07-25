<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'de'
  }
})

useSeoMeta({
  title: 'ils.bayern – Leitstellenspiel',
  description: 'Übernimm eine echte bayerische Integrierte Leitstelle und disponiere Rettungsdienst und Feuerwehr.',
  ogTitle: 'ils.bayern',
  ogDescription: 'Übernimm eine echte bayerische Integrierte Leitstelle und disponiere Rettungsdienst und Feuerwehr.'
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator color="#dc2626" />
    <NuxtPage />
  </UApp>
</template>
