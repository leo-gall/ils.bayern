// Small pool of common German first/last names, used to give the caller in a spawned
// Notruf a plausible identity for the fixed one-shot statement (see useDispatchEngine's
// spawnRandomCall) - not fetched/generated, just picked at random like the rest of the
// procedurally generated call data.

const FIRST_NAMES = [
  'Michael', 'Andreas', 'Stefan', 'Thomas', 'Markus', 'Peter', 'Josef', 'Florian', 'Georg', 'Anton',
  'Maria', 'Andrea', 'Sabine', 'Petra', 'Claudia', 'Monika', 'Christine', 'Barbara', 'Ursula', 'Brigitte'
]

const LAST_NAMES = [
  'Huber', 'Gruber', 'Bauer', 'Wagner', 'Fischer', 'Maier', 'Schmid', 'Wolf', 'Brandner', 'Reiter',
  'Hofer', 'Aigner', 'Berger', 'Winkler', 'Lechner', 'Wimmer', 'Pichler', 'Steiner', 'Moser', 'Egger'
]

export function randomCallerName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
  return `${first} ${last}`
}
