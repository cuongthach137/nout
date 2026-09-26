# Agent notes: things learned the hard way

Findings from earlier sessions, so the next agent doesn't rediscover them. Add to this file when you trip over something non-obvious. CLAUDE.md has the project overview; `docs/adding-a-lesson.md` has the lesson recipe.

## Verifying with headless Chrome

There are no committed tests yet. The working setup:

- Install `puppeteer-core` in your scratchpad (not the repo) and point it at the installed Chrome: `executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
- Serve the repo with a bigger connection queue. Plain `python3 -m http.server` accepts only 5 queued connections, and the page requests about 60 files at once, so it randomly resets some (`net::ERR_CONNECTION_RESET`, `ERR_SOCKET_NOT_CONNECTED`) and a script like `core.js` fails to load. Use:
  ```bash
  (python3 -c "
  import http.server, functools
  class S(http.server.ThreadingHTTPServer): request_queue_size = 256
  S(('', 8765), functools.partial(http.server.SimpleHTTPRequestHandler, directory='.')).serve_forever()
  " >/dev/null 2>&1 &)
  ```
  Start it detached like this; a plain background `&` in a one-shot shell can exit with the shell. Stop it with `lsof -ti tcp:8765 | xargs kill`.
- The SQL engine (`vendor/sql.js` loaded by our own worker, `js/components/sql-worker.js`, plus WASM) needs HTTP. Don't switch to sql.js's bundled worker or `db.exec`: they return no column names for a query that matches no rows, which breaks the checker's messages. It doesn't work from `file://`.

Driving the app:

- **Fresh state:** clear `localStorage`, set what you need (all keys have the `dsl-` prefix), then load the page. Navigate to `about:blank` first and then to the target URL. A `page.reload()` loses `?view=`, because the router strips it with `history.replaceState` on the first load.
- **Force a mode for one visit:** `#/<lesson>?view=explore|guided|narrated`. `?mode=` changes the saved choice instead.
- **Narrated mode fast:** set `dsl-narrator` to `{"speed":1.5,"muted":true}`. Muted lines hold for their reading time, and clicking `.nr-cap` skips the current line. Loop "click the caption until the thing you're waiting for appears", but don't click while `.nr-choices` is showing. Click `.nr-go` to start. Chapter dots (`.gd-dots button`, `title` = chapter title) only work after the film has started.
- **Guided mode at a given step:** set `dsl-guided-<lesson>` to `{"index": N, "seen": N, "done": []}` before loading. Dots beyond `seen` are disabled, and Next stays disabled until the current beat is done.
- **Guided beats reused by Narrated** report learner actions with `api.event(name, data)`; Guided's api has it as a no-op, Narrated's `n.mount(beat, { onEvent })` receives them.
- **Classes get added for animation:** `LabKit.retrigger(el, "gd-pop")` adds a class, and `burst` adds elements. Check with `classList.contains(...)`, never `className === ...`.
- **SQL labs run once on load** (the sandbox does, and so do labs with a starter query run by the page). Wait until `.sql-run` is enabled before typing and clicking Run; a click during a run is ignored.
- **Does every frame fit?** Guided and Narrated screens don't scroll, so a tall scene is clipped at the top as well as the bottom (it's centred). Walk every Guided step and storyboard frame at **1280×700** (a short laptop) and **390×800**, and compare the stage's box with the boxes of its visible parts (code, result container, lists, editor); measure containers, not rows inside a scrolling result. Tall SQL scenes rely on `.gd-scene`'s single `minmax(0, 1fr)` row (guided.css) so storyboard heights resolve and results scroll.
- **Phone width:** check `document.documentElement.scrollWidth <= innerWidth` at 390 px. Grids that hold wide tables need `grid-template-columns: minmax(0, 1fr)`, or the table widens the page. Take screenshots after the sidebar's slide animation has finished (about 300 ms).

## SQLite (the course's engine) vs. what interviews assume

Lessons teach portable SQL, but the checker runs SQLite. Things SQLite accepts that PostgreSQL and MySQL reject, which a lesson must not rely on:

- An alias from `SELECT` used in `WHERE` (`WHERE new_price > 5`). Postgres and MySQL error; the `logical-order` keyword in the SELECT lesson is about exactly this.
- A bare column in `SELECT` that isn't in `GROUP BY` (SQLite picks a row). Postgres errors. The GROUP BY lesson should say so.
- `NULL` sorts **first** in ascending order in SQLite and MySQL, and **last** in PostgreSQL. Avoid NULLs in an `ORDER BY` exercise unless that's the point.
- Floats: `3.2 * 1.1` is `3.5200000000000005`. The checker compares numbers to 6 decimal places, and tables show at most 4.

The checker (`DSL.Sql.compare`) ignores column names (aliases vary) but not column order. Rows are compared as a multiset unless the exercise sets `ordered: true`.

## Narration

- `uv run tools/voice.py build` needs the Kokoro models in `~/.cache/kokoro-onnx` and ffmpeg (both installed on this machine). The first build downloads about 340 MB.
- Audio is not in git. After a PR that changes narration merges, run `uv run tools/voice.py deploy`. Never run `wrangler pages ...`.
- Right after a deploy, new files can return 404 for a few seconds while the Worker version rolls out; re-check before assuming it failed. Check URLs with `curl`: Cloudflare answers Python's default `urllib` user agent with 403.
- Changing the course order changes what comes "next". Each lesson's `finish.2` line names the next lesson's idea, so re-check it (and rebuild that line's audio) when a lesson is inserted before or after it.
- Known story inconsistency: `narration/modeling.json` says "Maya runs a busy bakery" and then treats Maya as a customer (STYLE.md calls her a regular customer). The SQL dataset has Maya as customer #1. Treat the bakery as Maya's favourite shop, not hers, when writing new lines, and fix lesson 01's opening when it's next revised.

## SQL lesson building blocks

- `js/components/sql-scenes.js` (`DSL.SqlScenes`): `board()` (code + animated result grid running real queries), `flip()`, `predictBeat()`, `challengeBeat()`, `teach()`/`slice()` for storyboards, and `exercise()` (narrated exercise that reacts to each wrong-answer reason). Lesson files only add storyboards and their own widgets (e.g. the join board in `joins-guided.js`).
- Scenes that show a result must sort it (`ORDER BY`) so frames are deterministic; engines don't promise an order.
- PostgreSQL rejects `JOIN` without `ON`; show cross joins as `CROSS JOIN` or `FROM a, b`.

## Repo and workflow

- The roadmap's source of truth is `docs/roadmap/data.js`. The claude.ai roadmap artifact is a stale copy, and only one of the user's accounts can open it.
- Stacked PRs: when a branch needs an unmerged one, open the PR with `--base <that-branch>`, and retarget it to `main` with `gh pr edit <n> --base main` once the base merges.
- `?v=` cache-busting stamps in `index.html` are bumped by hand for now (planned: `h-stamp`, stamping content hashes at deploy time).
