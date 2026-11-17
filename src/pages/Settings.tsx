import { useRef, useState } from 'react'
import { actions, useAppState } from '../lib/store'
import { download, exportSets, importSets } from '../lib/importExport'
import { Segmented } from '../components/common'
import { Icon } from '../components/Icon'

export function SettingsPage() {
  const settings = useAppState((s) => s.settings)
  const sets = useAppState((s) => s.sets)
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>Settings</h1>
      </div>

      <div className="panel form">
        <h3>Study</h3>
        <div className="option-row">
          <span>Theme</span>
          <Segmented
            value={settings.theme}
            onChange={(theme) => actions.updateSettings({ theme })}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
        <div className="option-row">
          <span>Default prompt side</span>
          <Segmented
            value={settings.promptWith}
            onChange={(promptWith) => actions.updateSettings({ promptWith })}
            options={[
              { value: 'term', label: 'Term' },
              { value: 'definition', label: 'Definition' },
            ]}
          />
        </div>
        <div className="option-row">
          <span>New cards per review session</span>
          <input
            type="number"
            className="input input-xs"
            min={0}
            max={200}
            value={settings.newCardsPerDay}
            onChange={(e) => actions.updateSettings({ newCardsPerDay: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
      </div>

      <div className="panel form">
        <h3>Your data</h3>
        <p className="muted small">
          Everything is stored in this browser. Export a backup to move your sets to another device.
        </p>
        <div className="row gap wrap">
          <button
            className="btn"
            onClick={() => download('study-cards-backup.json', exportSets(Object.values(sets)))}
          >
            <Icon name="download" /> Export all sets
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" /> Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                const imported = importSets(await f.text())
                actions.addSets(imported)
                setMsg(`Imported ${imported.length} set(s).`)
              } catch {
                setMsg('That file could not be imported.')
              }
            }}
          />
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm('Delete ALL sets and progress? This cannot be undone.')) {
                actions.resetAll()
                setMsg('Everything was reset.')
              }
            }}
          >
            <Icon name="trash" /> Reset everything
          </button>
        </div>
        {msg && <div className="alert">{msg}</div>}
      </div>
    </div>
  )
}
