import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { actions, useAppState } from '../lib/store'
import { gradeAnswer } from '../lib/grading'
import { buildTest, questionWeight, toQA, type TestQuestion, type TestQuestionType } from '../lib/quiz'
import type { Side } from '../lib/types'
import { Icon } from '../components/Icon'
import {
  CardImage,
  EmptySet,
  ProgressBar,
  Segmented,
  SetNotFound,
  StudyHeader,
  Toggle,
  studyableCards,
  useCurrentSet,
} from '../components/common'

const TYPE_LABELS: Record<TestQuestionType, string> = {
  tf: 'True / False',
  mc: 'Multiple choice',
  match: 'Matching',
  written: 'Written',
}

/** Answers keyed by question index. Matching answers are keyed per item: `${qi}:${itemIndex}`. */
type Answers = Record<string, string>

export function TestMode() {
  const set = useCurrentSet()
  const defaultPrompt = useAppState((s) => s.settings.promptWith)
  const progress = useAppState((s) => s.progress)
  const cards = useMemo(() => (set ? studyableCards(set) : []), [set])

  const [count, setCount] = useState(() => Math.min(20, cards.length))
  const [types, setTypes] = useState<TestQuestionType[]>(['tf', 'mc', 'match', 'written'])
  const [promptWith, setPromptWith] = useState<Side>(defaultPrompt)
  const [starredOnly, setStarredOnly] = useState(false)
  const [questions, setQuestions] = useState<TestQuestion[] | null>(null)
  const [answers, setAnswers] = useState<Answers>({})
  const [overrides, setOverrides] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  if (!set) return <SetNotFound />
  if (cards.length < 2) return <EmptySet set={set} />

  const pool = starredOnly ? cards.filter((c) => progress[c.id]?.starred) : cards

  function start() {
    const qas = pool.map((c) => toQA(c, promptWith))
    setQuestions(buildTest(qas, count, types))
    setAnswers({})
    setOverrides(new Set())
    setSubmitted(false)
    window.scrollTo(0, 0)
  }

  function isCorrect(q: TestQuestion, qi: number, itemIndex = 0): boolean {
    const key = q.kind === 'match' ? `${qi}:${itemIndex}` : String(qi)
    if (overrides.has(key)) return true
    const a = answers[key]
    switch (q.kind) {
      case 'written':
        return !!a && gradeAnswer(a, q.qa.answer) !== 'wrong'
      case 'mc':
        return a === q.qa.answer
      case 'tf':
        return a === (q.isTrue ? 'true' : 'false')
      case 'match':
        return a === q.items[itemIndex].answer
    }
  }

  const score = (qs: TestQuestion[]) =>
    qs.reduce(
      (n, q, qi) => n + (q.kind === 'match' ? q.items.filter((_, ii) => isCorrect(q, qi, ii)).length : isCorrect(q, qi) ? 1 : 0),
      0,
    )

  // ---------- Setup screen ----------
  if (!questions) {
    return (
      <div className="page study narrow">
        <StudyHeader set={set} mode="Test" />
        <div className="panel form">
          <h2>Set up your test</h2>
          <div className="option-row">
            <span>Questions (max {pool.length})</span>
            <input
              type="number"
              className="input input-xs"
              min={1}
              max={pool.length}
              value={Math.min(count, pool.length)}
              onChange={(e) => setCount(Math.max(1, Math.min(pool.length, Number(e.target.value) || 1)))}
            />
          </div>
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
          <Toggle checked={starredOnly} onChange={setStarredOnly} label="Starred terms only" />
          <hr />
          {(Object.keys(TYPE_LABELS) as TestQuestionType[]).map((t) => (
            <Toggle
              key={t}
              checked={types.includes(t)}
              onChange={(on) => setTypes((ts) => (on ? [...ts, t] : ts.filter((x) => x !== t)))}
              label={TYPE_LABELS[t]}
            />
          ))}
          <button className="btn btn-primary btn-lg" disabled={!types.length || pool.length === 0} onClick={start}>
            Start test
          </button>
          {pool.length === 0 && <p className="muted small">No starred terms to test.</p>}
        </div>
      </div>
    )
  }

  const total = questions.reduce((n, q) => n + questionWeight(q), 0)
  const answeredCount = questions.reduce(
    (n, q, qi) =>
      n + (q.kind === 'match' ? q.items.filter((_, ii) => answers[`${qi}:${ii}`]).length : answers[qi] ? 1 : 0),
    0,
  )
  const correct = submitted ? score(questions) : 0
  const pct = total ? Math.round((correct / total) * 100) : 0

  function submit() {
    if (answeredCount < total && !confirm(`You have ${total - answeredCount} unanswered. Submit anyway?`)) return
    setSubmitted(true)
    actions.recordTest(set!.id, { date: Date.now(), score: score(questions!), total })
    window.scrollTo(0, 0)
  }

  const set1 = (key: string | number, v: string) => !submitted && setAnswers((a) => ({ ...a, [key]: v }))
  let lastKind: string | null = null
  let number = 0

  return (
    <div className="page study narrow">
      <StudyHeader set={set} mode="Test">
        <span className="muted small">
          {answeredCount}/{total} answered
        </span>
      </StudyHeader>

      {submitted && (
        <div className="panel result-panel">
          <h2>{pct >= 90 ? 'Outstanding! 🎉' : pct >= 70 ? 'Nice work!' : 'Keep practicing — you’ll get there.'}</h2>
          <div className="result-split">
            <div>
              <div className={`big-number ${pct >= 70 ? 'success' : 'warn'}`}>{pct}%</div>
              <div className="muted">
                {correct} of {total} correct
              </div>
            </div>
          </div>
          <ProgressBar value={correct} max={total} tone={pct >= 70 ? 'success' : 'warn'} />
          <div className="row gap center">
            <button className="btn btn-primary" onClick={start}>
              Take a new test
            </button>
            <button className="btn" onClick={() => setQuestions(null)}>
              Change options
            </button>
            <Link className="btn" to={`/set/${set.id}/learn`}>
              Study with Learn
            </Link>
          </div>
        </div>
      )}

      {!submitted && <ProgressBar value={answeredCount} max={total} />}

      {questions.map((q, qi) => {
        const header = q.kind !== lastKind ? <h3 className="test-section">{TYPE_LABELS[q.kind]}</h3> : null
        lastKind = q.kind
        number += 1
        const n = number
        const res = submitted && q.kind !== 'match' ? (isCorrect(q, qi) ? 'right' : 'wrong') : ''

        return (
          <div key={qi}>
            {header}
            <div className={`panel test-q ${res}`}>
              <div className="row between">
                <span className="muted small">
                  {n} of {questions.length}
                </span>
                {res && <span className={`pill ${res === 'right' ? 'pill-success' : 'pill-danger'}`}>{res === 'right' ? 'Correct' : 'Incorrect'}</span>}
              </div>

              {q.kind === 'tf' && (
                <>
                  <div className="tf-grid">
                    <div>
                      <div className="muted small">{promptWith === 'term' ? 'Term' : 'Definition'}</div>
                      <div className="question-prompt sm">{q.qa.prompt}</div>
                    </div>
                    <div>
                      <div className="muted small">{promptWith === 'term' ? 'Definition' : 'Term'}</div>
                      <div className="question-prompt sm">{q.shown}</div>
                    </div>
                  </div>
                  <div className="choices two">
                    {['true', 'false'].map((v) => {
                      const correctV = q.isTrue ? 'true' : 'false'
                      const st = submitted ? (v === correctV ? 'right' : answers[qi] === v ? 'wrong' : 'dim') : answers[qi] === v ? 'selected' : ''
                      return (
                        <button key={v} className={`choice ${st}`} onClick={() => set1(qi, v)} disabled={submitted}>
                          {v === 'true' ? 'True' : 'False'}
                        </button>
                      )
                    })}
                  </div>
                  {submitted && !q.isTrue && (
                    <p className="small muted">
                      Correct match: <strong>{q.qa.answer}</strong>
                    </p>
                  )}
                </>
              )}

              {q.kind === 'mc' && (
                <>
                  <div className="question-prompt sm">{q.qa.prompt}</div>
                  {promptWith === 'definition' && <CardImage src={q.qa.card.image} />}
                  <div className="choices">
                    {q.options.map((opt, i) => {
                      const st = submitted
                        ? opt === q.qa.answer
                          ? 'right'
                          : answers[qi] === opt
                            ? 'wrong'
                            : 'dim'
                        : answers[qi] === opt
                          ? 'selected'
                          : ''
                      return (
                        <button key={opt + i} className={`choice ${st}`} onClick={() => set1(qi, opt)} disabled={submitted}>
                          <span className="choice-num">{String.fromCharCode(65 + i)}</span>
                          <span>{opt}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {q.kind === 'written' && (
                <>
                  <div className="question-prompt sm">{q.qa.prompt}</div>
                  {promptWith === 'definition' && <CardImage src={q.qa.card.image} />}
                  <input
                    className={`input ${res === 'wrong' ? 'is-wrong' : res === 'right' ? 'is-right' : ''}`}
                    placeholder="Type the answer"
                    value={answers[qi] ?? ''}
                    readOnly={submitted}
                    onChange={(e) => set1(qi, e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {submitted && res === 'wrong' && (
                    <div className="row between small">
                      <span>
                        Correct answer: <strong>{q.qa.answer}</strong>
                      </span>
                      {answers[qi] && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setOverrides((o) => new Set(o).add(String(qi)))
                          }}
                        >
                          Override: I was right
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {q.kind === 'match' && (
                <div className="match-q">
                  <div className="match-bank">
                    {q.choices.map((c, ci) => (
                      <span key={ci} className="chip">
                        <strong>{String.fromCharCode(65 + ci)}</strong> {c}
                      </span>
                    ))}
                  </div>
                  {q.items.map((item, ii) => {
                    const key = `${qi}:${ii}`
                    const ok = submitted && isCorrect(q, qi, ii)
                    return (
                      <div key={ii} className={`match-row ${submitted ? (ok ? 'right' : 'wrong') : ''}`}>
                        <select
                          value={answers[key] ?? ''}
                          onChange={(e) => set1(key, e.target.value)}
                          disabled={submitted}
                          aria-label={`Match for ${item.prompt}`}
                        >
                          <option value="">—</option>
                          {q.choices.map((c, ci) => (
                            <option key={ci} value={c}>
                              {String.fromCharCode(65 + ci)}
                            </option>
                          ))}
                        </select>
                        <span className="match-prompt">{item.prompt}</span>
                        {submitted && !ok && (
                          <span className="small muted">→ {item.answer}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {!submitted ? (
        <div className="row end">
          <button className="btn btn-primary btn-lg" onClick={submit}>
            <Icon name="check" /> Submit test
          </button>
        </div>
      ) : (
        <div className="row end gap">
          <button className="btn btn-primary" onClick={start}>
            Take a new test
          </button>
        </div>
      )}
    </div>
  )
}
