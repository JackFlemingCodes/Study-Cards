import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { actions, useAppState } from '../lib/store'
import type { Card, Side } from '../lib/types'
import { shuffle } from '../lib/util'
import { Icon } from '../components/Icon'
import {
  CardImage,
  EmptySet,
  ProgressBar,
  Segmented,
  SetNotFound,
  SpeakButton,
  StarButton,
  StudyHeader,
  Toggle,
  studyableCards,
  useCurrentSet,
} from '../components/common'

export function Flashcards() {
  const set = useCurrentSet()
  const progress = useAppState((s) => s.progress)
  const defaultFront = useAppState((s) => s.settings.promptWith)

  const [front, setFront] = useState<Side>(defaultFront)
  const [shuffled, setShuffled] = useState(false)
  const [starredOnly, setStarredOnly] = useState(false)
  const [tracking, setTracking] = useState(false)
  const [deck, setDeck] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<string[]>([])
  const [learning, setLearning] = useState<string[]>([])
  const [showOptions, setShowOptions] = useState(false)

  const base = useMemo(() => (set ? studyableCards(set) : []), [set])
  const starredCount = base.filter((c) => progress[c.id]?.starred).length

  const rebuild = useCallback(
    (only?: Card[]) => {
      let cards = only ?? base
      if (!only && starredOnly) cards = cards.filter((c) => progress[c.id]?.starred)
      setDeck(shuffled ? shuffle(cards) : cards)
      setIndex(0)
      setFlipped(false)
      setKnown([])
      setLearning([])
    },
    // progress intentionally omitted: starring a card mid-session shouldn't reset the deck
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, shuffled, starredOnly],
  )

  useEffect(() => {
    rebuild()
  }, [rebuild])
  useEffect(() => {
    if (set) actions.touchSet(set.id)
  }, [set?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const done = index >= deck.length && deck.length > 0
  const card = deck[index] as Card | undefined

  const next = useCallback(() => {
    setFlipped(false)
    setIndex((i) => Math.min(i + 1, tracking ? deck.length : deck.length - 1))
  }, [deck.length, tracking])
  const prev = useCallback(() => {
    setFlipped(false)
    setIndex((i) => Math.max(0, i - 1))
  }, [])

  const sort = useCallback(
    (knowIt: boolean) => {
      if (!card) return
      ;(knowIt ? setKnown : setLearning)((xs) => [...xs, card.id])
      setFlipped(false)
      setIndex((i) => i + 1)
    },
    [card],
  )

  const undo = () => {
    if (index === 0) return
    const prevId = deck[index - 1].id
    setKnown((xs) => xs.filter((x) => x !== prevId))
    setLearning((xs) => xs.filter((x) => x !== prevId))
    setFlipped(false)
    setIndex((i) => i - 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (e.key === 'ArrowRight') {
        if (tracking) sort(true)
        else next()
      } else if (e.key === 'ArrowLeft') {
        if (tracking) sort(false)
        else prev()
      } else if (e.key.toLowerCase() === 's' && card) {
        actions.toggleStar(card.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tracking, sort, next, prev, card])

  if (!set) return <SetNotFound />
  if (base.length < 2) return <EmptySet set={set} />

  const frontText = card ? (front === 'term' ? card.term : card.definition) : ''
  const backText = card ? (front === 'term' ? card.definition : card.term) : ''

  return (
    <div className="page study">
      <StudyHeader set={set} mode="Flashcards">
        <button className="btn btn-sm" onClick={() => setShowOptions((o) => !o)} aria-expanded={showOptions}>
          <Icon name="gear" /> Options
        </button>
      </StudyHeader>

      {showOptions && (
        <div className="panel options-panel">
          <div className="option-row">
            <span>Front side</span>
            <Segmented
              value={front}
              onChange={setFront}
              options={[
                { value: 'term', label: 'Term' },
                { value: 'definition', label: 'Definition' },
              ]}
            />
          </div>
          <Toggle checked={shuffled} onChange={setShuffled} label="Shuffle" />
          <Toggle
            checked={starredOnly}
            onChange={setStarredOnly}
            disabled={starredCount === 0}
            label={`Starred only (${starredCount})`}
          />
          <Toggle
            checked={tracking}
            onChange={(v) => {
              setTracking(v)
              rebuild()
            }}
            label="Track progress (sort into Know / Still learning)"
          />
        </div>
      )}

      {done ? (
        <div className="panel center result-panel">
          <h2>{learning.length === 0 ? 'You know them all! 🎉' : 'Nice work — keep going.'}</h2>
          <div className="result-split">
            <div>
              <div className="big-number success">{known.length}</div>
              <div className="muted">Know</div>
            </div>
            <div>
              <div className="big-number warn">{learning.length}</div>
              <div className="muted">Still learning</div>
            </div>
          </div>
          <div className="row gap center">
            {learning.length > 0 && (
              <button
                className="btn btn-primary"
                onClick={() => rebuild(deck.filter((c) => learning.includes(c.id)))}
              >
                Keep reviewing {learning.length} terms
              </button>
            )}
            <button className="btn" onClick={() => rebuild()}>
              Restart flashcards
            </button>
            <Link className="btn" to={`/set/${set.id}/learn`}>
              Try Learn mode
            </Link>
          </div>
        </div>
      ) : card ? (
        <>
          {tracking && (
            <div className="row between tracking-counts">
              <span className="pill pill-warn">{learning.length} still learning</span>
              <span className="pill pill-success">{known.length} know</span>
            </div>
          )}
          <div
            className={`flashcard ${flipped ? 'flipped' : ''}`}
            onClick={() => setFlipped((f) => !f)}
            role="button"
            tabIndex={0}
            aria-label={flipped ? `Back: ${backText}` : `Front: ${frontText}`}
          >
            <div className="flashcard-inner">
              <div className="flashcard-face front">
                <div className="face-tools">
                  <SpeakButton text={frontText} />
                  <StarButton cardId={card.id} />
                </div>
                <div className={`face-text ${frontText.length > 120 ? 'long' : ''}`}>{frontText}</div>
                {front === 'definition' && <CardImage src={card.image} />}
              </div>
              <div className="flashcard-face back">
                <div className="face-tools">
                  <SpeakButton text={backText} />
                  <StarButton cardId={card.id} />
                </div>
                <div className={`face-text ${backText.length > 120 ? 'long' : ''}`}>{backText}</div>
                {front === 'term' && <CardImage src={card.image} />}
              </div>
            </div>
          </div>

          <div className="flash-controls">
            {tracking ? (
              <>
                <button className="btn btn-round warn" onClick={() => sort(false)} aria-label="Still learning">
                  <Icon name="x" size={22} />
                </button>
                <span className="counter">
                  {index + 1} / {deck.length}
                </span>
                <button className="btn btn-round success" onClick={() => sort(true)} aria-label="Know">
                  <Icon name="check" size={22} />
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-round" onClick={prev} disabled={index === 0} aria-label="Previous">
                  <Icon name="left" size={22} />
                </button>
                <span className="counter">
                  {index + 1} / {deck.length}
                </span>
                <button
                  className="btn btn-round"
                  onClick={next}
                  disabled={index >= deck.length - 1}
                  aria-label="Next"
                >
                  <Icon name="right" size={22} />
                </button>
              </>
            )}
          </div>
          <div className="row between">
            <div className="row gap">
              {tracking && (
                <button className="btn btn-sm btn-ghost" onClick={undo} disabled={index === 0}>
                  Undo
                </button>
              )}
              <button
                className={`btn btn-sm btn-ghost ${shuffled ? 'active' : ''}`}
                onClick={() => setShuffled((s) => !s)}
                aria-pressed={shuffled}
              >
                <Icon name="shuffle" /> Shuffle
              </button>
            </div>
            <span className="muted small hide-sm">
              Space to flip · ← → to {tracking ? 'sort' : 'navigate'} · S to star
            </span>
          </div>
          <ProgressBar value={index + (tracking ? 0 : 1)} max={deck.length} />
        </>
      ) : (
        <div className="empty">
          <p className="muted">No cards match these options.</p>
        </div>
      )}
    </div>
  )
}
