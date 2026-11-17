import type { Card, StudySet } from './types'
import { uid } from './util'

export type TermSep = 'tab' | 'comma' | 'dash' | string
export type CardSep = 'newline' | 'semicolon' | string

function resolveTermSep(sep: TermSep): string {
  if (sep === 'tab') return '\t'
  if (sep === 'comma') return ','
  if (sep === 'dash') return ' - '
  return sep
}

function resolveCardSep(sep: CardSep): string | RegExp {
  if (sep === 'newline') return /\r?\n/
  if (sep === 'semicolon') return ';'
  return sep
}

/** Parse pasted text (e.g. copied from Quizlet export, Excel, Google Docs) into cards. */
export function parseCards(text: string, termSep: TermSep = 'tab', cardSep: CardSep = 'newline'): Card[] {
  const ts = resolveTermSep(termSep)
  const cs = resolveCardSep(cardSep)
  if (!ts) return []
  return text
    .split(cs)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const i = row.indexOf(ts)
      const term = i === -1 ? row : row.slice(0, i)
      const definition = i === -1 ? '' : row.slice(i + ts.length)
      return { id: uid(), term: term.trim(), definition: definition.trim() }
    })
}

/** Guess the term separator from a pasted blob. */
export function detectTermSep(text: string): TermSep {
  const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 20)
  if (!lines.length) return 'tab'
  const frac = (needle: string) => lines.filter((l) => l.includes(needle)).length / lines.length
  if (frac('\t') >= 0.6) return 'tab'
  if (frac(' - ') >= 0.6) return 'dash'
  if (frac(',') >= 0.6) return 'comma'
  return 'tab'
}

export function cardsToText(cards: Card[]): string {
  return cards.map((c) => `${c.term}\t${c.definition}`).join('\n')
}

export interface ExportFile {
  app: 'study-cards'
  version: 1
  sets: StudySet[]
}

export function exportSets(sets: StudySet[]): string {
  const file: ExportFile = { app: 'study-cards', version: 1, sets }
  return JSON.stringify(file, null, 2)
}

/** Import sets from JSON; assigns fresh ids so imports never clobber existing sets. */
export function importSets(json: string): StudySet[] {
  const data = JSON.parse(json)
  const raw: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.sets) ? data.sets : [data]
  const now = Date.now()
  return raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object' && Array.isArray((s as { cards?: unknown }).cards))
    .map((s) => ({
      id: uid(),
      title: String(s.title ?? 'Imported set'),
      description: String(s.description ?? ''),
      createdAt: now,
      updatedAt: now,
      cards: (s.cards as Record<string, unknown>[])
        .filter((c) => c && (c.term || c.definition))
        .map((c) => ({
          id: uid(),
          term: String(c.term ?? ''),
          definition: String(c.definition ?? ''),
          ...(c.image ? { image: String(c.image) } : {}),
        })),
    }))
}

export function download(filename: string, contents: string, type = 'application/json') {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
