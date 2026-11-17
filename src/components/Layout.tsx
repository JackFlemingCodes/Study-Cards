import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import { actions, useAppState } from '../lib/store'
import { isDue } from '../lib/srs'
import { Icon } from './Icon'

export function Layout() {
  const theme = useAppState((s) => s.settings.theme)
  const progress = useAppState((s) => s.progress)
  const sets = useAppState((s) => s.sets)
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const dueCount = useMemo(() => {
    const now = Date.now()
    let n = 0
    for (const set of Object.values(sets)) for (const c of set.cards) if (isDue(progress[c.id], now)) n++
    return n
  }, [sets, progress])

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">S</span>
          <span>Study Cards</span>
        </Link>
        <nav className="topnav">
          <NavLink to="/" end>
            <Icon name="home" /> <span className="hide-sm">Library</span>
          </NavLink>
          <NavLink to="/review">
            <Icon name="brain" /> <span className="hide-sm">Review</span>
            {dueCount > 0 && <span className="badge">{dueCount}</span>}
          </NavLink>
          <NavLink to="/settings" aria-label="Settings">
            <Icon name="gear" />
          </NavLink>
          <button
            className="icon-btn"
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
            onClick={() => actions.updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <Link to="/new" className="btn btn-primary btn-sm">
            <Icon name="plus" /> <span className="hide-sm">Create</span>
          </Link>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
