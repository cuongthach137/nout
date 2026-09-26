(function registerIndexObservabilityLesson(DSL) {
  "use strict";

  const INDEXES = {
    customer: { name: "idx_orders_customer_created", size: 4.2, scans: 1842091, writes: 100, constraint: false, duplicate: false, seasonal: false, purpose: "customer history endpoint" },
    coupon: { name: "idx_orders_coupon", size: 1.1, scans: 0, writes: 100, constraint: false, duplicate: false, seasonal: true, purpose: "Black Friday campaign" },
    status: { name: "idx_orders_status", size: 2.4, scans: 82, writes: 100, constraint: false, duplicate: true, seasonal: false, purpose: "prefix duplicated by (status, created_at)" },
    idempotency: { name: "orders_idempotency_key", size: 3.0, scans: 0, writes: 100, constraint: true, duplicate: false, seasonal: false, purpose: "UNIQUE checkout invariant" },
  };

  const QUESTIONS = [
    { prompt: "An index has zero scans since a restart two hours ago. What can you conclude?", options: ["Safe to drop", "The evidence window is insufficient", "It enforces no constraints"], answer: 1, why: "Counters need a representative window that includes rare, seasonal, failover, and maintenance workloads." },
    { prompt: "Which MySQL feature creates a reversible optimizer canary while maintenance continues?", options: ["Invisible index", "DROP INDEX", "DISABLE WAL"], answer: 0, why: "An invisible index is ignored by the optimizer but remains maintained, so it can quickly be made visible again." },
    { prompt: "A zero-scan unique index backs idempotency. Why keep it?", options: ["It makes every read faster", "Its main job is integrity, not lookup telemetry", "Unique indexes have no write cost"], answer: 1, why: "Usage counters do not measure rejected duplicates or the value of the invariant." },
  ];

  function evaluateIndex(index, windowId) {
    if (index.constraint) return { risk: "blocked", reason: "This index enforces a UNIQUE invariant; scan counters do not measure rejected bad writes.", confidence: 100 };
    if (windowId === "day") return { risk: "unknown", reason: "One day misses seasonal, monthly, failover, and maintenance paths.", confidence: 28 };
    if (index.seasonal && windowId !== "seasonal") return { risk: "unknown", reason: "The campaign index is intentionally dormant outside its seasonal workload.", confidence: 46 };
    if (index.scans === 0) return { risk: "candidate", reason: "No representative workload selected it, and it does not back a constraint. Proceed through a reversible canary.", confidence: 86 };
    if (index.duplicate && index.scans < 1000) return { risk: "candidate", reason: "Low use plus a covering prefix suggests redundancy, but compare plans before removal.", confidence: 78 };
    return { risk: "keep", reason: "Representative reads depend on this access path; optimize its width before considering removal.", confidence: 94 };
  }

  function engineProcedure(engine, action, index) {
    const procedures = {
      postgres: {
        observe: "Query pg_stat_user_indexes, size, dependencies, and normalized workload plans.",
        canary: "No core invisible-index switch: rehearse on a production-like replica or controlled clone, then compare plans and latency.",
        drop: `DROP INDEX CONCURRENTLY ${index.name};\n-- cannot be used for constraint-backed index`,
      },
      mysql: {
        observe: "Use sys.schema_unused_indexes, Performance Schema, SHOW INDEX, and a representative uptime window.",
        canary: `ALTER TABLE orders ALTER INDEX ${index.name} INVISIBLE;\n-- monitor slow log, digests, and EXPLAIN`,
        drop: `DROP INDEX ${index.name} ON orders;\n-- restore by rebuilding if rollback is needed`,
      },
      sqlite: {
        observe: "Capture application query telemetry and run an EXPLAIN QUERY PLAN corpus; SQLite exposes no core per-index scan counter.",
        canary: "Remove the index only in a copied database, replay the workload, and compare SCAN/SEARCH plans plus latency.",
        drop: `DROP INDEX ${index.name};\n-- schema write transaction; rollback requires CREATE INDEX`,
      },
    };
    return procedures[engine][action];
  }

  function renderIndexObservability() {
    const lesson = DSL.getLesson("index-observability");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "An unused index is a <em>hypothesis</em>, not a fact.", "Every index consumes storage, cache, write I/O, WAL or redo, and maintenance time. Removing one safely requires a representative evidence window, dependency checks, a reversible experiment, and an explicit rollback plan.", "Advanced")}
      <div class="engine-levels standalone-levels"><span>1 · cost model</span><span>2 · engine evidence</span><span>3 · canary removal</span><span>4 · go/no-go</span></div>

      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Levels 1–2 · ${DSL.labLabel("index-observability")}</span><h2>Audit an index portfolio</h2><p class="lab-copy">The index statistics are fictional but production-shaped. Select a candidate, widen the observation window, and choose an experiment. The lab refuses to equate zero scans with zero value.</p></div><span class="lab-badge">evidence before deletion</span></div>
        <div class="index-portfolio" id="index-portfolio"></div>
        <div class="controls"><div class="control"><label for="observe-engine">Engine</label><select id="observe-engine"><option value="postgres">PostgreSQL 18</option><option value="mysql">MySQL 8.4 · InnoDB</option><option value="sqlite">SQLite 3.x</option></select></div><div class="control grow"><label for="observe-index">Candidate</label><select id="observe-index"><option value="customer">idx_orders_customer_created</option><option value="coupon">idx_orders_coupon</option><option value="status">idx_orders_status</option><option value="idempotency">orders_idempotency_key · UNIQUE</option></select></div><div class="control"><label for="observe-window">Evidence window</label><select id="observe-window"><option value="day">24 hours</option><option value="month">30 representative days</option><option value="seasonal">Full seasonal cycle</option></select></div><div class="control"><label for="observe-action">Next step</label><select id="observe-action"><option value="observe">Observe only</option><option value="canary">Reversible canary</option><option value="drop">Drop now</option></select></div></div>
        <div class="removal-path"><div><small>inventory</small><strong>size + writes + dependency</strong></div><span>→</span><div><small>evidence</small><strong>plans + workload window</strong></div><span>→</span><div><small>canary</small><strong>hide / clone / replica</strong></div><span>→</span><div><small>change</small><strong>rollback ready</strong></div></div>
        <div class="metric-grid compact"><div class="metric"><span>Modeled write savings</span><strong id="observe-savings">—</strong><small>if maintenance stops</small></div><div class="metric"><span>Evidence confidence</span><strong id="observe-confidence">—</strong><small>not a probability</small></div><div class="metric"><span>Rollback cost</span><strong id="observe-rollback">—</strong><small>rebuild time estimate</small></div></div>
        <pre class="query-box"><code id="observe-procedure"></code></pre>
        <div class="diagnosis" id="observe-diagnosis"><span class="diagnosis-label">Decision</span><p>—</p></div>
      </section>

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Level 3 · Production evidence</span><strong>“Unused” coupon index caused a sale-day regression</strong><span class="severity">observation bias</span></div>
        <div class="observability-evidence"><pre class="evidence"><code id="observe-engine-evidence"></code></pre><div><h3 id="observe-incident-title">—</h3><p class="lab-copy" id="observe-incident-copy">—</p><div class="engine-doc-links"><a href="https://www.postgresql.org/docs/18/monitoring-stats.html" target="_blank" rel="noreferrer">PostgreSQL statistics ↗</a><a href="https://dev.mysql.com/doc/refman/8.4/en/invisible-indexes.html" target="_blank" rel="noreferrer">MySQL invisible indexes ↗</a><a href="https://www.sqlite.org/eqp.html" target="_blank" rel="noreferrer">SQLite query plans ↗</a></div></div></div>
      </section>

      <section class="lab"><div class="lab-top"><div><span class="lab-kicker">Level 4 · Go/no-go check</span><h2>Protect rare reads and invisible invariants</h2><p class="lab-copy">Removal is safe only when the evidence represents the workload and the index is not carrying a constraint or operational escape path.</p></div><button class="button" type="button" data-quiz-reset>Reset</button></div><div id="observability-quiz">${DSL.Quiz.render(QUESTIONS, "Index removal review")}</div></section>
      <div class="insight"><span class="insight-mark">!</span><p><strong>Deletion is the last step, not the experiment.</strong> Preserve the definition, estimated rebuild time, dependency audit, before/after plans, latency guardrail, and a named rollback owner.</p></div>
      ${DSL.lessonFooter("index-observability")}
    </article>`;
    setupObservabilityLab();
    DSL.Quiz.mount(document.getElementById("observability-quiz"), QUESTIONS, { noun: "decision", successTitle: "Removal runbook ready" });
  }

  function setupObservabilityLab() {
    function renderPortfolio(selected) {
      document.getElementById("index-portfolio").innerHTML = Object.entries(INDEXES).map(([id, index]) => `<button type="button" class="portfolio-index ${id === selected ? "active" : ""}" data-portfolio-index="${id}"><span>${index.name}</span><strong>${index.size.toFixed(1)} GiB</strong><small>${index.scans.toLocaleString()} scans · ${index.writes}% writes${index.constraint ? " · UNIQUE" : ""}</small></button>`).join("");
    }

    function update() {
      const engine = document.getElementById("observe-engine").value;
      const indexId = document.getElementById("observe-index").value;
      const windowId = document.getElementById("observe-window").value;
      const action = document.getElementById("observe-action").value;
      const index = INDEXES[indexId];
      const evaluation = evaluateIndex(index, windowId);
      renderPortfolio(indexId);

      const savings = evaluation.risk === "candidate" && action === "drop" ? `${Math.round(index.size * 18)} MiB/min` : "0 · not changed";
      const rebuildMinutes = Math.max(4, Math.round(index.size * 11));
      document.getElementById("observe-savings").textContent = savings;
      document.getElementById("observe-confidence").textContent = `${evaluation.confidence} / 100`;
      document.getElementById("observe-rollback").textContent = `~${rebuildMinutes} min`;
      document.getElementById("observe-procedure").textContent = engineProcedure(engine, action, index);
      const diagnosis = document.getElementById("observe-diagnosis");
      const safeChoice = (evaluation.risk === "candidate" && action === "canary")
        || (evaluation.risk === "keep" && action !== "drop");
      const actionGuidance = action === "drop"
        ? evaluation.risk === "candidate" ? "Do not execute this drop yet; run the reversible canary first." : "Do not execute this drop."
        : action === "canary"
          ? "The selected engine procedure keeps the learning step reversible."
          : "Keep collecting plan and latency evidence.";
      diagnosis.className = `diagnosis ${safeChoice ? "resolved" : "warning"}`;
      diagnosis.innerHTML = `<span class="diagnosis-label">${evaluation.risk.toUpperCase()}</span><p>${evaluation.reason} ${actionGuidance}</p>`;

      const evidence = engine === "postgres"
        ? `pg_stat_user_indexes\nidx_scan: ${index.scans.toLocaleString()}\npg_relation_size: ${index.size.toFixed(1)} GiB\nstats_reset: 2026-09-01`
        : engine === "mysql" ? `sys.schema_unused_indexes\nindex_name: ${index.scans ? "(not listed)" : index.name}\nSHOW INDEX Visible: YES\nserver uptime: 30 days`
          : `EXPLAIN QUERY PLAN corpus\nqueries replayed: 18,420\nplans naming index: ${index.scans ? 42 : 0}\ncore usage counter: unavailable`;
      document.getElementById("observe-engine-evidence").textContent = evidence;
      document.getElementById("observe-incident-title").textContent = index.purpose;
      document.getElementById("observe-incident-copy").textContent = index.constraint
        ? "This index's success is often invisible: duplicate writes are rejected before becoming rows. Query-plan telemetry cannot price that integrity guarantee."
        : index.seasonal ? "A normal-month sample misses the only week this index exists to serve. Observation windows must include the business calendar, not only database uptime."
          : index.duplicate ? "A low-use prefix can be redundant, but validate that ordering, covering columns, and every query predicate are served by the wider index."
            : "High scan counts show a live read path. Removing it would trade continuous write savings for immediate read amplification.";
    }

    document.getElementById("index-portfolio").addEventListener("click", (event) => {
      const button = event.target.closest("[data-portfolio-index]");
      if (!button) return;
      document.getElementById("observe-index").value = button.dataset.portfolioIndex;
      update();
    });
    ["observe-engine", "observe-index", "observe-window", "observe-action"].forEach((id) => document.getElementById(id).addEventListener("change", update));
    update();
  }

  DSL.registerRenderer("index-observability", renderIndexObservability);
})(window.DataSystemsLab);
