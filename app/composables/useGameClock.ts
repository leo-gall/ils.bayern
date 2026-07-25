const TICK_MS = 2_000

/**
 * Drives unit FSM transitions that are due. Runs in real wall-clock time (no time
 * acceleration), so ETAs stored as absolute timestamps in the store keep working even
 * if the tab was inactive/reloaded. Incident/call creation is dispatcher-triggered, not
 * driven by this clock.
 */
export function useGameClock(ilsId: Ref<string | null>) {
  const game = useGameStore()
  const engine = useDispatchEngine()
  const tick = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null

  function step() {
    tick.value = Date.now()
    if (!ilsId.value) return

    for (const unit of game.unitList) {
      if (unit.ilsId !== ilsId.value) continue
      if (unit.statusEndsAt != null && tick.value >= unit.statusEndsAt) {
        void engine.advanceUnitIfDue(unit.id)
      } else {
        engine.checkMidMissionReport(unit.id)
        engine.checkLateMissionReport(unit.id)
      }
    }
  }

  onMounted(() => {
    timer = setInterval(step, TICK_MS)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  return { tick }
}
