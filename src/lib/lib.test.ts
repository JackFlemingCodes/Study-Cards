import { describe, expect, it } from 'vitest'
import { acceptableAnswers, gradeAnswer, levenshtein, normalize } from './grading'
import { isDue, newProgress, nextInterval, review } from './srs'
import { detectTermSep, importSets, exportSets, parseCards } from './importExport'
import { buildTest, mcOptions, nextMastery, pickRound, questionWeight, toQA } from './quiz'
import type { Card, Mastery } from './types'

const cards: Card[] = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, term: `term ${i}`, definition: `def ${i}` }))
const qas = cards.map((c) => toQA(c, 'term'))

describe('grading', () => {
  it('normalizes case, accents, punctuation', () => {
    expect(normalize('  Café, Olé!  ')).toBe('cafe ole')
  })
  it('computes edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('', 'abc')).toBe(3)
  })
  it('accepts exact and normalized answers', () => {
    expect(gradeAnswer('To Speak', 'to speak')).toBe('correct')
    expect(gradeAnswer('mitochondria.', 'Mitochondria')).toBe('correct')
  })
  it('flags small typos as close', () => {
    expect(gradeAnswer('mitocondria', 'Mitochondria')).toBe('close')
  })
  it('rejects wrong and empty answers', () => {
    expect(gradeAnswer('ribosome', 'Mitochondria')).toBe('wrong')
    expect(gradeAnswer('   ', 'x')).toBe('wrong')
    expect(gradeAnswer('ab', 'ac')).toBe('wrong') // too short for typo tolerance
  })
  it('accepts any slash/semicolon alternative', () => {
    expect(acceptableAnswers('to do / to make')).toEqual(['to do to make', 'to do', 'to make'])
    expect(gradeAnswer('to make', 'to do / to make')).toBe('correct')
  })
})

describe('spaced repetition', () => {
  it('schedules new cards by rating', () => {
    const p = newProgress()
    expect(nextInterval(p, 2)).toBe(1)
    expect(nextInterval(p, 3)).toBe(4)
    expect(nextInterval(p, 0)).toBeLessThan(0.01)
  })
  it('grows intervals with successful reviews and resets on lapse', () => {
    const t = 1_000_000
    let p = review(newProgress(), 2, t)
    expect(p.reps).toBe(1)
    p = review(p, 2, t)
    expect(p.interval).toBe(3)
    p = review(p, 2, t)
    expect(p.interval).toBeCloseTo(7.5)
    const lapsed = review(p, 0, t)
    expect(lapsed.reps).toBe(0)
    expect(lapsed.lapses).toBe(1)
    expect(lapsed.ease).toBeLessThan(p.ease)
  })
  it('never drops ease below 1.3', () => {
    let p = newProgress()
    for (let i = 0; i < 20; i++) p = review(p, 0)
    expect(p.ease).toBeGreaterThanOrEqual(1.3)
  })
  it('detects due cards', () => {
    const p = review(newProgress(), 2, 1000)
    expect(isDue(p, 1000)).toBe(false)
    expect(isDue(p, 1000 + 2 * 86_400_000)).toBe(true)
    expect(isDue(newProgress())).toBe(false)
  })
})

describe('import/export', () => {
  it('parses tab-separated lines', () => {
    const out = parseCards('a\tb\nc\td\n\n')
    expect(out.map((c) => [c.term, c.definition])).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })
  it('parses custom separators and keeps extra separators in the definition', () => {
    const out = parseCards('a - b - c; d - e', 'dash', 'semicolon')
    expect(out.map((c) => [c.term, c.definition])).toEqual([
      ['a', 'b - c'],
      ['d', 'e'],
    ])
  })
  it('detects separators', () => {
    expect(detectTermSep('a\tb\nc\td')).toBe('tab')
    expect(detectTermSep('a - b\nc - d')).toBe('dash')
    expect(detectTermSep('a,b\nc,d')).toBe('comma')
  })
  it('round-trips sets with fresh ids', () => {
    const set = { id: 's1', title: 'T', description: '', cards, createdAt: 0, updatedAt: 0 }
    const [back] = importSets(exportSets([set]))
    expect(back.id).not.toBe('s1')
    expect(back.cards).toHaveLength(10)
    expect(back.cards[0].term).toBe('term 0')
  })
  it('rejects junk gracefully', () => {
    expect(importSets('{"foo":1}')).toEqual([])
    expect(() => importSets('not json')).toThrow()
  })
})

describe('quiz building', () => {
  it('builds unique multiple-choice options including the answer', () => {
    const opts = mcOptions(qas[0], qas)
    expect(opts).toHaveLength(4)
    expect(opts).toContain('def 0')
    expect(new Set(opts).size).toBe(4)
  })
  it('mastery climbs on correct and resets on miss', () => {
    expect(nextMastery(0, true)).toBe(1)
    expect(nextMastery(1, true)).toBe(2)
    expect(nextMastery(2, true)).toBe(2)
    expect(nextMastery(2, false)).toBe(0)
  })
  it('picks learning cards before new ones and skips mastered', () => {
    const m: Record<string, Mastery> = { c0: 2, c1: 1, c2: 0 }
    const round = pickRound(qas.slice(0, 3), (id) => m[id], 5)
    expect(round.map((r) => r.card.id)).toEqual(['c1', 'c2'])
  })
  it('builds a test with the requested size across types', () => {
    const qs = buildTest(qas, 10, ['tf', 'mc', 'match', 'written'])
    expect(qs.reduce((n, q) => n + questionWeight(q), 0)).toBe(10)
    expect(new Set(qs.map((q) => q.kind)).size).toBe(4)
    for (const q of qs) {
      if (q.kind === 'tf') expect(q.isTrue ? q.shown === q.qa.answer : q.shown !== q.qa.answer).toBe(true)
      if (q.kind === 'match') expect(q.items.length).toBeGreaterThanOrEqual(2)
    }
  })
  it('never makes a one-item matching question', () => {
    for (let i = 0; i < 20; i++) {
      const qs = buildTest(qas, 5, ['match', 'mc', 'tf', 'written'])
      for (const q of qs) if (q.kind === 'match') expect(q.items.length).toBeGreaterThan(1)
      expect(qs.reduce((n, q) => n + questionWeight(q), 0)).toBe(5)
    }
  })
})
