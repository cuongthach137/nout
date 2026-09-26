(function registerWelcomeLesson(DSL) {
  "use strict";

  // "03–10": the lesson numbers a course-map card covers, from the lessons' current order.
  function span(first, last) {
    const a = DSL.lessonNumber(first);
    const b = DSL.lessonNumber(last);
    return a === b ? a : `${a}–${b}`;
  }

  function renderWelcome() {
    DSL.elements.root.innerHTML = `
      <article class="lesson welcome-hero">
        <div class="hero-orbit" aria-hidden="true"><div class="orbit-ring"></div><div class="orbit-ring"></div><i class="orbit-node one"></i><i class="orbit-node two"></i><i class="orbit-node three"></i></div>
        <header class="lesson-header welcome-title">
          ${DSL.modeSwitch("welcome")}
          <div class="eyebrow">An interactive database course</div>
          <h1>Stop memorizing.<br><em>See the system.</em></h1>
          <p class="lede">Trace bytes from disk to memory. Walk an index one page at a time. Then diagnose slow endpoints, duplicate bookings, and stale reads—the kinds of bugs these mental models help you fix in production.</p>
          <div class="lesson-meta">
            <span class="meta-item"><span class="meta-icon">◷</span>About 7 hours</span>
            <span class="meta-item"><span class="meta-icon">◎</span>46 hands-on experiments</span>
            <span class="meta-item"><span class="meta-icon">⌁</span>No setup required</span>
          </div>
        </header>

        <div class="insight"><span class="insight-mark">//</span><p>The course uses simplified cost models. Real engines differ in detail, but the mental models transfer to PostgreSQL, MySQL, SQLite, key-value stores, and distributed databases.</p></div>

        <section class="path-grid" aria-label="Course modules">
          <a href="#/modeling" class="path-card"><small>${span("modeling", "modeling")} · Data modeling</small><span class="arrow">↗</span><h3>One fact, one place</h3><p>Split a messy order notebook until updates, deletions, and reads all behave.</p></a>
          <a href="#/pages" class="path-card"><small>${span("pages", "pages")} · Storage</small><span class="arrow">↗</span><h3>Pages, buffers, and locality</h3><p>See why a 12-row endpoint can trigger ten storage reads.</p></a>
          <a href="#/index-layout" class="path-card"><small>${span("index-layout", "columnar-lsm")} · Indexes</small><span class="arrow">↗</span><h3>From physical layout to production operations</h3><p>Compare scan paths, build safely, trigger page splits, and see how columnar and LSM stores move the cost.</p></a>
          <a href="#/planner" class="path-card"><small>${span("planner", "planner")} · Query execution</small><span class="arrow">↗</span><h3>Cost-based decisions</h3><p>Reproduce a bad plan caused by stale statistics.</p></a>
          <a href="#/acid-foundations" class="path-card"><small>${span("acid-foundations", "acid-quiz")} · ACID transactions</small><span class="arrow">↗</span><h3>Failures, concurrency, and recovery</h3><p>Roll back partial work, expose snapshot anomalies, protect invariants, and recover a committed write from WAL.</p></a>
          <a href="#/replication" class="path-card"><small>${span("replication", "replication")} · Distributed data</small><span class="arrow">↗</span><h3>Replication and stale reads</h3><p>Repair a read-after-write bug without pretending every copy is current.</p></a>
          <a href="#/incident" class="path-card"><small>${span("incident", "incident")} · Capstone</small><span class="arrow">↗</span><h3>Run a checkout incident</h3><p>Use evidence to fix latency, duplicates, and missing confirmations.</p></a>
          <a href="#/tuple-versions" class="path-card"><small>${span("tuple-versions", "partitioning")} · Performance under load</small><span class="arrow">↗</span><h3>Follow the work the database must do</h3><p>Trace row versions, reclaim bloat, choose joins, contain spills, break deadlocks, and prune partitions.</p></a>
          <a href="#/predicate-indexes" class="path-card"><small>${span("predicate-indexes", "migration-capstone")} · Cross-engine indexing</small><span class="arrow">↗</span><h3>Design indexes that survive a migration</h3><p>Compare predicates, expressions, specialized families, removal runbooks, and physical assumptions across PostgreSQL, InnoDB, and SQLite.</p></a>
        </section>
        ${DSL.lessonFooter("welcome")}
      </article>`;
  }

  DSL.registerRenderer("welcome", renderWelcome);
})(window.DataSystemsLab);
