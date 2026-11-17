import { useSyncExternalStore } from 'react'
import type { AppState, Card, CardProgress, Mastery, SetMeta, Settings, StudySet, TestResult } from './types'
import { newProgress, review, type Rating } from './srs'
import { uid } from './util'
import { sampleSets } from './seed'

const KEY = 'study-cards:v1'

function defaultState(): AppState {
  const sets: Record<string, StudySet> = {}
  for (const s of sampleSets()) sets[s.id] = s
  const prefersDark =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return {
    version: 1,
    sets,
    progress: {},
    meta: {},
    settings: { theme: prefersDark ? 'dark' : 'light', promptWith: 'term', newCardsPerDay: 20 },
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      const d = defaultState()
      return { ...d, ...parsed, settings: { ...d.settings, ...parsed.settings } }
    }
  } catch {
    /* corrupt or unavailable storage: fall through to defaults */
  }
  return defaultState()
}

let state: AppState = load()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage full or unavailable */
  }
}

function setState(updater: (s: AppState) => AppState) {
  state = updater(state)
  persist()
  listeners.forEach((l) => l())
}

// Keep tabs in sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load()
      listeners.forEach((l) => l())
    }
  })
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

export function getState() {
  return state
}

// ---------- Selectors ----------

export function getProgress(s: AppState, cardId: string): CardProgress {
  return s.progress[cardId] ?? newProgress()
}

export function getMeta(s: AppState, setId: string): SetMeta {
  return s.meta[setId] ?? { tests: [] }
}

// ---------- Actions ----------

export const actions = {
  createSet(data: Pick<StudySet, 'title' | 'description' | 'cards'>): string {
    const id = uid()
    const now = Date.now()
    setState((s) => ({ ...s, sets: { ...s.sets, [id]: { id, ...data, createdAt: now, updatedAt: now } } }))
    return id
  },

  addSets(sets: StudySet[]) {
    setState((s) => {
      const next = { ...s.sets }
      for (const set of sets) next[set.id] = set
      return { ...s, sets: next }
    })
  },

  updateSet(id: string, data: Pick<StudySet, 'title' | 'description' | 'cards'>) {
    setState((s) => {
      const prev = s.sets[id]
      if (!prev) return s
      // Reset learn mastery for cards whose content changed
      const prevById = new Map(prev.cards.map((c) => [c.id, c]))
      const progress = { ...s.progress }
      for (const c of data.cards) {
        const old = prevById.get(c.id)
        if (old && (old.term !== c.term || old.definition !== c.definition) && progress[c.id]) {
          progress[c.id] = { ...progress[c.id], mastery: 0 }
        }
      }
      const keep = new Set(data.cards.map((c) => c.id))
      for (const c of prev.cards) if (!keep.has(c.id)) delete progress[c.id]
      return { ...s, progress, sets: { ...s.sets, [id]: { ...prev, ...data, updatedAt: Date.now() } } }
    })
  },

  duplicateSet(id: string): string | undefined {
    const src = state.sets[id]
    if (!src) return
    return actions.createSet({
      title: `${src.title} (copy)`,
      description: src.description,
      cards: src.cards.map((c) => ({ ...c, id: uid() })),
    })
  },

  deleteSet(id: string) {
    setState((s) => {
      const set = s.sets[id]
      if (!set) return s
      const sets = { ...s.sets }
      delete sets[id]
      const progress = { ...s.progress }
      for (const c of set.cards) delete progress[c.id]
      const meta = { ...s.meta }
      delete meta[id]
      return { ...s, sets, progress, meta }
    })
  },

  toggleStar(cardId: string) {
    setState((s) => {
      const p = getProgress(s, cardId)
      return { ...s, progress: { ...s.progress, [cardId]: { ...p, starred: !p.starred } } }
    })
  },

  setMastery(cardId: string, mastery: Mastery, wasCorrect: boolean) {
    setState((s) => {
      const p = getProgress(s, cardId)
      return {
        ...s,
        progress: {
          ...s.progress,
          [cardId]: {
            ...p,
            mastery,
            correct: p.correct + (wasCorrect ? 1 : 0),
            incorrect: p.incorrect + (wasCorrect ? 0 : 1),
          },
        },
      }
    })
  },

  resetLearn(setId: string) {
    setState((s) => {
      const set = s.sets[setId]
      if (!set) return s
      const progress = { ...s.progress }
      for (const c of set.cards) if (progress[c.id]) progress[c.id] = { ...progress[c.id], mastery: 0 }
      return { ...s, progress }
    })
  },

  resetSrs(setId: string) {
    setState((s) => {
      const set = s.sets[setId]
      if (!set) return s
      const progress = { ...s.progress }
      for (const c of set.cards) {
        const p = progress[c.id]
        if (p) progress[c.id] = { ...newProgress(), starred: p.starred, mastery: p.mastery }
      }
      return { ...s, progress }
    })
  },

  reviewCard(cardId: string, rating: Rating) {
    setState((s) => ({
      ...s,
      progress: { ...s.progress, [cardId]: review(getProgress(s, cardId), rating) },
    }))
  },

  touchSet(setId: string) {
    setState((s) => ({ ...s, meta: { ...s.meta, [setId]: { ...getMeta(s, setId), lastStudied: Date.now() } } }))
  },

  recordMatch(setId: string, ms: number): boolean {
    const best = getMeta(state, setId).bestMatchMs
    const isBest = best === undefined || ms < best
    setState((s) => {
      const m = getMeta(s, setId)
      return {
        ...s,
        meta: { ...s.meta, [setId]: { ...m, lastStudied: Date.now(), bestMatchMs: isBest ? ms : m.bestMatchMs } },
      }
    })
    return isBest
  },

  recordTest(setId: string, result: TestResult) {
    setState((s) => {
      const m = getMeta(s, setId)
      return {
        ...s,
        meta: { ...s.meta, [setId]: { ...m, lastStudied: Date.now(), tests: [result, ...m.tests].slice(0, 20) } },
      }
    })
  },

  updateSettings(patch: Partial<Settings>) {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  },

  resetAll() {
    setState(() => defaultState())
  },
}

export function cardPrompt(card: Card, promptWith: Settings['promptWith']) {
  return promptWith === 'term'
    ? { prompt: card.term, answer: card.definition }
    : { prompt: card.definition, answer: card.term }
}
