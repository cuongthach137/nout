# Data Systems Lab roadmap (offline snapshot)

Snapshot of the live roadmap artifact taken 2026-09-26: https://claude.ai/artifact/CKGa6m77J9HwZVPdnRzzyx
The live page is the source of truth. Item status lives in its `status` db collection, keyed by item id; this file can go stale.

**Progress: 17 of 58 items done.** Phases 0–2 are complete. **Phase 3 is next.**

## Principles
- **Three modes.** Narrated is the course: voiced, interactive, and the default once a lesson's narration is `complete`. Guided is silent and self-paced, with more written detail, and gets regenerated after narration. Explore holds free-form labs, cheat sheets and drill answers.
- **One story: the bakery grows up.** Each level is a stage of Maya's bakery, so each concept arrives as the business's next problem. Topics come from DDIA (*Designing Data-Intensive Applications*) and DI (*Database Internals*); the explanations are the course's own.
- **Lesson budget:** 8–12 minutes, 3 big ideas and 8 keywords (see `narration/STYLE.md`).
- **Tiers:** new lessons are tiered by interview value (T1 > T2 > T3). T1 gets built first.

## Levels
| Level | Stage | Theme | Topics |
|---|---|---|---|
| 1 | the notebook | Foundations | SQL, data models, measuring systems |
| 2 | one server | Inside one database | Storage engines, indexes, queries, transactions |
| 3 | a chain | Distributed data | Replication, sharding, failures, consensus |
| 4 | the platform | Data systems | Caching, CDC, streams, batch; ends in the checkout incident |
| 5 | electives | Engine depth | Cross-engine indexing, B-tree variants, latches |

## Build order
Status values: planned, progress, done, blocked. "new" means a lesson that doesn't exist yet.

### Shipped so far (5/5)
| Id | Item | Status | Note |
|---|---|---|---|
| s-l01 | Lesson 01 as interactive labs | done | PR #1 |
| s-l02 | Lesson 02 rebuilt, with the shared lab kit | done | PR #2 |
| s-guided | Guided mode for lessons 01 and 02 | done | PRs #3, #4 |
| s-narrated | Narrated mode and the Kokoro voice tool | done | PR #5 |
| s-vocab | Keywords and flashcards | done | PR #13; audio deployed |

### Phase 0: make narration production-ready (8/8)
| Id | Item | Status | Note |
|---|---|---|---|
| p0-default | Narrated becomes the default | done | PR #6. Lessons opt in with `registerNarrated(id, fn, { complete: true })` |
| p0-l02 | Finish lesson 02 narration (the template for later lessons) | done | PRs #6, #7 |
| p0-audio | Serve audio from Cloudflare | done | PR #7. Assets-only Worker `nout-audio.yourshirtisajoke.workers.dev` |
| p0-prefetch | Prefetch the next line | done | PR #7. Next two lines fetched while one plays |
| p0-bitrate | Encode voice at 40 kbps mono | done | PR #7. Lesson 02 audio 3.1 MB → 2.0 MB |
| p0-numbers | Generate lesson and lab numbers | done | PR #8. Numbers come from order in `core.js` |
| p0-style | Narration style guide and pronunciation list | done | PR #9. `STYLE.md`, `lexicon.json`, `voice.py lint` |
| p0-interviewer | A second voice for the interviewer | done | PR #9. Kokoro `bm_george` |

### Phase 1: a narrated front door (2/2)
| Id | Item | Status | Note |
|---|---|---|---|
| p1-map | Narrate the course map | done | PR #11. 4 chapters, 28 lines, ~3 min |
| p1-l01 | Narrate lesson 01 | done | PR #10. 12 chapters, 83 lines, ~10 min |

### Phase 2: reorder the course (2/2)
| Id | Item | Status | Note |
|---|---|---|---|
| p2-reorder | Move existing lessons into modules | done | PR #12 |
| p2-links | Update the course map, README and cross-links | done | PR #12 |

### Phase 3: Level 1 foundations (0/10), next
| Id | Item | Tier | Detail |
|---|---|---|---|
| p3-sqljs | In-browser SQL engine (new) | | sql.js, plus a checker that compares the learner's result to the expected rows |
| p3-select | SELECT, filtering and sorting (new) | T1 | |
| p3-joins | Join types (new) | T1 | Inner, left, right and full joins, and what each one drops |
| p3-group | GROUP BY and HAVING (new) | T1 | |
| p3-sub | Subqueries and CTEs (new) | T1 | |
| p3-window | Window functions (new) | T1 | Ranking, running totals, top-N per group |
| p3-null | NULL traps (new) | T1 | Three-valued logic, COUNT(*) vs COUNT(col), NOT IN |
| p3-rel | Relationships and keys (new) | T1 | One-to-many, many-to-many, junction tables, foreign keys |
| p3-models | Relational, document and graph models (new) | T1 | DDIA ch. 2 |
| p3-latency | Latency, throughput and percentiles (new) | T1 | DDIA ch. 1. p50 vs p99, tail latency |

### Phase 4: Level 2, inside one database (0/6)
| Id | Item | Tier | Detail |
|---|---|---|---|
| p4-storage | Narrate Storage | | Pages, B-tree walk, layout, page splits. DI ch. 1–4 |
| p4-lsm | LSM trees in depth (new) | T1 | DDIA ch. 3, DI ch. 7. Compaction strategies, amplification. Split from `columnar-lsm` |
| p4-olap | OLTP vs OLAP and column stores (new) | T2 | DDIA ch. 3. The other half of `columnar-lsm` |
| p4-indexes | Narrate Indexes | | |
| p4-exec | Narrate Query execution | | |
| p4-tx | Narrate Transactions and recovery | | DDIA ch. 7, DI ch. 5 |

### Phase 5: Level 3, distributed data (0/10)
| Id | Item | Tier | Detail |
|---|---|---|---|
| p5-multileader | Multi-leader replication and conflicts (new) | T2 | LWW, CRDTs |
| p5-quorum | Leaderless replication and quorums (new) | T1 | w + r > n, read repair, hinted handoff, Merkle trees |
| p5-shard | Sharding and consistent hashing (new) | T1 | |
| p5-rebalance | Partitioned indexes and rebalancing (new) | T2 | |
| p5-faults | Faults and failure detection (new) | T1 | |
| p5-clocks | Clocks and ordering (new) | T1 | Lamport and vector clocks |
| p5-fencing | Leases and fencing tokens (new) | T2 | |
| p5-cap | Consistency models and CAP (new) | T1 | Also covers PACELC |
| p5-consensus | Leader election and Raft (new) | T1 | |
| p5-dtx | 2PC, sagas and idempotency (new) | T1 | |

### Phase 5b: Level 4, data systems (0/5)
| Id | Item | Tier | Detail |
|---|---|---|---|
| p5-cache | Caching (new) | T1 | Cache-aside, invalidation, stampedes |
| p5b-cdc | Logs, CDC and the outbox pattern (new) | T1 | DDIA ch. 11 |
| p5b-streams | Stream processing and exactly-once (new) | T2 | |
| p5b-batch | Batch processing (new) | T2 | DDIA ch. 10 |
| p5-capstone | Checkout incident capstone | | Narrate `incident` as the finale |

### Phase 6: interview layer (0/5)
| Id | Item | Detail |
|---|---|---|
| p6-drills | An interview drill at the end of each module | The interviewer asks, the learner picks a response, the tutor explains |
| p6-aloud | "Say it out loud" steps | The learner answers aloud against a countdown, then hears a model answer |
| p6-mock | Final mock interview | A SQL round, rapid-fire concepts, a system-design walkthrough |
| p6-cheat | A cheat sheet per module | |
| p6-reading | "Read more" on every lesson | Chapter pointers into DDIA and DI |

### Later (0/5)
| Id | Item | Tier |
|---|---|---|
| l-guided | Regenerate Guided mode per lesson | |
| l-electives | Narrate the electives | |
| l-btree-variants | B-tree variants (new) | T3 |
| l-latches | Latches and B-link trees (new) | T3 |
| l-schema | Encoding and schema evolution (new) | T2 |

## Target course map
Existing lessons are listed by id (see `js/core.js`). Mode columns: N = Narrated, G = Guided, E = Explore. Lessons marked new don't exist yet.

| Level | Module | Lessons |
|---|---|---|
| Start | Course map | `welcome` (N, E) |
| 1 | SQL you'll be asked to write | new: SELECT and filtering, Join types, GROUP BY and HAVING, Subqueries and CTEs, Window functions, NULL traps |
| 1 | Data models | `modeling` (N, G, E); new: Relationships and keys, Relational/document/graph |
| 1 | Measuring systems | new: Latency, throughput and percentiles |
| 2 | Storage | `pages` (N, G, E), `btree`, `index-layout`, `btree-writes` (E) |
| 2 | Storage engines | new: LSM trees in depth, OLTP vs OLAP and column stores |
| 2 | Indexes | `index-types`, `access-paths`, `index-operations`, `bloom`, `index-quiz` (E) |
| 2 | Query execution | `planner`, `join-algorithms`, `memory-spills` (E) |
| 2 | Transactions and recovery | `acid-foundations`, `transactions`, `deadlocks`, `mvcc-snapshots`, `tuple-versions`, `vacuum`, `serializability`, `consistency`, `durability`, `acid-quiz` (E) |
| 3 | Replication | `replication` (E); new: Multi-leader and conflicts, Leaderless quorums |
| 3 | Partitioning | `partitioning` (E); new: Sharding and consistent hashing, Partitioned indexes and rebalancing |
| 3 | When things fail | new: Faults and failure detection, Clocks and ordering, Leases and fencing tokens |
| 3 | Consistency and consensus | new: Consistency models and CAP, Leader election and Raft, 2PC/sagas/idempotency |
| 4 | Data systems | `columnar-lsm` (E); new: Caching, Logs/CDC/outbox, Stream processing, Batch processing; `incident` (E) |
| 5 | Electives: engine depth | `predicate-indexes`, `specialized-indexes`, `index-observability`, `migration-capstone` (E); new: B-tree variants, Latches and B-link trees, Encoding and schema evolution |

## Known gaps in the live page (as of this snapshot)
- The "Audio hosting" section still recommends a Cloudflare Pages project. What shipped is an assets-only Worker (`nout-audio`).
- There's no item for the `codebase-health` work or its follow-ups (`docs/adding-a-lesson.md`, tests + CI, ES modules, `?v=` stamping).
- `narration/welcome.json` still describes 4 levels; the roadmap has 5.
