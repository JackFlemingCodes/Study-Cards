import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { actions, useAppState } from '../lib/store'
import { cardsToText, download, exportSets } from '../lib/importExport'
import { isDue, isNew, memoryStrength } from '../lib/srs'
import { formatMs, pluralize, timeAgo } from '../lib/util'
import { Icon, type IconName } from '../components/Icon'
import { CardImage, ProgressBar, SetNotFound, SpeakButton, StarButton, useCurrentSet } from '../components/common'

const MODES: { to: string; icon: IconName; label: string; blurb: string }[] = [
  { to: 'flashcards', icon: 'cards', label: 'Flashcards', blurb: 'Flip through and sort what you know' },
  { to: 'learn', icon: 'learn', label: 'Learn', blurb: 'Adaptive questions until you master it' },
  { to: 'test', icon: 'test', label: 'Test', blurb: 'Practice exam with mixed question types' },
  { to: 'match', icon: 'match', label: 'Match', blurb: 'Race the clock pairing terms' },
  { to: 'review', icon: 'brain', label: 'Spaced review', blurb: 'Reviews timed to beat forgetting' },
]

export function SetPage() {
  const set = useCurrentSet()
  const progress = useAppState((s) => s.progress)
  const metaMap = useAppState((s) => s.meta)
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'all' | 'starred'>('all')
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const stats = useMemo(() => {
    if (!set) return null
    const now = Date.now()
    let notStudied = 0,
      learning = 0,
      mastered = 0,
      due = 0,
      fresh = 0,
      starred = 0,
      strength = 0,
      reviewed = 0
    for (const c of set.cards) {
      const p = progress[c.id]
      const m = p?.mastery ?? 0
      if (m === 0) notStudied++
      else if (m === 1) learning++
      else mastered++
      if (isDue(p, now)) due++
      if (isNew(p)) fresh++
      else {
        reviewed++
        strength += memoryStrength(p, now)
      }
      if (p?.starred) starred++
    }
    return { notStudied, learning, mastered, due, fresh, starred, memory: reviewed ? Math.round(strength / reviewed) : null }
  }, [set, progress])

  if (!set || !stats) return <SetNotFound />
  const meta = metaMap[set.id] ?? { tests: [] }
  const cards = filter === 'starred' ? set.cards.filter((c) => progress[c.id]?.starred) : set.cards

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{set.title || 'Untitled set'}</h1>
          {set.description && <p className="muted">{set.description}</p>}
          <p className="muted small">
            {pluralize(set.cards.length, 'term')} · updated {timeAgo(set.updatedAt)}
          </p>
        </div>
        <div className="row gap">
          <Link to={`/set/${set.id}/edit`} className="btn">
            <Icon name="edit" /> Edit
          </Link>
          <div className="menu-wrap">
            <button className="btn" onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen}>
              More
            </button>
            {menuOpen && (
              <div className="menu" role="menu" onMouseLeave={() => setMenuOpen(false)}>
                <button
                  role="menuitem"
                  onClick={() => {
                    const id = actions.duplicateSet(set.id)
                    if (id) navigate(`/set/${id}`)
                  }}
                >
                  <Icon name="copy" /> Duplicate
                </button>
                <button
                  role="menuitem"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(cardsToText(set.cards))
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }}
                >
                  <Icon name="copy" /> {copied ? 'Copied!' : 'Copy as text'}
                </button>
                <button
                  role="menuitem"
                  onClick={() => download(`${set.title || 'set'}.json`.replace(/[^\w.-]+/g, '_'), exportSets([set]))}
                >
                  <Icon name="download" /> Export JSON
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    if (confirm('Reset Learn progress and spaced-review history for this set?')) {
                      actions.resetLearn(set.id)
                      actions.resetSrs(set.id)
                    }
                    setMenuOpen(false)
                  }}
                >
                  <Icon name="flip" /> Reset progress
                </button>
                <button
                  role="menuitem"
                  className="danger"
                  onClick={() => {
                    if (confirm(`Delete “${set.title}”? This can’t be undone.`)) {
                      actions.deleteSet(set.id)
                      navigate('/')
                    }
                  }}
                >
                  <Icon name="trash" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mode-grid">
        {MODES.map((m) => (
          <Link key={m.to} to={`/set/${set.id}/${m.to}`} className="mode-tile">
            <span className="mode-icon">
              <Icon name={m.icon} size={22} />
            </span>
            <span className="mode-label">
              {m.label}
              {m.to === 'review' && stats.due > 0 && <span className="badge">{stats.due}</span>}
            </span>
            <span className="muted small">{m.blurb}</span>
          </Link>
        ))}
      </div>

      <div className="stats-grid">
        <div className="panel">
          <h3>Learn progress</h3>
          <div className="stack-bar">
            <span className="seg seg-new" style={{ flex: stats.notStudied }} />
            <span className="seg seg-learning" style={{ flex: stats.learning }} />
            <span className="seg seg-mastered" style={{ flex: stats.mastered }} />
          </div>
          <div className="legend">
            <span><i className="dot seg-new" /> Not studied {stats.notStudied}</span>
            <span><i className="dot seg-learning" /> Learning {stats.learning}</span>
            <span><i className="dot seg-mastered" /> Mastered {stats.mastered}</span>
          </div>
        </div>
        <div className="panel">
          <h3>Memory</h3>
          {stats.memory === null ? (
            <p className="muted small">Start a spaced review to track how well you remember these cards over time.</p>
          ) : (
            <>
              <div className="big-number">{stats.memory}%</div>
              <ProgressBar value={stats.memory} max={100} tone={stats.memory > 80 ? 'success' : 'warn'} />
              <p className="muted small">
                {stats.due} due now · {stats.fresh} new
              </p>
            </>
          )}
        </div>
        <div className="panel">
          <h3>Records</h3>
          <div className="small">
            <div className="row between">
              <span className="muted">Best match time</span>
              <strong>{meta.bestMatchMs ? formatMs(meta.bestMatchMs) : '—'}</strong>
            </div>
            <div className="row between">
              <span className="muted">Last test</span>
              <strong>
                {meta.tests[0] ? `${Math.round((meta.tests[0].score / meta.tests[0].total) * 100)}%` : '—'}
              </strong>
            </div>
            <div className="row between">
              <span className="muted">Best test</span>
              <strong>
                {meta.tests.length
                  ? `${Math.max(...meta.tests.map((t) => Math.round((t.score / t.total) * 100)))}%`
                  : '—'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className="section-head">
        <h2>Terms in this set ({set.cards.length})</h2>
        <div className="segmented">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            All
          </button>
          <button className={filter === 'starred' ? 'active' : ''} onClick={() => setFilter('starred')}>
            Starred ({stats.starred})
          </button>
        </div>
      </div>

      <div className="term-list">
        {cards.length === 0 && <p className="muted">No starred terms yet. Tap the star on any card to add it.</p>}
        {cards.map((c) => {
          const m = progress[c.id]?.mastery ?? 0
          return (
            <div key={c.id} className="term-row">
              <div className="term-term">{c.term}</div>
              <div className="term-def">
                {c.definition}
                <CardImage src={c.image} />
              </div>
              <div className="term-actions">
                <span className={`mastery-dot m${m}`} title={['Not studied', 'Learning', 'Mastered'][m]} />
                <SpeakButton text={c.term} />
                <StarButton cardId={c.id} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
