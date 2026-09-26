(function registerWelcomeLesson(DSL) {
  "use strict";

  // One card per module, in course order. Numbers and links come from the lesson list, so a
  // reorder in core.js updates the map; only the words below are written by hand.
  const MODULE_CARDS = {
    "Data modeling": ["One fact, one place", "Split a messy order notebook until updates, deletions, and reads all behave."],
    "Writing SQL": ["Ask the tables", "Write the queries every SQL interview starts with, graded live in your browser: filter and sort, join tables without losing rows, count by group, and nest one question inside another."],
    Storage: ["Pages, B-trees, and layout", "See why a 12-row endpoint can trigger ten storage reads, then walk the structures underneath."],
    Indexes: ["Choose, scan, and build indexes", "Match index types to queries, read scan plans, build indexes safely, and skip work with Bloom filters."],
    "Query execution": ["How the planner decides", "Reproduce a bad plan from stale statistics, compare join algorithms, and contain memory spills."],
    Transactions: ["Failures, concurrency, and recovery", "Roll back partial work, break deadlocks, expose snapshot anomalies, reclaim old versions, and recover from WAL."],
    "Engines for scale": ["Store by question", "Columnar strips, LSM compaction, and partition pruning for large data."],
    "Distributed data": ["Replication, then a real incident", "Repair a read-after-write bug, then run a checkout incident end to end."],
    "Electives: engine depth": ["Indexes that survive a migration", "Compare predicates, expressions, specialized families, removal runbooks, and physical assumptions across PostgreSQL, InnoDB, and SQLite."],
  };

  const modules = () => DSL.modules(DSL.lessons.filter((lesson) => lesson.id !== "welcome"));

  function cardMarkup(group) {
    const first = group.lessons[0];
    const last = group.lessons[group.lessons.length - 1];
    const span = first === last ? first.number : `${first.number}–${last.number}`;
    const [title, blurb] = MODULE_CARDS[group.name] || [first.title, ""];
    return `<a href="#/${first.id}" class="path-card"><small>${span} · ${group.name}</small><span class="arrow">↗</span><h3>${title}</h3><p>${blurb}</p></a>`;
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

        <section class="path-grid" aria-label="Course modules">${modules().map(cardMarkup).join("")}</section>
        ${DSL.lessonFooter("welcome")}
      </article>`;
  }

  DSL.registerRenderer("welcome", renderWelcome);
})(window.DataSystemsLab);
