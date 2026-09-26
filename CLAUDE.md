# Data Systems Lab: working notes

Interactive database course for interview prep, basics to advanced. Static site, no build step: `python3 -m http.server 8000`. Deployed to GitHub Pages on merge to `main`.

## Structure
- `js/core.js`: lesson list (order = numbering), `DSL.store` (all saved data, `dsl-` keys; never touch localStorage elsewhere), `DSL.modules()`, mode registry (Narrated default when a lesson's narration is `complete`, then Guided, then Explore), `lessonRef`/`labLabel` (refer to lessons by id, never by number).
- `app.js`: router (`#/<id>`, `?mode=` saves a pick, `?view=` one visit), sidebar, Back up / Restore.
- `js/components/`: `lab-kit.js` (asides, progress checklist, `setStatus`, motion helpers), `guided.js` (step engine, storyboard, quiz/finish beats), `narrator.js` (narrated film engine, keywords panel, `story()`, `quizChapter()`, `throttled()`), `vocab.js` (keywords, flashcards, spaced repetition).
- Per lesson: `js/lessons/<name>.js` (Explore), `-guided.js`, `-narrated.js`, `narration/<lesson>.json` (script: lines, speakers, keywords), generated `narration/<lesson>.js`. Narrated lessons reuse scenes exposed by the guided file (`DSL.StorageScenes`, `DSL.ModelingScenes`).
- Script and style tags in `index.html` load in dependency order; bump `?v=` on changed files.

## Narration and audio
- Rules: `narration/STYLE.md` (lesson budget 8-12 min, 3 big ideas, 8 keywords; `<k>` keyword marks; tutor vs interviewer voices).
- `uv run tools/voice.py lint|build|deploy narration/<lesson>.json`. Build renders only changed lines (Kokoro, 40 kbps). Audio is NOT in git: `deploy` uploads `audio/` to the Cloudflare Worker `nout-audio` (`nout-audio.yourshirtisajoke.workers.dev`, set in `index.html` meta `audio-base`). Run deploy whenever a PR that changes narration merges. Never run `wrangler pages ...` (it auto-deploys the whole repo); `voice.py deploy` passes an explicit assets path.

## Process
- Branch per change, PR to `main`, user merges or asks for merge. Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No committed tests yet (user wants lessons to settle first); verify changes with headless Chrome playthroughs before PRs.
- Roadmap and item status: see the course-roadmap memory (claude.ai artifact with a `status` db collection).

## Open work (handoff)
- Branch `codebase-health` (this commit): `DSL.store` (+ Back up / Restore), `DSL.modules()`, shared `setStatus`, narrator `story`/`quizChapter`/`throttled`. Verified: all 32 lessons render identical text, old saved progress carries over, backup round-trips, lesson 01 narrated full run passes. Not re-run after refactor: course map, keywords/flashcards, lesson 02 quiz flows.
- Still to do from the code-health plan: `docs/adding-a-lesson.md`; later: tests + CI (incl. an audio-in-sync check), ES modules + one folder per lesson, `?v=` stamping script.
- Next roadmap phase: Phase 3, in-browser SQL (sql.js) and Tier 1 SQL lessons, narrated with keywords.
- Welcome narration still describes 4 levels; the roadmap now has 5 (update `narration/welcome.json` story lines when Level 4 lessons exist).
