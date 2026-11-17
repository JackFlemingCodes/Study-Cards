import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { actions, useAppState } from '../lib/store'
import { gradeAnswer, type Grade } from '../lib/grading'
import {
  learnQuestionType,
  mcOptions,
  nextMastery,
  pickRound,
  toQA,
  type LearnOptions,
  type LearnQuestionType,
  type QA,
} from '../lib/quiz'
import type { Mastery, Side } from '../lib/types'
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

interface Question {
  qa: QA
  type: LearnQuestionType
  options: string[]
  requeued: boolean
}

type Phase = 'question' | 'feedback' | 'summary' | 'done'

export function Learn() {
  const set = useCurrentSet()
  const progress = useAppState((s) => s.progress)
  const defaultPrompt = useAppState((s) => s.settings.promptWith)

  const [promptWith, setPromptWith] = useState<Side>(defaultPrompt)
  const [opts, setOpts] = useState<LearnOptions>({ mc: true, written: true, roundSize: 7 })
  const [starredOnly, setStarredOnly] = useState(false)
  const [showOptions, setShowOptions] = useState(false)

  const [queue, setQueue] = useState<Question[]>([])
  const [roundNum, setRoundNum] = useState(1)
  const [roundCards, setRoundCards] = useState<QA[]>([])
  const [phase, setPhase] = useState<Phase>('question')
  const [response, setResponse] = useState('')
  const [chosen, setChosen] = useState<string | null>(null)
  const [grade, setGrade] = useState<Grade | null>(null)
  const [prevMastery, setPrevMastery] = useState<Mastery>(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const continueRef = useRef<HTMLButtonElement>(null)

  // Read mastery through a ref so callbacks see the latest without re-creating.
  const progressRef = useRef(progress)
  progressRef.current = progress
  const masteryOf = useCallback((id: string): Mastery => progressRef.current[id]?.mastery ?? 0, [])

  const items = useMemo(() => {
    if (!set) return []
    let cards = studyableCards(set)
    if (starredOnly) cards = cards.filter((c) => progressRef.current[c.id]?.starred)
    return cards.map((c) => toQA(c, promptWith))
  }, [set, promptWith, starredOnly])

  const makeQuestion = useCallback(
    (qa: QA, requeued = false): Question => {
      const type = learnQuestionType(masteryOf(qa.card.id), opts)
      return { qa, type, options: type === 'mc' ? mcOptions(qa, items) : [], requeued }
    },
    [items, opts, masteryOf],
  )

  const startRound = useCallback(() => {
    const round = pickRound(items, masteryOf, opts.roundSize)
    setResponse('')
    setChosen(null)
    setGrade(null)
    if (!round.length) {
      setQueue([])
      setPhase('done')
      return
    }
    setRoundCards(round)
    setQueue(round.map((qa) => makeQuestion(qa)))
    setPhase('question')
  }, [items, opts.roundSize, makeQuestion, masteryOf])

  useEffect(() => {
    setRoundNum(1)
    startRound()
    // Restart only when the card pool or question settings change.
  }, [items, opts.mc, opts.written, opts.roundSize]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (set) actions.touchSet(set.id)
  }, [set?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = queue[0]

  useEffect(() => {
    if (phase === 'question' && current?.type === 'written') inputRef.current?.focus()
    if (phase === 'feedback') continueRef.current?.focus()
  }, [phase, current])

  const submit = useCallback(
    (answerGiven: string | null) => {
      if (!current || phase !== 'question') return
      let g: Grade
      if (answerGiven === null) g = 'wrong' // "Don't know"
      else if (current.type === 'mc') g = answerGiven === current.qa.answer ? 'correct' : 'wrong'
      else g = gradeAnswer(answerGiven, current.qa.answer)
      const ok = g !== 'wrong'
      setPrevMastery(masteryOf(current.qa.card.id))
      actions.setMastery(current.qa.card.id, nextMastery(masteryOf(current.qa.card.id), ok), ok)
      setGrade(g)
      if (current.type === 'mc') setChosen(answerGiven)
      setPhase('feedback')
    },
    [current, phase, masteryOf],
  )

  const advance = useCallback(() => {
    if (!current) return
    const wrong = grade === 'wrong'
    const rest = queue.slice(1)
    // Missed cards come back once at the end of the round.
    if (wrong && !current.requeued) rest.push(makeQuestion(current.qa, true))
    setResponse('')
    setChosen(null)
    setGrade(null)
    if (rest.length) {
      setQueue(rest)
      setPhase('question')
    } else {
      setQueue([])
      setPhase(items.every((qa) => masteryOf(qa.card.id) === 2) ? 'done' : 'summary')
    }
  }, [current, grade, queue, makeQuestion, items, masteryOf])

  const override = () => {
    if (!current) return
    // Undo the miss: grade as correct from the level the card had before answering.
    actions.setMastery(current.qa.card.id, nextMastery(prevMastery, true), true)
    setGrade('correct')
  }

  // Auto-advance on correct multiple choice, like Quizlet.
  useEffect(() => {
    if (phase === 'feedback' && grade === 'correct' && current?.type === 'mc') {
      const t = setTimeout(advance, 900)
      return () => clearTimeout(t)
    }
  }, [phase, grade, current, advance])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'question' && current?.type === 'mc') {
        const n = Number(e.key)
        if (n >= 1 && n <= current.options.length) submit(current.options[n - 1])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, current, submit])

  if (!set) return <SetNotFound />
  if (studyableCards(set).length < 2) return <EmptySet set={set} />

  const counts = { 0: 0, 1: 0, 2: 0 } as Record<Mastery, number>
  for (const qa of items) counts[progress[qa.card.id]?.mastery ?? 0]++
  const total = items.length

  return (
    <div className="page study">
      <StudyHeader set={set} mode="Learn">
        <button className="btn btn-sm" onClick={() => setShowOptions((o) => !o)} aria-expanded={showOptions}>
          <Icon name="gear" /> Options
        </button>
      </StudyHeader>

      {showOptions && (
        <div className="panel options-panel">
          <div className="option-row">
            <span>Answer with</span>
            <Segmented
              value={promptWith === 'term' ? 'definition' : 'term'}
              onChange={(v) => setPromptWith(v === 'term' ? 'definition' : 'term')}
              options={[
                { value: 'definition', label: 'Definition' },
                { value: 'term', label: 'Term' },
              ]}
            />
          </div>
          <Toggle
            checked={opts.mc}
            onChange={(v) => setOpts((o) => ({ ...o, mc: v, written: v ? o.written : true }))}
            label="Multiple choice questions"
          />
          <Toggle
            checked={opts.written}
            onChange={(v) => setOpts((o) => ({ ...o, written: v, mc: v ? o.mc : true }))}
            label="Written questions"
          />
          <Toggle checked={starredOnly} onChange={setStarredOnly} label="Study starred terms only" />
          <div className="option-row">
            <span>Questions per round</span>
            <select
              value={opts.roundSize}
              onChange={(e) => setOpts((o) => ({ ...o, roundSize: Number(e.target.value) }))}
            >
              {[5, 7, 10, 15, 20].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-sm"
            onClick={() => {
              if (confirm('Reset Learn progress for this set?')) {
                actions.resetLearn(set.id)
                setTimeout(() => {
                  setRoundNum(1)
                  startRound()
                })
              }
            }}
          >
            Reset progress
          </button>
        </div>
      )}

      <div className="learn-progress">
        <div className="stack-bar">
          <span className="seg seg-new" style={{ flex: counts[0] }} />
          <span className="seg seg-learning" style={{ flex: counts[1] }} />
          <span className="seg seg-mastered" style={{ flex: counts[2] }} />
        </div>
        <div className="legend small">
          <span><i className="dot seg-new" /> {counts[0]} not studied</span>
          <span><i className="dot seg-learning" /> {counts[1]} learning</span>
          <span><i className="dot seg-mastered" /> {counts[2]} mastered</span>
        </div>
      </div>

      {total === 0 ? (
        <div className="empty">
          <p className="muted">No starred terms. Star some cards or turn off “starred only”.</p>
        </div>
      ) : phase === 'done' ? (
        <div className="panel center result-panel">
          <div className="celebrate">🎉</div>
          <h2>You’ve mastered all {total} terms!</h2>
          <p className="muted">Lock it in with a practice test or schedule spaced reviews.</p>
          <div className="row gap center">
            <Link className="btn btn-primary" to={`/set/${set.id}/test`}>
              Take a practice test
            </Link>
            <Link className="btn" to={`/set/${set.id}/review`}>
              Spaced review
            </Link>
            <button
              className="btn"
              onClick={() => {
                actions.resetLearn(set.id)
                setTimeout(() => {
                  setRoundNum(1)
                  startRound()
                })
              }}
            >
              Restart Learn
            </button>
          </div>
        </div>
      ) : phase === 'summary' ? (
        <div className="panel result-panel">
          <h2>Round {roundNum} complete</h2>
          <ProgressBar value={counts[2]} max={total} tone="success" />
          <p className="muted">
            {counts[2]} of {total} mastered. Here’s what you just studied:
          </p>
          <div className="term-list">
            {roundCards.map((qa) => {
              const m = progress[qa.card.id]?.mastery ?? 0
              return (
                <div key={qa.card.id} className="term-row compact">
                  <div className="term-term">{qa.prompt}</div>
                  <div className="term-def">{qa.answer}</div>
                  <div className="term-actions">
                    <span className={`pill ${m === 2 ? 'pill-success' : m === 1 ? 'pill-warn' : ''}`}>
                      {['Missed', 'Learning', 'Mastered'][m]}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="row end">
            <button
              className="btn btn-primary"
              autoFocus
              onClick={() => {
                setRoundNum((r) => r + 1)
                startRound()
              }}
            >
              Continue to round {roundNum + 1}
            </button>
          </div>
        </div>
      ) : current ? (
        <div className="panel question-panel" key={current.qa.card.id + String(current.requeued)}>
          <div className="row between">
            <span className="muted small">
              {current.type === 'mc' ? 'Multiple choice' : 'Written'}
              {current.requeued && ' · Let’s try that again'}
            </span>
            <div className="row">
              <SpeakButton text={current.qa.prompt} />
              <StarButton cardId={current.qa.card.id} />
            </div>
          </div>
          <div className="question-prompt">{current.qa.prompt}</div>
          {promptWith === 'definition' && <CardImage src={current.qa.card.image} />}

          {current.type === 'mc' ? (
            <>
              <div className="muted small">Choose the matching {promptWith === 'term' ? 'definition' : 'term'}</div>
              <div className="choices">
                {current.options.map((opt, i) => {
                  const isAnswer = opt === current.qa.answer
                  const state =
                    phase === 'feedback' ? (isAnswer ? 'right' : opt === chosen ? 'wrong' : 'dim') : ''
                  return (
                    <button
                      key={opt + i}
                      className={`choice ${state}`}
                      disabled={phase !== 'question'}
                      onClick={() => submit(opt)}
                    >
                      <span className="choice-num">{i + 1}</span>
                      <span>{opt}</span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <form
              className="written"
              onSubmit={(e) => {
                e.preventDefault()
                if (phase === 'question') submit(response)
              }}
            >
              <input
                ref={inputRef}
                className={`input input-lg ${phase === 'feedback' ? (grade === 'wrong' ? 'is-wrong' : 'is-right') : ''}`}
                placeholder="Type the answer"
                value={response}
                readOnly={phase !== 'question'}
                onChange={(e) => setResponse(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              {phase === 'question' && (
                <div className="row between">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => submit(null)}>
                    Don’t know?
                  </button>
                  <button className="btn btn-primary" disabled={!response.trim()}>
                    Answer
                  </button>
                </div>
              )}
            </form>
          )}

          {phase === 'question' && current.type === 'mc' && (
            <div className="row end">
              <button className="btn btn-ghost btn-sm" onClick={() => submit(null)}>
                Don’t know?
              </button>
            </div>
          )}

          {phase === 'feedback' && (
            <div className={`feedback ${grade === 'wrong' ? 'bad' : 'good'}`}>
              <div className="feedback-title">
                {grade === 'correct'
                  ? 'Nice job!'
                  : grade === 'close'
                    ? 'Almost — watch your spelling.'
                    : 'Not quite — you’re still learning this one.'}
              </div>
              {grade !== 'correct' && (
                <div className="feedback-answer">
                  <span className="muted small">Correct answer</span>
                  <div>{current.qa.answer}</div>
                  {promptWith === 'term' && <CardImage src={current.qa.card.image} />}
                </div>
              )}
              {!(grade === 'correct' && current.type === 'mc') && (
                <div className="row between">
                  {grade === 'wrong' && current.type === 'written' && response.trim() ? (
                    <button className="btn btn-ghost btn-sm" onClick={override}>
                      Override: I was right
                    </button>
                  ) : (
                    <span />
                  )}
                  <button ref={continueRef} className="btn btn-primary" onClick={advance}>
                    Continue
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="muted small round-info">
            Round {roundNum} · {queue.length} left in this round
          </div>
        </div>
      ) : null}
    </div>
  )
}
