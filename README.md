# Study Cards

A free, Quizlet Plus–style flashcard app. Everything runs in the browser and is saved to `localStorage` — no account or server needed.

## Features

**Sets**
- Create, edit, duplicate, and delete study sets with terms, definitions, and optional image URLs
- Bulk import from pasted text (tab, comma, dash, or custom separators — works with Quizlet exports, Excel, Google Docs), with separator auto-detect and live preview
- Reorder cards, swap terms/definitions, Tab on the last field adds a new card
- Search across sets and cards; JSON export/import for backups

**Study modes**
- **Flashcards** — 3D flip, shuffle, star, starred-only, choose front side, and "Track progress" mode that sorts cards into *Know* / *Still learning* and lets you re-review the misses
- **Learn** — adaptive rounds: multiple choice first, then written answers, until every card is mastered. Missed cards come back at the end of the round. Typo-tolerant grading ("Almost — watch your spelling"), "Override: I was right", and persistent progress
- **Test** — configurable practice test mixing True/False, multiple choice, matching, and written questions, with graded results and history
- **Match** — timed tile-matching game with a 1-second penalty for misses and a personal-best record
- **Spaced review** — SM-2–style spaced repetition (Again / Hard / Good / Easy, with the next interval shown on each button) across one set or your whole library, plus a memory-strength score per set

**Extras**
- Text-to-speech on any card, keyboard shortcuts everywhere (Space to flip, ←/→, 1–4 to answer/rate, S to star)
- Dark mode, responsive mobile layout

## Development

```bash
npm install
npm run dev      # start dev server
npm test         # unit tests (grading, spaced repetition, import/export, quiz building)
npm run build    # production build in dist/
```

Built with React, TypeScript, Vite, and React Router (hash routing, so it works on any static host).

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds, and publishes to GitHub Pages. Turn it on once under **Settings → Pages → Build and deployment → Source: GitHub Actions**.
