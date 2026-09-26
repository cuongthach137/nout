# Data Systems Lab: working notes

Interactive database course for interview prep, basics to advanced. Static site, no build step: `python3 -m http.server 8000`. Deployed to GitHub Pages on merge to `main`.

## Structure
- `js/core.js`: lesson list (order = numbering), `DSL.store` (all saved data, `dsl-` keys; never touch localStorage elsewhere), `DSL.modules()`, mode registry (Narrated default when a lesson's narration is `complete`, then Guided, then Explore), `lessonRef`/`labLabel` (refer to lessons by id, never by number).
- `app.js`: router (`#/<id>`, `?mode=` saves a pick, `?view=` one visit), sidebar, Back up / Restore.
- `js/components/`: `lab-kit.js` (asides, progress checklist, `setStatus`, motion helpers), `guided.js` (step engine, storyboard, quiz/finish beats), `narrator.js` (narrated film engine, keywords panel, `story()`, `quizChapter()`, `throttled()`), `vocab.js` (keywords, flashcards, spaced repetition). `sql.js`: in-browser SQLite (vendored `vendor/sql.js`, run in a Web Worker, fresh database per query, 3 s timeout), the `bakery` dataset, `compare()` checker, and `DSL.Sql.lab()` exercise widget for all three modes.
- Practice pages (`DSL.registerPage`): `#/flashcards` (vocab.js), `#/sql` sandbox (`js/pages/sql-sandbox.js`).
- Per lesson: `js/lessons/<name>.js` (Explore), `-guided.js`, `-narrated.js`, `narration/<lesson>.json` (script: lines, speakers, keywords), generated `narration/<lesson>.js`. Narrated lessons reuse scenes exposed by the guided file (`DSL.StorageScenes`, `DSL.ModelingScenes`, `DSL.SelectScenes`).
- Script and style tags in `index.html` load in dependency order; bump `?v=` on changed files.
- New lessons: see `docs/adding-a-lesson.md`. Design Narrated first (the focused lesson), then Guided (more explanation), then Explore (most detail). Existing lesson content isn't a constraint: when porting a lesson, fix what's inaccurate or unclear and list the fixes in the PR.

## Narration and audio
- Rules: `narration/STYLE.md` (lesson budget 8-12 min, 3 big ideas, 8 keywords; `<k>` keyword marks; tutor vs interviewer voices).
- `uv run tools/voice.py lint|build|deploy narration/<lesson>.json`. Build renders only changed lines (Kokoro, 40 kbps). Audio is NOT in git: `deploy` uploads `audio/` to the Cloudflare Worker `nout-audio` (`nout-audio.yourshirtisajoke.workers.dev`, set in `index.html` meta `audio-base`). Run deploy whenever a PR that changes narration merges. Never run `wrangler pages ...` (it auto-deploys the whole repo); `voice.py deploy` passes an explicit assets path.

## Process
- Branch per change, PR to `main`, user merges or asks for merge. Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No committed tests yet (user wants lessons to settle first); verify changes with headless Chrome playthroughs before PRs.
- Read `docs/agent-notes.md` before testing or writing SQL/narration: the headless-Chrome recipe, SQLite-vs-Postgres differences, and other gotchas. Add to it when you hit something non-obvious.
- Roadmap: `docs/roadmap/data.js` is the source of truth (phases, item ids, status, notes, target course map). Update an item's `status`/`note` there when work lands. `docs/roadmap/index.html` renders it and re-reads it every 3 s (open straight from disk). The claude.ai artifact CKGa6m77J9HwZVPdnRzzyx is an older copy.

## Open work (handoff)
- Code health (roadmap phase `health`): refactor merged in PR #15; course map, keywords/flashcards and lesson 02 quizzes (all modes) re-verified by headless playthrough. How to add a lesson: `docs/adding-a-lesson.md`. Later: tests + CI (incl. an audio-in-sync check), ES modules + one folder per lesson, `?v=` stamping script.
- Phase 3 (Level 1 SQL): engine `p3-sqljs` in PR #19; first lesson `select` (`p3-select`) stacked on it. The Writing SQL module sits after Data modeling. Next: `p3-joins`, then GROUP BY, subqueries/CTEs, window functions, NULL traps. When a new SQL lesson follows `select`, update `select`'s `finish.2` "Next up" line and rebuild its audio.
- Welcome narration still describes 4 levels; the roadmap now has 5 (update `narration/welcome.json` story lines when Level 4 lessons exist).
