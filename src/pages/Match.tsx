import { useEffect, useMemo, useRef, useState } from 'react'
import { actions, useAppState } from '../lib/store'
import { sample, shuffle, formatMs } from '../lib/util'
import { EmptySet, SetNotFound, StudyHeader, studyableCards, useCurrentSet } from '../components/common'

interface Tile {
  id: string
  cardId: string
  text: string
  image?: string
}

const PAIRS = 6
const PENALTY_MS = 1000

export function Match() {
  const set = useCurrentSet()
  const best = useAppState((s) => (set ? s.meta[set.id]?.bestMatchMs : undefined))
  const cards = useMemo(() => (set ? studyableCards(set) : []), [set])

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready')
  const [tiles, setTiles] = useState<Tile[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [cleared, setCleared] = useState<Set<string>>(new Set())
  const [wrong, setWrong] = useState<string[]>([])
  const [start, setStart] = useState(0)
  const [penalty, setPenalty] = useState(0)
  const [now, setNow] = useState(0)
  const [finalMs, setFinalMs] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const raf = useRef(0)

  useEffect(() => {
    if (phase !== 'playing') return
    const tick = () => {
      setNow(performance.now())
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [phase])

  if (!set) return <SetNotFound />
  if (cards.length < 2) return <EmptySet set={set} />

  function begin() {
    const picked = sample(cards, PAIRS)
    const t: Tile[] = shuffle(
      picked.flatMap((c) => [
        { id: c.id + ':t', cardId: c.id, text: c.term },
        { id: c.id + ':d', cardId: c.id, text: c.definition, image: c.image },
      ]),
    )
    setTiles(t)
    setCleared(new Set())
    setSelected(null)
    setWrong([])
    setPenalty(0)
    const t0 = performance.now()
    setStart(t0)
    setNow(t0)
    setPhase('playing')
  }

  function pick(tile: Tile) {
    if (cleared.has(tile.id) || wrong.length) return
    if (!selected) return setSelected(tile.id)
    if (selected === tile.id) return setSelected(null)
    const other = tiles.find((t) => t.id === selected)!
    if (other.cardId === tile.cardId) {
      const next = new Set(cleared).add(tile.id).add(other.id)
      setCleared(next)
      setSelected(null)
      if (next.size === tiles.length) {
        const ms = performance.now() - start + penalty
        setFinalMs(ms)
        setNewBest(actions.recordMatch(set!.id, ms))
        setPhase('done')
      }
    } else {
      setWrong([tile.id, other.id])
      setPenalty((p) => p + PENALTY_MS)
      setSelected(null)
      setTimeout(() => setWrong([]), 450)
    }
  }

  const elapsed = phase === 'playing' ? now - start + penalty : finalMs

  return (
    <div className="page study">
      <StudyHeader set={set} mode="Match">
        <span className="timer">{formatMs(elapsed)}</span>
      </StudyHeader>

      {phase === 'ready' && (
        <div className="panel center result-panel">
          <h2>Ready to play?</h2>
          <p className="muted">
            Match all the terms with their definitions as fast as you can.
            <br />
            Wrong matches add 1 second.
          </p>
          {best !== undefined && <p>Your best: <strong>{formatMs(best)}</strong></p>}
          <button className="btn btn-primary btn-lg" onClick={begin} autoFocus>
            Start game
          </button>
        </div>
      )}

      {phase === 'playing' && (
        <div className="match-grid">
          {tiles.map((t) => (
            <button
              key={t.id}
              className={`match-tile ${cleared.has(t.id) ? 'cleared' : ''} ${selected === t.id ? 'selected' : ''} ${
                wrong.includes(t.id) ? 'shake' : ''
              }`}
              onClick={() => pick(t)}
              disabled={cleared.has(t.id)}
            >
              {t.image && <img src={t.image} alt="" />}
              <span>{t.text}</span>
            </button>
          ))}
        </div>
      )}

      {phase === 'done' && (
        <div className="panel center result-panel">
          <div className="celebrate">{newBest ? '🏆' : '⏱️'}</div>
          <h2>{newBest ? 'New personal best!' : 'Nice matching!'}</h2>
          <div className="big-number">{formatMs(finalMs)}</div>
          {!newBest && best !== undefined && <p className="muted">Your best is {formatMs(best)}</p>}
          {penalty > 0 && <p className="muted small">Includes {penalty / 1000}s of penalties</p>}
          <button className="btn btn-primary btn-lg" onClick={begin} autoFocus>
            Play again
          </button>
        </div>
      )}
    </div>
  )
}
