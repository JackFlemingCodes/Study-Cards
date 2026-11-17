import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { actions, useAppState } from '../lib/store'
import { canSpeak, speak } from '../lib/speech'
import type { StudySet } from '../lib/types'
import { Icon } from './Icon'

/** Current set from the :id route param (stable reference from the store). */
export function useCurrentSet(): StudySet | undefined {
  const { id } = useParams()
  return useAppState((s) => (id ? s.sets[id] : undefined))
}

export function SetNotFound() {
  return (
    <div className="empty">
      <h2>Set not found</h2>
      <p className="muted">It may have been deleted.</p>
      <Link className="btn btn-primary" to="/">
        Back to library
      </Link>
    </div>
  )
}

export function EmptySet({ set }: { set: StudySet }) {
  return (
    <div className="empty">
      <h2>This set needs more cards</h2>
      <p className="muted">Add at least two cards with both a term and a definition to study.</p>
      <Link className="btn btn-primary" to={`/set/${set.id}/edit`}>
        Edit set
      </Link>
    </div>
  )
}

export function StudyHeader({
  set,
  mode,
  children,
}: {
  set: StudySet
  mode: string
  children?: ReactNode
}) {
  return (
    <div className="study-header">
      <Link to={`/set/${set.id}`} className="back-link">
        <Icon name="left" size={16} /> {set.title}
      </Link>
      <h1 className="study-mode-title">{mode}</h1>
      <div className="study-header-right">{children}</div>
    </div>
  )
}

export function ProgressBar({ value, max, tone = 'primary' }: { value: number; max: number; tone?: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className={`progress-fill tone-${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function SpeakButton({ text }: { text: string }) {
  if (!canSpeak) return null
  return (
    <button
      className="icon-btn"
      aria-label="Read aloud"
      title="Read aloud"
      onClick={(e) => {
        e.stopPropagation()
        speak(text)
      }}
    >
      <Icon name="speaker" />
    </button>
  )
}

export function StarButton({ cardId }: { cardId: string }) {
  const starred = useAppState((s) => s.progress[cardId]?.starred ?? false)
  return (
    <button
      className={`icon-btn star ${starred ? 'on' : ''}`}
      aria-label={starred ? 'Unstar' : 'Star'}
      aria-pressed={starred}
      title={starred ? 'Unstar' : 'Star'}
      onClick={(e) => {
        e.stopPropagation()
        actions.toggleStar(cardId)
      }}
    >
      <Icon name="star" filled={starred} />
    </button>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  disabled?: boolean
}) {
  return (
    <label className={`toggle ${disabled ? 'disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" />
      <span>{label}</span>
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Cards with both sides filled in. */
export function studyableCards(set: StudySet) {
  return set.cards.filter((c) => c.term.trim() && c.definition.trim())
}

export function CardImage({ src }: { src?: string }) {
  if (!src) return null
  return <img className="card-image" src={src} alt="" loading="lazy" />
}
