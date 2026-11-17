import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { actions, getProgress, getState, useAppState } from '../lib/store'
import { isDue, isNew, nextInterval, RATING_LABELS, type Rating } from '../lib/srs'
import type { Card, StudySet } from '../lib/types'
import { formatInterval, pluralize, shuffle, timeAgo } from '../lib/util'
import { CardImage, ProgressBar, SetNotFound, SpeakButton, StarButton, StudyHeader } from '../components/common'

interface Item {
  card: Card
  set: StudySet
}

function buildQueue(sets: StudySet[], newLimit: number, ahead: boolean): Item[] {
  const s = getState()
  const now = Date.now()
  const all: Item[] = sets.flatMap((set) =>
    set.cards.filter((c) => c.term.trim() && c.definition.trim()).map((card) => ({ card, set })),
  )
  const due = all
    .filter((i) => isDue(s.progress[i.card.id], now))
    .sort((a, b) => getProgress(s, a.card.id).due - getProgress(s, b.card.id).due)
  const fresh = all.filter((i) => isNew(s.progress[i.card.id])).slice(0, newLimit)
  if (ahead && !due.length && !fresh.length) {
    // Study ahead: the cards coming due soonest.
    return all
      .filter((i) => !isNew(s.progress[i.card.id]))
      .sort((a, b) => getProgress(s, a.card.id).due - getProgress(s, b.card.id).due)
      .slice(0, 20)
  }
  return [...due, ...shuffle(fresh)]
}

export function Review() {
  const { id } = useParams()
  const allSets = useAppState((s) => s.sets)
  const progress = useAppState((s) => s.progress)
  const promptWith = useAppState((s) => s.settings.promptWith)
  const newLimit = useAppState((s) => s.settings.newCardsPerDay)
  const set = id ? allSets[id] : undefined
  const scope = useMemo(() => (id ? (set ? [set] : []) : Object.values(allSets)), [id, set, allSets])

  const [queue, setQueue] = useState<Item[] | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(0)
  const [again, setAgain] = useState(0)
  const [sessionSize, setSessionSize] = useState(0)

  const startSession = useCallback(
    (ahead = false) => {
      const q = buildQueue(scope, newLimit, ahead)
      setQueue(q)
      setSessionSize(q.length)
      setDone(0)
      setAgain(0)
      setRevealed(false)
    },
    [scope, newLimit],
  )

  // Build once on mount / when scope changes identity (e.g., navigating between sets).
  useEffect(() => {
    startSession()
    if (id) actions.touchSet(id)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = queue?.[0]

  const rate = useCallback(
    (r: Rating) => {
      if (!current || !revealed) return
      actions.reviewCard(current.card.id, r)
      setRevealed(false)
      setQueue((q) => {
        if (!q) return q
        const rest = q.slice(1)
        // "Again" re-shows the card later in this session.
        if (r === 0) rest.splice(Math.min(rest.length, 3), 0, q[0])
        return rest
      })
      if (r === 0) setAgain((n) => n + 1)
      else setDone((n) => n + 1)
    },
    [current, revealed],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setRevealed(true)
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        rate((Number(e.key) - 1) as Rating)
      } else if (revealed && e.key === ' ') {
        e.preventDefault()
        rate(2)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, revealed, rate])

  const nextDue = useMemo(() => {
    let min = Infinity
    for (const s of scope) for (const c of s.cards) {
      const p = progress[c.id]
      if (p && p.lastReviewed && p.due > Date.now()) min = Math.min(min, p.due)
    }
    return min === Infinity ? null : min
  }, [scope, progress])

  if (id && !set) return <SetNotFound />

  const p = current ? getProgress(getState(), current.card.id) : null
  const prompt = current ? (promptWith === 'term' ? current.card.term : current.card.definition) : ''
  const answer = current ? (promptWith === 'term' ? current.card.definition : current.card.term) : ''

  const header = set ? (
    <StudyHeader set={set} mode="Spaced review" />
  ) : (
    <div className="page-head">
      <div>
        <h1>Spaced review</h1>
        <p className="muted">Cards from every set, scheduled right before you’d forget them.</p>
      </div>
    </div>
  )

  if (!queue) return <div className="page study">{header}</div>

  if (!current) {
    const finished = sessionSize > 0
    return (
      <div className="page study">
        {header}
        <div className="panel center result-panel">
          <div className="celebrate">{finished ? '✅' : '😌'}</div>
          <h2>{finished ? 'Session complete!' : 'You’re all caught up'}</h2>
          {finished && (
            <p className="muted">
              Reviewed {pluralize(done, 'card')}
              {again > 0 && ` · ${again} relearned`}
            </p>
          )}
          {nextDue && (
            <p className="muted">
              Next card due {nextDue - Date.now() < 60_000 ? 'now' : `in ${formatInterval((nextDue - Date.now()) / 86_400_000)}`}
            </p>
          )}
          <div className="row gap center">
            <button className="btn btn-primary" onClick={() => startSession(true)}>
              Study ahead
            </button>
            {set ? (
              <Link className="btn" to={`/set/${set.id}`}>
                Back to set
              </Link>
            ) : (
              <Link className="btn" to="/">
                Library
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page study">
      {header}
      <div className="row between small muted">
        <span>
          {queue.length} left
          {isNew(progress[current.card.id]) && <span className="pill pill-info">New</span>}
        </span>
        {!set && <span>{current.set.title}</span>}
      </div>
      <ProgressBar value={done} max={Math.max(sessionSize, done + queue.length)} />

      <div className="panel review-card" onClick={() => !revealed && setRevealed(true)}>
        <div className="face-tools">
          <SpeakButton text={prompt} />
          <StarButton cardId={current.card.id} />
        </div>
        <div className="question-prompt">{prompt}</div>
        {promptWith === 'definition' && <CardImage src={current.card.image} />}
        {revealed ? (
          <>
            <hr />
            <div className="review-answer">
              {answer}
              <SpeakButton text={answer} />
            </div>
            {promptWith === 'term' && <CardImage src={current.card.image} />}
            {p && p.lastReviewed > 0 && (
              <div className="muted small">
                Last seen {timeAgo(p.lastReviewed)} · {p.lapses} lapses
              </div>
            )}
          </>
        ) : (
          <div className="muted small reveal-hint">Recall the answer, then tap or press Space to reveal</div>
        )}
      </div>

      {revealed ? (
        <div className="rating-row">
          {([0, 1, 2, 3] as Rating[]).map((r) => (
            <button key={r} className={`rating r${r}`} onClick={() => rate(r)}>
              <span className="rating-label">{RATING_LABELS[r]}</span>
              <span className="small">{p ? formatInterval(nextInterval(p, r)) : ''}</span>
              <kbd>{r + 1}</kbd>
            </button>
          ))}
        </div>
      ) : (
        <div className="row center">
          <button className="btn btn-primary btn-lg" onClick={() => setRevealed(true)} autoFocus>
            Show answer
          </button>
        </div>
      )}
    </div>
  )
}
