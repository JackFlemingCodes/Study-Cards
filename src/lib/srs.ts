import type { CardProgress } from './types'

export type Rating = 0 | 1 | 2 | 3 // again, hard, good, easy

export const RATING_LABELS: Record<Rating, string> = {
  0: 'Again',
  1: 'Hard',
  2: 'Good',
  3: 'Easy',
}

const DAY = 24 * 60 * 60 * 1000
const MIN_EASE = 1.3

export function newProgress(): CardProgress {
  return {
    starred: false,
    mastery: 0,
    correct: 0,
    incorrect: 0,
    reps: 0,
    ease: 2.5,
    interval: 0,
    due: 0,
    lapses: 0,
    lastReviewed: 0,
  }
}

/** Interval in days the card would get for a given rating (pure; used for button previews). */
export function nextInterval(p: CardProgress, rating: Rating): number {
  if (rating === 0) return 10 / (24 * 60) // 10 minutes
  if (p.reps === 0) return rating === 1 ? 0.25 : rating === 2 ? 1 : 4
  if (p.reps === 1) return rating === 1 ? 1 : rating === 2 ? 3 : 6
  const ease = nextEase(p.ease, rating)
  const base = Math.max(1, p.interval)
  if (rating === 1) return Math.max(1, base * 1.2)
  if (rating === 2) return base * ease
  return base * ease * 1.3
}

function nextEase(ease: number, rating: Rating): number {
  // SM-2 style ease adjustment mapped onto 4 buttons
  const delta = rating === 0 ? -0.2 : rating === 1 ? -0.15 : rating === 2 ? 0 : 0.15
  return Math.max(MIN_EASE, ease + delta)
}

export function review(p: CardProgress, rating: Rating, now = Date.now()): CardProgress {
  const interval = nextInterval(p, rating)
  const lapsed = rating === 0 && p.reps > 0
  return {
    ...p,
    reps: rating === 0 ? 0 : p.reps + 1,
    ease: nextEase(p.ease, rating),
    interval,
    due: now + interval * DAY,
    lapses: p.lapses + (lapsed ? 1 : 0),
    lastReviewed: now,
    correct: p.correct + (rating > 0 ? 1 : 0),
    incorrect: p.incorrect + (rating === 0 ? 1 : 0),
  }
}

export function isNew(p: CardProgress | undefined): boolean {
  return !p || p.lastReviewed === 0
}

export function isDue(p: CardProgress | undefined, now = Date.now()): boolean {
  return !!p && p.lastReviewed > 0 && p.due <= now
}

/**
 * Memory strength 0–100 for display: how well-retained a card is right now,
 * based on time since last review relative to its interval.
 */
export function memoryStrength(p: CardProgress | undefined, now = Date.now()): number {
  if (!p || p.lastReviewed === 0) return 0
  const elapsedDays = (now - p.lastReviewed) / DAY
  const stability = Math.max(p.interval, 0.01)
  return Math.round(100 * Math.pow(0.9, elapsedDays / stability))
}
