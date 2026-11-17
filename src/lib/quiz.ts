import type { Card, Mastery, Side } from './types'
import { sample, shuffle } from './util'

export interface QA {
  card: Card
  prompt: string
  answer: string
}

export function toQA(card: Card, promptWith: Side): QA {
  return promptWith === 'term'
    ? { card, prompt: card.term, answer: card.definition }
    : { card, prompt: card.definition, answer: card.term }
}

/** Build up to `n` multiple-choice options (including the correct answer), shuffled. */
export function mcOptions(qa: QA, all: QA[], n = 4): string[] {
  const seen = new Set([qa.answer.trim().toLowerCase()])
  const distractors: string[] = []
  for (const other of shuffle(all)) {
    const key = other.answer.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    distractors.push(other.answer)
    if (distractors.length >= n - 1) break
  }
  return shuffle([qa.answer, ...distractors])
}

// ---------------- Learn mode ----------------

export type LearnQuestionType = 'mc' | 'written'

export interface LearnOptions {
  mc: boolean
  written: boolean
  roundSize: number
}

export function learnQuestionType(mastery: Mastery, opts: LearnOptions): LearnQuestionType {
  if (mastery === 0 && opts.mc) return 'mc'
  if (opts.written) return 'written'
  return 'mc'
}

export function nextMastery(current: Mastery, correct: boolean): Mastery {
  if (!correct) return 0
  return Math.min(2, current + 1) as Mastery
}

/** Pick the next round: cards still learning first (closest to mastery), then unseen. */
export function pickRound<T extends { card: Card }>(items: T[], mastery: (cardId: string) => Mastery, size: number): T[] {
  const learning = shuffle(items.filter((i) => mastery(i.card.id) === 1))
  const fresh = items.filter((i) => mastery(i.card.id) === 0)
  return [...learning, ...fresh].slice(0, size)
}

// ---------------- Test mode ----------------

export type TestQuestionType = 'written' | 'mc' | 'tf' | 'match'

export type TestQuestion =
  | { kind: 'written'; qa: QA }
  | { kind: 'mc'; qa: QA; options: string[] }
  | { kind: 'tf'; qa: QA; shown: string; isTrue: boolean }
  | { kind: 'match'; items: QA[]; choices: string[] }

export function questionWeight(q: TestQuestion): number {
  return q.kind === 'match' ? q.items.length : 1
}

export function buildTest(all: QA[], count: number, types: TestQuestionType[]): TestQuestion[] {
  if (!types.length || !all.length) return []
  const picked = shuffle(all).slice(0, Math.min(count, all.length))
  // Split cards across the chosen types as evenly as possible.
  const buckets: Record<TestQuestionType, QA[]> = { written: [], mc: [], tf: [], match: [] }
  picked.forEach((qa, i) => buckets[types[i % types.length]].push(qa))

  // Matching needs at least 2 items; if it got fewer, give them to another type.
  if (buckets.match.length === 1) {
    const fallback = types.find((t) => t !== 'match') ?? 'mc'
    buckets[fallback].push(...buckets.match)
    buckets.match = []
  }

  const questions: TestQuestion[] = []
  for (const qa of buckets.written) questions.push({ kind: 'written', qa })
  for (const qa of buckets.mc) questions.push({ kind: 'mc', qa, options: mcOptions(qa, all) })
  for (const qa of buckets.tf) {
    const others = all.filter((o) => o.answer.trim().toLowerCase() !== qa.answer.trim().toLowerCase())
    const isTrue = others.length === 0 || Math.random() < 0.5
    const shown = isTrue ? qa.answer : sample(others, 1)[0].answer
    questions.push({ kind: 'tf', qa, shown, isTrue })
  }
  for (let i = 0; i < buckets.match.length; i += 5) {
    let items = buckets.match.slice(i, i + 5)
    if (items.length === 1 && questions.length) {
      // Lonely leftover: turn it into multiple choice instead.
      questions.push({ kind: 'mc', qa: items[0], options: mcOptions(items[0], all) })
      continue
    }
    items = items.slice()
    questions.push({ kind: 'match', items, choices: shuffle(items.map((x) => x.answer)) })
  }
  // Group by type (like Quizlet), in a stable order.
  const order: TestQuestionType[] = ['tf', 'mc', 'match', 'written']
  return order.flatMap((k) => questions.filter((q) => q.kind === k))
}
