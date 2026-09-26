# Data Systems Lab

An original, interactive course for building intuition about database internals. It is inspired by widely taught data-systems concepts—including themes explored in *Designing Data-Intensive Applications*—but uses original explanations, examples, and visual labs.

## Run locally

No build step or package install is required.

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Course structure

Lessons are grouped into modules. A lesson's number is its position in `js/core.js`, so this list follows that order:

**Data modeling**
1. Normalization without jargon: update and deletion anomalies, split lists, keys, joins, and owned denormalization

**Storage**
2. Storage pages, buffer hits, and a scattered-order performance incident
3. B-tree traversal and a composite-index key-order regression
4. Heap, secondary-index, and clustered physical layouts with observable page-read costs
5. Random UUIDv4 versus time-ordered UUIDv7 B-tree insert behavior

**Indexes**
6. B-tree, hash, LSM, and inverted indexes under feature-shaped load tests
7. Sequential, plain index, bitmap heap, and index-only scans; covering and combined indexes
8. Production-safe index creation across million- to billion-row tables
9. Bloom-filter membership checks and false positives
10. An evidence-based index design challenge

**Query execution**
11. Cost-based planning, selectivity, and stale-statistics diagnosis
12. Nested-loop, hash, and merge joins under different workload shapes
13. Per-operation `work_mem`, temporary-file spills, and concurrency risk

**Transactions**
14. Transaction boundaries, rollback, and partial-commit failures
15. Lost updates, row locking, unique constraints, and an oversold-seat race
16. Lock waits, deadlock cycles, consistent ordering, and transaction retries
17. MVCC snapshots, non-repeatable reads, and phantom reads
18. MVCC tuple versions, HOT updates, and index write amplification
19. Standard `VACUUM`, long-running snapshots, reusable space, and `VACUUM FULL`
20. Repeatable Read write skew, Serializable detection, and whole-transaction retries
21. ACID consistency through `CHECK`, `UNIQUE`, `FOREIGN KEY`, and `EXCLUDE` constraints
22. Synchronous versus asynchronous commit, WAL flushes, crashes, and REDO recovery
23. An evidence-based ACID incident review

**Engines for scale**
24. Column strips versus whole receipts, then an LSM memtable, sorted chunks, and compaction
25. Partition bounds, pruning, local indexes, planning overhead, and retention

**Distributed data**
26. Leader/follower lag and read-your-writes routing policies
27. A checkout incident capstone covering latency, duplicate orders, and stale confirmations

**Electives: engine depth**
28. PostgreSQL/SQLite partial indexes, cross-engine expression indexes, and MySQL alternatives
29. Specialized PostgreSQL, MySQL, and SQLite index families matched to query semantics
30. Engine-specific index evidence, canary removal, rollback, and integrity guardrails
31. A cross-engine migration capstone that surfaces hidden storage, locking, and DDL assumptions

Course progress is stored in the browser with `localStorage`.

## Narration audio

Lessons can offer three modes: Narrated (the default once a lesson's narration is complete), Guided, and Explore. The learner's pick from the mode switch is remembered; `#/<lesson>?mode=explore` changes that pick, while `#/<lesson>?view=explore` shows a mode for one visit only.

Narrated mode (`js/components/narrator.js`) plays a lesson like a short film and stops for taps and response choices. A lesson's chapters live in `js/lessons/<lesson>-narrated.js`; its lines live in `narration/<lesson>.json`, where each line is a caption string or `{ "caption", "voice" }`. `build` also regenerates `narration/<lesson>.js`, the copy the page actually loads (plain script, so it works from `file://` too). Rebuild after editing lines.

Narrated lessons use pre-rendered mp3s made with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx), a free local neural TTS (no API key). Needs [uv](https://docs.astral.sh/uv/) and ffmpeg; models download once to `~/.cache/kokoro-onnx`.

```bash
uv run tools/voice.py say "Try a line."            # preview
uv run tools/voice.py voices                       # list voices
uv run tools/voice.py lint narration/pages.json    # check a script against narration/STYLE.md
uv run tools/voice.py build narration/pages.json   # render changed lines to audio/pages/
uv run tools/voice.py deploy                       # publish audio/ to Cloudflare
```

Narrated lessons highlight **keywords** as the narrator says them (`<k>term</k>` in a caption, defined under `"keywords"` in the script). Learners collect them in the lesson's Keywords panel, review them in a "Words to keep" chapter, and star the ones to practise. Starred words become **flashcards** (`#/flashcards`, `js/components/vocab.js`), reviewed with spaced repetition and saved in the browser. Each lesson stays within a budget of 8 to 12 minutes, 3 big ideas and 8 keywords; see `narration/STYLE.md`.

Audio is not committed. `deploy` uploads only the `audio/` folder as an assets-only Cloudflare Worker (`nout-audio`, free static hosting) using wrangler; run `npx wrangler login` once. The site reads audio from the address in `index.html`'s `<meta name="audio-base">`, and from the local `audio/` folder when served from `localhost`. Lines stream one at a time, and the narrator prefetches the next two while one plays. Voice is encoded as 40 kbps mono mp3. How lines should read, sound and pace is in [`narration/STYLE.md`](narration/STYLE.md); `narration/lexicon.json` holds spoken spellings for database terms, and a line can name a speaker, like the interviewer, for a second voice.

## SQL exercises

SQL lessons run real queries in the browser: SQLite compiled to WebAssembly ([sql.js](https://github.com/sql-js/sql.js), vendored under `vendor/sql.js`) inside a Web Worker. `js/components/sql.js` gives each exercise a fresh copy of its dataset, stops a runaway query after 3 seconds, and checks a learner's result against the rows the reference query returns (column names ignored; row order only when the exercise asks for it). The shared dataset is Maya's bakery: `customers`, `products`, `orders` and `order_items`, with deliberate NULLs, customers without orders and walk-in orders. `#/sql` is a free sandbox on the same data. The engine needs the site served over HTTP (`python3 -m http.server`), not opened from `file://`.

## Architecture

The course is intentionally framework-free and requires no backend. It uses ordered, namespaced browser scripts so it also works in simple static hosting environments:

- `js/core.js` owns course metadata, shared state, timing, headers, and footers. A lesson's number is its position in the `lessons` list, so reordering that list renumbers the course. Lesson text refers to other lessons by id, never by number: `DSL.lessonRef("index-layout")` renders "Lesson 03", and `DSL.labLabel("access-paths", "A")` renders "Lab 06A".
- `js/components/quiz.js` provides the reusable accessible quiz renderer and state handling.
- `js/components/engine-lens.js` provides a reusable four-level PostgreSQL/MySQL/SQLite comparison surface with step traces and prediction feedback.
- `js/lessons/*.js` contains one concept area per file and registers its renderer with the core.
- `app.js` owns navigation, routing, progress persistence, and shell-level events.
- `styles.css` contains the shared responsive visual system; focused stylesheets own the operations, engine-lens, cross-engine-index, and modeling visual vocabularies.

To add a lesson, define its metadata in `js/core.js`, register one renderer from `js/lessons/`, and let the shell discover it. Simulation state remains local to each lesson setup function, which keeps timers and DOM bindings from leaking across routes.

## Quick verification

Check every JavaScript file for syntax errors:

```bash
find . -name '*.js' -print0 | xargs -0 -n1 node --check
```

Then run the local server and exercise each route from the sidebar. The shell switches to mobile navigation below 900 px, while dense visual labs progressively stack at 760 px and 680 px.
