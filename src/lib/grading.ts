export type Grade = 'correct' | 'close' | 'wrong'

export function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = cur
  }
  return prev[b.length]
}

/** All acceptable forms of an answer: the whole thing plus parts split on "/" or ";". */
export function acceptableAnswers(answer: string): string[] {
  const whole = normalize(answer)
  const parts = answer
    .split(/[/;]/)
    .map(normalize)
    .filter(Boolean)
  return Array.from(new Set([whole, ...(parts.length > 1 ? parts : [])])).filter(Boolean)
}

/**
 * Grade a typed response.
 * - correct: matches after normalization (case, accents, punctuation, whitespace ignored)
 * - close: small typo (edit distance ≤ ~20% of answer length, min 1 for answers ≥ 4 chars)
 * - wrong: anything else
 */
export function gradeAnswer(response: string, answer: string): Grade {
  const r = normalize(response)
  if (!r) return 'wrong'
  const options = acceptableAnswers(answer)
  if (options.includes(r)) return 'correct'
  for (const opt of options) {
    if (opt.length < 4) continue
    const allowed = Math.max(1, Math.floor(opt.length * 0.2))
    if (levenshtein(r, opt) <= allowed) return 'close'
  }
  return 'wrong'
}
