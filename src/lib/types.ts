export interface Card {
  id: string
  term: string
  definition: string
  /** Optional image URL shown on the definition side */
  image?: string
}

export interface StudySet {
  id: string
  title: string
  description: string
  cards: Card[]
  createdAt: number
  updatedAt: number
}

/** Learn-mode mastery: 0 = not studied, 1 = learning (got MC right), 2 = mastered (got written right) */
export type Mastery = 0 | 1 | 2

export interface CardProgress {
  starred: boolean
  mastery: Mastery
  correct: number
  incorrect: number
  // Spaced repetition (SM-2)
  reps: number
  ease: number
  /** days */
  interval: number
  /** epoch ms; 0 = never reviewed (new) */
  due: number
  lapses: number
  lastReviewed: number
}

export interface TestResult {
  date: number
  score: number
  total: number
}

export interface SetMeta {
  lastStudied?: number
  bestMatchMs?: number
  tests: TestResult[]
}

export type Side = 'term' | 'definition'

export interface Settings {
  theme: 'light' | 'dark'
  /** Which side is shown as the prompt in study modes */
  promptWith: Side
  newCardsPerDay: number
}

export interface AppState {
  version: 1
  sets: Record<string, StudySet>
  progress: Record<string, CardProgress>
  meta: Record<string, SetMeta>
  settings: Settings
}
