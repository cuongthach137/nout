# Data Systems Lab

An original, interactive course for building intuition about database internals. It is inspired by widely taught data-systems concepts—including themes explored in *Designing Data-Intensive Applications*—but uses original explanations, examples, and visual labs.

## Run locally

No build step or package install is required.

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Course structure

Each concept lesson starts with a small visual model and ends with a production-shaped debugging or architecture drill:

1. Normalization without jargon: update and deletion anomalies, split lists, keys, joins, and owned denormalization
2. Storage pages, buffer hits, and a scattered-order performance incident
3. Heap, secondary-index, and clustered physical layouts with observable page-read costs
4. B-tree traversal and a composite-index key-order regression
5. B-tree, hash, LSM, and inverted indexes under feature-shaped load tests
6. Sequential, plain index, bitmap heap, and index-only scans; covering and combined indexes
7. Production-safe index creation across million- to billion-row tables
8. Random UUIDv4 versus time-ordered UUIDv7 B-tree insert behavior
9. Bloom-filter membership checks and false positives
10. Column strips versus whole receipts, then an LSM memtable, sorted chunks, and compaction
11. An evidence-based index design challenge
12. Cost-based planning, selectivity, and stale-statistics diagnosis
13. Transaction boundaries, rollback, and partial-commit failures
14. Lost updates, row locking, unique constraints, and an oversold-seat race
15. MVCC snapshots, non-repeatable reads, and phantom reads
16. Repeatable Read write skew, Serializable detection, and whole-transaction retries
17. ACID consistency through `CHECK`, `UNIQUE`, `FOREIGN KEY`, and `EXCLUDE` constraints
18. Synchronous versus asynchronous commit, WAL flushes, crashes, and REDO recovery
19. An evidence-based ACID incident review
20. Leader/follower lag and read-your-writes routing policies
21. A checkout incident capstone covering latency, duplicate orders, and stale confirmations
22. MVCC tuple versions, HOT updates, and index write amplification
23. Standard `VACUUM`, long-running snapshots, reusable space, and `VACUUM FULL`
24. Nested-loop, hash, and merge joins under different workload shapes
25. Per-operation `work_mem`, temporary-file spills, and concurrency risk
26. Lock waits, deadlock cycles, consistent ordering, and transaction retries
27. Partition bounds, pruning, local indexes, planning overhead, and retention
28. PostgreSQL/SQLite partial indexes, cross-engine expression indexes, and MySQL alternatives
29. Specialized PostgreSQL, MySQL, and SQLite index families matched to query semantics
30. Engine-specific index evidence, canary removal, rollback, and integrity guardrails
31. A cross-engine migration capstone that surfaces hidden storage, locking, and DDL assumptions

Course progress is stored in the browser with `localStorage`.

## Narration audio

Narrated lessons use pre-rendered mp3s made with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx), a free local neural TTS (no API key). Needs [uv](https://docs.astral.sh/uv/) and ffmpeg; models download once to `~/.cache/kokoro-onnx`.

```bash
uv run tools/voice.py say "Try a line."            # preview
uv run tools/voice.py voices                       # list voices
uv run tools/voice.py build narration/pages.json   # render changed lines to audio/pages/
```

## Architecture

The course is intentionally framework-free and requires no backend. It uses ordered, namespaced browser scripts so it also works in simple static hosting environments:

- `js/core.js` owns course metadata, shared state, timing, headers, and footers.
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
