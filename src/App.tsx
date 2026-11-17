import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useAppState } from './lib/store'
import { Library } from './pages/Library'
import { SetPage } from './pages/SetPage'
import { EditSet } from './pages/EditSet'
import { Flashcards } from './pages/Flashcards'
import { Learn } from './pages/Learn'
import { TestMode } from './pages/TestMode'
import { Match } from './pages/Match'
import { Review } from './pages/Review'
import { SettingsPage } from './pages/Settings'
import { NotFound } from './pages/NotFound'

export default function App() {
  const theme = useAppState((s) => s.settings.theme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Library />} />
          <Route path="new" element={<EditSet />} />
          <Route path="review" element={<Review />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="set/:id" element={<SetPage />} />
          <Route path="set/:id/edit" element={<EditSet />} />
          <Route path="set/:id/flashcards" element={<Flashcards />} />
          <Route path="set/:id/learn" element={<Learn />} />
          <Route path="set/:id/test" element={<TestMode />} />
          <Route path="set/:id/match" element={<Match />} />
          <Route path="set/:id/review" element={<Review />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
