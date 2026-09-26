# Agent notes: things learned the hard way

Findings from earlier sessions, so the next agent doesn't rediscover them. Add to this file when you trip over something non-obvious. CLAUDE.md has the project overview; `docs/adding-a-lesson.md` has the lesson recipe.

## Verifying with headless Chrome

There are no committed tests yet. The working setup:

- Install `puppeteer-core` in your scratchpad (not the repo) and point it at the installed Chrome: `executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
- Serve the repo with `python3 -m http.server 8765`. Start it detached (`(python3 -m http.server 8765 &)`); a plain background `&` inside a one-shot shell can exit with the shell. Stop it afterwards: `lsof -ti tcp:8765 | xargs kill`.
- Python's dev server sometimes drops a request under rapid reloads (`net::ERR_CONNECTION_RESET` on a script, roughly one run in three). That's the server, not the app: rerun before chasing it.
- The SQL engine (`vendor/sql.js`, a Web Worker plus WASM) needs HTTP. It doesn't work from `file://`.

Driving the app:

- **Fresh state:** clear `localStorage`, set what you need (all keys have the `dsl-` prefix), then load the page. Navigate to `about:blank` first and then to the target URL. A `page.reload()` loses `?view=`, because the router strips it with `history.replaceState` on the first load.
- **Force a mode for one visit:** `#/<lesson>?view=explore|guided|narrated`. `?mode=` changes the saved choice instead.
- **Narrated mode fast:** set `dsl-narrator` to `{"speed":1.5,"muted":true}`. Muted lines hold for their reading time, and clicking `.nr-cap` skips the current line. Loop "click the caption until the thing you're waiting for appears", but don't click while `.nr-choices` is showing. Click `.nr-go` to start. Chapter dots (`.gd-dots button`, `title` = chapter title) only work after the film has started.
- **Guided mode at a given step:** set `dsl-guided-<lesson>` to `{"index": N, "seen": N, "done": []}` before loading. Dots beyond `seen` are disabled, and Next stays disabled until the current beat is done.
- **Classes get added for animation:** `LabKit.retrigger(el, "gd-pop")` adds a class, and `burst` adds elements. Check with `classList.contains(...)`, never `className === ...`.
- **SQL labs run once on load** (the sandbox does, and so do labs with a starter query run by the page). Wait until `.sql-run` is enabled before typing and clicking Run; a click during a run is ignored.
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
- Changing the course order changes what comes "next". Each lesson's `finish.2` line names the next lesson's idea, so re-check it (and rebuild that line's audio) when a lesson is inserted before or after it.
- Known story inconsistency: `narration/modeling.json` says "Maya runs a busy bakery" and then treats Maya as a customer (STYLE.md calls her a regular customer). The SQL dataset has Maya as customer #1. Treat the bakery as Maya's favourite shop, not hers, when writing new lines, and fix lesson 01's opening when it's next revised.

## Repo and workflow

- The roadmap's source of truth is `docs/roadmap/data.js`. The claude.ai roadmap artifact is a stale copy, and only one of the user's accounts can open it.
- Stacked PRs: when a branch needs an unmerged one, open the PR with `--base <that-branch>`, and retarget it to `main` with `gh pr edit <n> --base main` once the base merges.
- `?v=` cache-busting stamps in `index.html` are bumped by hand for now (planned: `h-stamp`, stamping content hashes at deploy time).
