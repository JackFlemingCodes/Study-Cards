import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { actions, getState } from '../lib/store'
import type { Card } from '../lib/types'
import { uid } from '../lib/util'
import { Icon } from '../components/Icon'
import { SetNotFound } from '../components/common'
import { ImportDialog } from '../components/ImportDialog'

const blank = (): Card => ({ id: uid(), term: '', definition: '' })

export function EditSet() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = id ? getState().sets[id] : undefined
  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [cards, setCards] = useState<Card[]>(() =>
    existing ? existing.cards.map((c) => ({ ...c })) : [blank(), blank(), blank()],
  )
  const [showImages, setShowImages] = useState<Set<string>>(
    () => new Set(existing?.cards.filter((c) => c.image).map((c) => c.id)),
  )
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const focusId = useRef<string | null>(null)

  useEffect(() => {
    if (focusId.current) {
      document.querySelector<HTMLTextAreaElement>(`[data-term="${focusId.current}"]`)?.focus()
      focusId.current = null
    }
  }, [cards])

  if (id && !existing) return <SetNotFound />

  const update = (cid: string, patch: Partial<Card>) =>
    setCards((cs) => cs.map((c) => (c.id === cid ? { ...c, ...patch } : c)))

  const addCard = (focus = true) => {
    const c = blank()
    if (focus) focusId.current = c.id
    setCards((cs) => [...cs, c])
  }

  const move = (i: number, dir: -1 | 1) =>
    setCards((cs) => {
      const j = i + dir
      if (j < 0 || j >= cs.length) return cs
      const next = cs.slice()
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  function save() {
    const cleaned = cards
      .map((c) => ({ ...c, term: c.term.trim(), definition: c.definition.trim(), image: c.image?.trim() || undefined }))
      .filter((c) => c.term || c.definition)
    if (!title.trim()) return setError('Give your set a title.')
    if (cleaned.length < 2) return setError('Add at least two cards.')
    const data = { title: title.trim(), description: description.trim(), cards: cleaned }
    if (existing) {
      actions.updateSet(existing.id, data)
      navigate(`/set/${existing.id}`)
    } else {
      navigate(`/set/${actions.createSet(data)}`)
    }
  }

  const filled = cards.filter((c) => c.term.trim() || c.definition.trim()).length

  return (
    <div className="page narrow">
      <div className="page-head sticky-head">
        <h1>{existing ? 'Edit set' : 'Create a new study set'}</h1>
        <div className="row gap">
          <button className="btn" onClick={() => navigate(existing ? `/set/${existing.id}` : '/')}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            {existing ? 'Save' : 'Create'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="panel form">
        <input
          className="input input-lg"
          placeholder='Title, e.g. "Biology – Chapter 22: Evolution"'
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setError('')
          }}
          autoFocus={!existing}
        />
        <textarea
          className="input"
          placeholder="Add a description…"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="row between editor-tools">
        <div className="row gap">
          <button className="btn" onClick={() => setImporting(true)}>
            <Icon name="upload" /> Import
          </button>
          <button
            className="btn"
            onClick={() => setCards((cs) => cs.map((c) => ({ ...c, term: c.definition, definition: c.term })))}
            title="Swap terms and definitions"
          >
            <Icon name="flip" /> Swap sides
          </button>
        </div>
        <span className="muted small">{filled} cards</span>
      </div>

      <div className="editor-list">
        {cards.map((c, i) => (
          <div key={c.id} className="editor-card">
            <div className="editor-card-head">
              <span className="muted">{i + 1}</span>
              <div className="row">
                <button
                  className="icon-btn"
                  title="Add image"
                  aria-label="Add image"
                  onClick={() =>
                    setShowImages((s) => {
                      const n = new Set(s)
                      if (n.has(c.id)) n.delete(c.id)
                      else n.add(c.id)
                      return n
                    })
                  }
                >
                  <Icon name="image" />
                </button>
                <button className="icon-btn" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                  <Icon name="up" />
                </button>
                <button
                  className="icon-btn"
                  aria-label="Move down"
                  onClick={() => move(i, 1)}
                  disabled={i === cards.length - 1}
                >
                  <Icon name="down" />
                </button>
                <button
                  className="icon-btn"
                  aria-label="Delete card"
                  onClick={() => setCards((cs) => cs.filter((x) => x.id !== c.id))}
                  disabled={cards.length <= 1}
                >
                  <Icon name="trash" />
                </button>
              </div>
            </div>
            <div className="editor-fields">
              <label>
                <textarea
                  data-term={c.id}
                  className="input underline"
                  rows={1}
                  value={c.term}
                  onChange={(e) => update(c.id, { term: e.target.value })}
                />
                <span className="field-label">Term</span>
              </label>
              <label>
                <textarea
                  className="input underline"
                  rows={1}
                  value={c.definition}
                  onChange={(e) => update(c.id, { definition: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab' && !e.shiftKey && i === cards.length - 1) {
                      e.preventDefault()
                      addCard()
                    }
                  }}
                />
                <span className="field-label">Definition</span>
              </label>
            </div>
            {showImages.has(c.id) && (
              <label className="image-field">
                <input
                  className="input underline"
                  placeholder="https://… image URL"
                  value={c.image ?? ''}
                  onChange={(e) => update(c.id, { image: e.target.value })}
                />
                <span className="field-label">Image URL (shown with the definition)</span>
                {c.image && <img src={c.image} alt="" className="card-image" />}
              </label>
            )}
          </div>
        ))}
      </div>

      <button className="add-card" onClick={() => addCard()}>
        <Icon name="plus" /> Add card
      </button>

      <div className="row end">
        <button className="btn btn-primary btn-lg" onClick={save}>
          {existing ? 'Save' : 'Create'}
        </button>
      </div>

      {importing && (
        <ImportDialog
          onClose={() => setImporting(false)}
          onImport={(imported) => {
            setCards((cs) => [...cs.filter((c) => c.term.trim() || c.definition.trim()), ...imported])
            setImporting(false)
          }}
        />
      )}
    </div>
  )
}
