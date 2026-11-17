import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { actions, useAppState } from '../lib/store'
import { importSets } from '../lib/importExport'
import { isDue } from '../lib/srs'
import { pluralize, timeAgo } from '../lib/util'
import { Icon } from '../components/Icon'
import { ProgressBar } from '../components/common'

type Sort = 'recent' | 'title' | 'created'

export function Library() {
  const sets = useAppState((s) => s.sets)
  const progress = useAppState((s) => s.progress)
  const meta = useAppState((s) => s.meta)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = Object.values(sets).filter(
      (s) =>
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.cards.some((c) => c.term.toLowerCase().includes(q) || c.definition.toLowerCase().includes(q)),
    )
    const recency = (id: string, fallback: number) => meta[id]?.lastStudied ?? fallback
    return all.sort((a, b) =>
      sort === 'title'
        ? a.title.localeCompare(b.title)
        : sort === 'created'
          ? b.createdAt - a.createdAt
          : recency(b.id, b.updatedAt) - recency(a.id, a.updatedAt),
    )
  }, [sets, meta, query, sort])

  const totalDue = useMemo(() => {
    const now = Date.now()
    return Object.values(sets).reduce((n, s) => n + s.cards.filter((c) => isDue(progress[c.id], now)).length, 0)
  }, [sets, progress])

  async function onImportFile(file: File) {
    setError('')
    try {
      const imported = importSets(await file.text())
      if (!imported.length) throw new Error('No sets found in that file.')
      actions.addSets(imported)
      if (imported.length === 1) navigate(`/set/${imported[0].id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Your library</h1>
          <p className="muted">{pluralize(Object.keys(sets).length, 'study set')}</p>
        </div>
        <div className="row gap">
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" /> Import file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImportFile(f)
              e.target.value = ''
            }}
          />
          <Link to="/new" className="btn btn-primary">
            <Icon name="plus" /> New set
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {totalDue > 0 && (
        <Link to="/review" className="due-banner">
          <Icon name="brain" size={22} />
          <div>
            <strong>{pluralize(totalDue, 'card')} due for review</strong>
            <div className="muted small">Spaced repetition keeps them fresh. Takes a few minutes.</div>
          </div>
          <span className="btn btn-primary btn-sm">Review now</span>
        </Link>
      )}

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input
            placeholder="Search sets, terms, definitions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
          />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="recent">Recently studied</option>
          <option value="created">Newest</option>
          <option value="title">Alphabetical</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <h2>{query ? 'No matches' : 'No sets yet'}</h2>
          <p className="muted">{query ? 'Try a different search.' : 'Create your first study set to get started.'}</p>
          {!query && (
            <Link to="/new" className="btn btn-primary">
              Create a set
            </Link>
          )}
        </div>
      ) : (
        <div className="set-grid">
          {list.map((s) => {
            const mastered = s.cards.filter((c) => progress[c.id]?.mastery === 2).length
            const due = s.cards.filter((c) => isDue(progress[c.id])).length
            const last = meta[s.id]?.lastStudied
            return (
              <Link key={s.id} to={`/set/${s.id}`} className="set-card">
                <div className="set-card-title">{s.title || 'Untitled set'}</div>
                <div className="muted small">
                  {pluralize(s.cards.length, 'term')}
                  {last ? ` · studied ${timeAgo(last)}` : ''}
                </div>
                {s.description && <p className="set-card-desc">{s.description}</p>}
                <div className="set-card-foot">
                  <ProgressBar value={mastered} max={s.cards.length} tone="success" />
                  <div className="row between small muted">
                    <span>
                      {mastered}/{s.cards.length} mastered
                    </span>
                    {due > 0 && <span className="pill pill-warn">{due} due</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
