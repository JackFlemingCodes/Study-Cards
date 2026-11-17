import { useEffect, useMemo, useState } from 'react'
import { detectTermSep, parseCards } from '../lib/importExport'
import type { Card } from '../lib/types'
import { Icon } from './Icon'

export function ImportDialog({ onClose, onImport }: { onClose: () => void; onImport: (cards: Card[]) => void }) {
  const [text, setText] = useState('')
  const [termSep, setTermSep] = useState('tab')
  const [customTerm, setCustomTerm] = useState('')
  const [cardSep, setCardSep] = useState('newline')
  const [customCard, setCustomCard] = useState('')
  const [touchedSep, setTouchedSep] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ts = termSep === 'custom' ? customTerm : termSep
  const cs = cardSep === 'custom' ? customCard : cardSep
  const cards = useMemo(() => (cs ? parseCards(text, ts, cs) : []), [text, ts, cs])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Import cards" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2>Import your data</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        <p className="muted small">
          Copy and paste from Word, Excel, Google Docs, or a Quizlet export. Each line becomes a card.
        </p>
        <textarea
          className="input mono"
          rows={8}
          autoFocus
          placeholder={'Word 1\tDefinition 1\nWord 2\tDefinition 2\nWord 3\tDefinition 3'}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (!touchedSep) setTermSep(detectTermSep(e.target.value))
          }}
        />
        <div className="import-options">
          <fieldset>
            <legend>Between term and definition</legend>
            {[
              ['tab', 'Tab'],
              ['comma', 'Comma'],
              ['dash', 'Dash ( - )'],
            ].map(([v, l]) => (
              <label key={v}>
                <input
                  type="radio"
                  name="ts"
                  checked={termSep === v}
                  onChange={() => {
                    setTermSep(v)
                    setTouchedSep(true)
                  }}
                />{' '}
                {l}
              </label>
            ))}
            <label>
              <input
                type="radio"
                name="ts"
                checked={termSep === 'custom'}
                onChange={() => {
                  setTermSep('custom')
                  setTouchedSep(true)
                }}
              />{' '}
              <input
                className="input input-xs"
                placeholder="Custom"
                value={customTerm}
                onFocus={() => setTermSep('custom')}
                onChange={(e) => setCustomTerm(e.target.value)}
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>Between cards</legend>
            {[
              ['newline', 'New line'],
              ['semicolon', 'Semicolon'],
            ].map(([v, l]) => (
              <label key={v}>
                <input type="radio" name="cs" checked={cardSep === v} onChange={() => setCardSep(v)} /> {l}
              </label>
            ))}
            <label>
              <input type="radio" name="cs" checked={cardSep === 'custom'} onChange={() => setCardSep('custom')} />{' '}
              <input
                className="input input-xs"
                placeholder="Custom"
                value={customCard}
                onFocus={() => setCardSep('custom')}
                onChange={(e) => setCustomCard(e.target.value)}
              />
            </label>
          </fieldset>
        </div>
        <div className="import-preview">
          <div className="muted small">Preview · {cards.length} cards</div>
          {cards.slice(0, 50).map((c) => (
            <div key={c.id} className="term-row compact">
              <div className="term-term">{c.term || <span className="muted">—</span>}</div>
              <div className="term-def">{c.definition || <span className="muted">—</span>}</div>
            </div>
          ))}
          {cards.length === 0 && <div className="muted small">Nothing to preview yet.</div>}
        </div>
        <div className="row end gap">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!cards.length} onClick={() => onImport(cards)}>
            Import {cards.length || ''} cards
          </button>
        </div>
      </div>
    </div>
  )
}
