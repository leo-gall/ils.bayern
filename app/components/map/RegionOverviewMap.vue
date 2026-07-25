<script setup lang="ts">
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const catalog = useCatalogStore()
const mapEl = ref<HTMLDivElement | null>(null)
const emit = defineEmits<{ select: [ilsId: string] }>()

onMounted(() => {
  initMap()
})

function initMap() {
  if (!mapEl.value) return
  const map = L.map(mapEl.value, { renderer: L.canvas() }).setView([49.0, 11.4], 7)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> Mitwirkende',
    maxZoom: 18
  }).addTo(map)

  const layer = L.geoJSON(
    catalog.ilsRegions.map((ils) => ({
      type: 'Feature' as const,
      properties: { id: ils.id, name: ils.name, city: ils.city, active: isIlsActive(ils.id) },
      geometry: ils.area
    })),
    {
      style: (feature) => ({
        color: feature?.properties.active ? '#dc2626' : '#6b7280',
        weight: 1.5,
        fillColor: feature?.properties.active ? '#dc2626' : '#6b7280',
        fillOpacity: feature?.properties.active ? 0.08 : 0.04
      }),
      onEachFeature: (feature, geoLayer) => {
        const path = geoLayer as L.Path
        const active = feature.properties.active
        geoLayer.bindTooltip(active ? feature.properties.name : `${feature.properties.name} (bald verfügbar)`, { sticky: true })
        if (!active) return
        geoLayer.on('mouseover', () => path.setStyle({ fillOpacity: 0.25 }))
        geoLayer.on('mouseout', () => path.setStyle({ fillOpacity: 0.08 }))
        geoLayer.on('click', () => emit('select', feature.properties.id))
      }
    }
  ).addTo(map)

  map.fitBounds(layer.getBounds(), { padding: [16, 16] })
}
</script>

<template>
  <div ref="mapEl" class="h-full w-full cursor-pointer" />
</template>
