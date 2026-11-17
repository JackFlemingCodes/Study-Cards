export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function shuffle<T>(arr: readonly T[], rand: () => number = Math.random): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Pick n random items from arr excluding any matching `exclude`. */
export function sample<T>(arr: readonly T[], n: number, exclude?: (x: T) => boolean): T[] {
  return shuffle(exclude ? arr.filter((x) => !exclude(x)) : arr).slice(0, n)
}

export function formatMs(ms: number): string {
  const s = ms / 1000
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
}

export function formatInterval(days: number): string {
  if (days < 1) {
    const mins = Math.max(1, Math.round(days * 24 * 60))
    return mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`
  }
  if (days < 30) return `${Math.round(days)}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${(days / 365).toFixed(1)}y`
}

export function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function timeAgo(ts: number, now = Date.now()): string {
  const d = Math.floor((now - ts) / 1000)
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  if (d < 86400 * 30) return `${Math.floor(d / 86400)}d ago`
  return new Date(ts).toLocaleDateString()
}
