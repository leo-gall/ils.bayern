<script setup lang="ts">
import L from 'leaflet'
import * as turf from '@turf/turf'
import 'leaflet/dist/leaflet.css'
import { BOS_STATUS } from '~/utils/bosStatus'
import type { UnitState } from '~/types/unit'

interface FocusPoint {
  lat: number
  lon: number
}

const props = defineProps<{ ilsId: string, selectedIncidentId: string | null, focusPoint?: FocusPoint | null }>()
const emit = defineEmits<{ selectIncident: [incidentId: string] }>()

const catalog = useCatalogStore()
const game = useGameStore()

const mapEl = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
let incidentLayer: L.LayerGroup | null = null
let callLayer: L.LayerGroup | null = null
let unitLayer: L.LayerGroup | null = null
let unitAnimTimer: ReturnType<typeof setInterval> | null = null

const severityColor: Record<string, string> = {
  niedrig: '#65a30d',
  mittel: '#d97706',
  hoch: '#dc2626',
  kritisch: '#991b1b'
}

function houseIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 11 L12 3 L21 11 V21 H3 Z" fill="${color}" stroke="#1f2937" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>`,
    iconSize: [18, 18],
    iconAnchor: [9, 15]
  })
}

const fireIcon = houseIcon('#dc2626')
const rescueIcon = houseIcon('#2563eb')
const bereitschaftIcon = houseIcon('#7c3aed')

const STATION_ICON: Record<string, L.DivIcon> = {
  feuerwache: fireIcon,
  rettungswache: rescueIcon,
  bereitschaft: bereitschaftIcon
}

function drawStations() {
  if (!map) return
  const stations = catalog.getStationsForIls(props.ilsId)
  for (const station of stations) {
    L.marker([station.lat, station.lon], {
      icon: STATION_ICON[station.type] ?? fireIcon
    })
      .bindPopup(`<strong>${station.name}</strong><br/>${station.vehicles.map(v => v.type).join(', ')}`)
      .addTo(map)
  }
}

const rescueUnitIcon = L.divIcon({ className: '', html: '<div style="font-size:14px;line-height:1">🚑</div>', iconSize: [18, 18], iconAnchor: [9, 9] })
const fireUnitIcon = L.divIcon({ className: '', html: '<div style="font-size:14px;line-height:1">🚒</div>', iconSize: [18, 18], iconAnchor: [9, 9] })
const RETTUNGSDIENST_TYPES = new Set(['RTW', 'KTW', 'NEF', 'NKTW', 'KdoW-RD', 'ELW-RD', 'GW-SAN', 'GW-Betreuung', 'GW-Verpflegung'])

/** Fraction (0-1) of the current status phase elapsed, for interpolating a moving unit's position. */
function phaseFraction(unit: { statusChangedAt: number, statusEndsAt: number | null }): number {
  if (unit.statusEndsAt == null) return 0
  const total = unit.statusEndsAt - unit.statusChangedAt
  if (total <= 0) return 1
  return Math.min(1, Math.max(0, (Date.now() - unit.statusChangedAt) / total))
}

function pointAlong(geometry: [number, number][], t: number): [number, number] | null {
  if (geometry.length < 2) return null
  const line = turf.lineString(geometry)
  const totalKm = turf.length(line, { units: 'kilometers' })
  const pt = turf.along(line, totalKm * t, { units: 'kilometers' })
  const lon = pt.geometry.coordinates[0] ?? geometry[0]![0]
  const lat = pt.geometry.coordinates[1] ?? geometry[0]![1]
  return [lat, lon]
}

/** Live [lat, lon] of a unit for the map - at its station while alarmiert, interpolated
 * along its route while anfahrt/rueckfahrt, at the incident while vor_ort/abschluss. */
function unitPosition(unit: UnitState): [number, number] | null {
  const station = catalog.getStation(unit.stationId)
  const incident = unit.missionId ? game.incidents[unit.missionId] : null

  switch (unit.status) {
    case 'alarmiert':
      return station ? [station.lat, station.lon] : null
    case 'anfahrt':
      return (unit.routeGeometry && pointAlong(unit.routeGeometry, phaseFraction(unit)))
        ?? (station ? [station.lat, station.lon] : null)
    case 'vor_ort':
    case 'abschluss':
      return incident ? [incident.lat, incident.lon] : null
    case 'rueckfahrt':
      return (unit.routeGeometry && pointAlong(unit.routeGeometry, phaseFraction(unit)))
        ?? (incident ? [incident.lat, incident.lon] : null)
    default:
      return null
  }
}

function drawUnits() {
  if (!map || !unitLayer) return
  unitLayer.clearLayers()
  const units = game.unitList.filter(u => u.ilsId === props.ilsId && u.status !== 'frei')
  for (const unit of units) {
    const pos = unitPosition(unit)
    if (!pos) continue
    const icon = RETTUNGSDIENST_TYPES.has(unit.type) ? rescueUnitIcon : fireUnitIcon
    const statusInfo = BOS_STATUS[unit.status]
    L.marker(pos, { icon })
      .bindTooltip(`${unit.callSign} · <span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusInfo.className}">${statusInfo.code} ${statusInfo.label}</span>`)
      .addTo(unitLayer)
  }
}

function drawIncidents() {
  if (!map || !incidentLayer) return
  incidentLayer.clearLayers()
  const incidents = game.openIncidents.filter(i => i.ilsId === props.ilsId)
  for (const incident of incidents) {
    const marker = L.circleMarker([incident.lat, incident.lon], {
      radius: incident.id === props.selectedIncidentId ? 12 : 9,
      color: '#000',
      weight: incident.id === props.selectedIncidentId ? 2 : 1,
      fillColor: severityColor[incident.severity] ?? '#dc2626',
      fillOpacity: 0.85
    })
    marker.bindTooltip(incident.keyword)
    marker.on('click', () => emit('selectIncident', incident.id))
    marker.addTo(incidentLayer)
  }
}

const callIcon = L.divIcon({ className: '', html: '<div style="font-size:15px;line-height:1">📞</div>', iconSize: [18, 18], iconAnchor: [9, 9] })

// Calls always show their exact position - no confirmed/unconfirmed distinction (MVP: the
// caller's one statement is all the info there is, but the map itself always knows the truth).
function drawCalls() {
  if (!map || !callLayer) return
  callLayer.clearLayers()
  const calls = game.openCalls.filter(c => c.ilsId === props.ilsId)
  for (const call of calls) {
    L.marker([call.lat, call.lon], { icon: callIcon })
      .bindTooltip(call.address ?? 'Adresse unbekannt')
      .addTo(callLayer)
  }
}

function flyToPoint(point: FocusPoint | null | undefined) {
  if (!map || !point) return
  map.flyTo([point.lat, point.lon], Math.max(map.getZoom(), 15), { duration: 0.75 })
}

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  if (!mapEl.value) return
  const bbox = catalog.getPlayableBbox(props.ilsId)

  map = L.map(mapEl.value)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap Mitwirkende',
    maxZoom: 18
  }).addTo(map)

  function fitToIls() {
    if (!map) return
    if (bbox) {
      map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { padding: [16, 16] })
    } else {
      map.setView([49.0, 11.4], 8)
    }
  }

  // The map container has zero size at mount time inside the CSS grid layout
  // until the browser finishes laying out siblings - Leaflet needs an explicit
  // invalidateSize() once the real size is known, or it renders at the wrong zoom.
  await nextTick()
  map.invalidateSize()
  fitToIls()

  resizeObserver = new ResizeObserver(() => {
    map?.invalidateSize()
  })
  resizeObserver.observe(mapEl.value)

  incidentLayer = L.layerGroup().addTo(map)
  callLayer = L.layerGroup().addTo(map)
  unitLayer = L.layerGroup().addTo(map)
  drawStations()
  drawIncidents()
  drawCalls()
  drawUnits()

  // Units interpolate continuously along their route while driving, not just on status
  // change, so this needs its own animation tick rather than relying purely on watchers.
  unitAnimTimer = setInterval(drawUnits, 1500)
})

watch(() => game.incidentList.map(i => `${i.id}:${i.status}`).join(','), drawIncidents)
watch(() => props.selectedIncidentId, drawIncidents)
watch(() => game.openCalls.filter(c => c.ilsId === props.ilsId).map(c => `${c.id}:${c.address}`).join(','), drawCalls)
watch(() => game.unitList.filter(u => u.ilsId === props.ilsId).map(u => `${u.id}:${u.status}:${u.missionId}`).join(','), drawUnits)
watch(() => props.focusPoint, flyToPoint)

onUnmounted(() => {
  resizeObserver?.disconnect()
  if (unitAnimTimer) clearInterval(unitAnimTimer)
  map?.remove()
})
</script>

<template>
  <div
    ref="mapEl"
    class="h-full w-full"
  />
</template>
