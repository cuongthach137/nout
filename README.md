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

1. Storage pages, buffer hits, and a scattered-order performance incident
2. Heap, secondary-index, and clustered physical layouts with observable page-read costs
3. B-tree traversal and a composite-index key-order regression
4. B-tree, hash, LSM, and inverted indexes under feature-shaped load tests
5. Sequential, plain index, bitmap heap, and index-only scans; covering and combined indexes
6. Production-safe index creation across million- to billion-row tables
7. Random UUIDv4 versus time-ordered UUIDv7 B-tree insert behavior
8. Bloom-filter membership checks and false positives
9. An evidence-based index design challenge
10. Cost-based planning, selectivity, and stale-statistics diagnosis
11. Transaction boundaries, rollback, and partial-commit failures
12. Lost updates, row locking, unique constraints, and an oversold-seat race
13. MVCC snapshots, non-repeatable reads, and phantom reads
14. Repeatable Read write skew, Serializable detection, and whole-transaction retries
15. ACID consistency through `CHECK`, `UNIQUE`, `FOREIGN KEY`, and `EXCLUDE` constraints
16. Synchronous versus asynchronous commit, WAL flushes, crashes, and REDO recovery
17. An evidence-based ACID incident review
18. Leader/follower lag and read-your-writes routing policies
19. A checkout incident capstone covering latency, duplicate orders, and stale confirmations
20. MVCC tuple versions, HOT updates, and index write amplification
21. Standard `VACUUM`, long-running snapshots, reusable space, and `VACUUM FULL`
22. Nested-loop, hash, and merge joins under different workload shapes
23. Per-operation `work_mem`, temporary-file spills, and concurrency risk
24. Lock waits, deadlock cycles, consistent ordering, and transaction retries
25. Partition bounds, pruning, local indexes, planning overhead, and retention
26. PostgreSQL/SQLite partial indexes, cross-engine expression indexes, and MySQL alternatives
27. Specialized PostgreSQL, MySQL, and SQLite index families matched to query semantics
28. Engine-specific index evidence, canary removal, rollback, and integrity guardrails
29. A cross-engine migration capstone that surfaces hidden storage, locking, and DDL assumptions

Course progress is stored in the browser with `localStorage`.

## Architecture

The course is intentionally framework-free and requires no backend. It uses ordered, namespaced browser scripts so it also works in simple static hosting environments:

- `js/core.js` owns course metadata, shared state, timing, headers, and footers.
- `js/components/quiz.js` provides the reusable accessible quiz renderer and state handling.
- `js/components/engine-lens.js` provides a reusable four-level PostgreSQL/MySQL/SQLite comparison surface with step traces and prediction feedback.
- `js/lessons/*.js` contains one concept area per file and registers its renderer with the core.
- `app.js` owns navigation, routing, progress persistence, and shell-level events.
- `styles.css` contains the shared responsive visual system; focused stylesheets own the operations, engine-lens, and cross-engine-index visual vocabularies.

To add a lesson, define its metadata in `js/core.js`, register one renderer from `js/lessons/`, and let the shell discover it. Simulation state remains local to each lesson setup function, which keeps timers and DOM bindings from leaking across routes.

## Quick verification

Check every JavaScript file for syntax errors:

```bash
find . -name '*.js' -print0 | xargs -0 -n1 node --check
```

Then run the local server and exercise each route from the sidebar. The shell switches to mobile navigation below 900 px, while dense visual labs progressively stack at 760 px and 680 px.
