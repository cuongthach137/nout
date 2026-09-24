(function registerMigrationCapstoneLesson(DSL) {
  "use strict";

  const MIGRATIONS = {
    postgresMysql: {
      source: "PostgreSQL 18",
      target: "MySQL 8.4 · InnoDB",
      story: "Move a multi-tenant checkout service. The source uses a text UUID primary key, a partial open-order index, Serializable retries, and concurrent index builds.",
      evidence: "SOURCE EVIDENCE\nIndex Scan using orders_open_tenant_idx\n  Index Cond: tenant_id = $1\n  Filter: status = 'open'\n\nTARGET REHEARSAL\ntype: ALL  key: NULL  rows: 48,000,000\nsecondary index bytes: +61%",
      dimensions: [
        { id: "layout", title: "Row locator", symptom: "Every InnoDB secondary leaf inherits the 36-byte text PK.", options: ["Keep CHAR(36) PK unchanged", "Adopt a compact stable PK; retain UUID as UNIQUE"], answer: 1, why: "InnoDB stores primary-key columns in every secondary index record, so primary-key width has portfolio-wide cost." },
        { id: "predicate", title: "Open-order access", symptom: "MySQL rejects PostgreSQL's CREATE INDEX ... WHERE predicate.", options: ["Remove WHERE and index tenant_id only", "Design and measure (status, tenant_id, created_at)"], answer: 1, why: "MySQL has no native partial-index predicate. A composite access path preserves the query shape, though not the smaller physical subset." },
        { id: "isolation", title: "Concurrency invariant", symptom: "The source relies on SSI serialization failures, while InnoDB uses locking reads and next-key locks.", options: ["Assume Repeatable Read is identical", "Rehearse interleavings, lock order, and whole retries"], answer: 1, why: "Isolation names do not imply identical mechanisms or anomaly behavior; migration tests must race the business invariant." },
        { id: "ddl", title: "Online rollout", symptom: "A default ALTER may choose stronger locking than the SLO allows.", options: ["Accept ALGORITHM/LOCK defaults", "Require ALGORITHM=INPLACE, LOCK=NONE and inspect MDL"], answer: 1, why: "Explicit LOCK=NONE turns concurrent DML into a checked requirement and metadata-lock inspection covers the publication boundary." },
      ],
      sources: [{ label: "InnoDB clustered indexes", url: "https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html" }, { label: "MySQL online DDL", url: "https://dev.mysql.com/doc/refman/8.4/en/innodb-online-ddl-limitations.html" }],
    },
    mysqlSqlite: {
      source: "MySQL 8.4 · InnoDB",
      target: "SQLite 3.x · WAL mode",
      story: "Move an offline field application to an embedded database. The source has FULLTEXT search, a connection pool of writers, monthly partitions, and a composite natural key.",
      evidence: "SOURCE EVIDENCE\nMATCH(notes) AGAINST('+pump +fault' IN BOOLEAN MODE)\npartitions: p2026_08,p2026_09\nactive writers: 24\n\nTARGET REHEARSAL\nSQLITE_BUSY after 5000 ms\nQUERY PLAN: SCAN work_orders",
      dimensions: [
        { id: "layout", title: "Composite identity", symptom: "An ordinary SQLite table would keep a rowid B-tree plus a separate composite PK index.", options: ["Ignore the duplicate structure", "Benchmark a WITHOUT ROWID table"], answer: 1, why: "WITHOUT ROWID can cluster the table by its composite primary key and remove duplicated key storage for suitable schemas." },
        { id: "search", title: "Document search", symptom: "MySQL MATCH ... AGAINST syntax and FULLTEXT metadata do not transfer.", options: ["Replace with LIKE '%term%'", "Create and synchronize an FTS5 virtual table"], answer: 1, why: "FTS5 provides SQLite's token-to-doclist search model; its virtual-table schema and content synchronization need explicit design." },
        { id: "writers", title: "Write topology", symptom: "Twenty-four server-style writers contend for SQLite's one WAL writer slot.", options: ["Keep all concurrent write transactions", "Serialize writes and keep transactions free of remote work"], answer: 1, why: "WAL permits readers with a writer but still serializes writers; application topology must reflect that scarce slot." },
        { id: "partition", title: "Retention routing", symptom: "SQLite has no native declarative monthly partition parent.", options: ["Port PARTITION BY unchanged", "Use one table or own explicit shard routing and lifecycle"], answer: 1, why: "Manual tables or files move pruning, migration, and cross-shard integrity responsibilities into the application." },
      ],
      sources: [{ label: "SQLite WITHOUT ROWID", url: "https://www.sqlite.org/withoutrowid.html" }, { label: "SQLite WAL", url: "https://www.sqlite.org/wal.html" }, { label: "SQLite FTS5", url: "https://www.sqlite.org/fts5.html" }],
    },
  };

  function renderMigrationCapstone() {
    const lesson = DSL.getLesson("migration-capstone");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "SQL syntax migrates faster than <em>physical assumptions.</em>", "A successful engine migration preserves invariants, workload shape, and operational safety—not merely rows and DDL. Review the target's row locator, index capabilities, concurrency mechanism, and change protocol before signing off.", "Capstone")}
      <div class="engine-levels standalone-levels"><span>1 · portable intent</span><span>2 · implementation delta</span><span>3 · rehearsal evidence</span><span>4 · design review</span></div>

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Migration review</span><strong>Architecture sign-off in 30 minutes</strong><span class="severity">four hidden contracts</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Levels 1–2 · Lab 29</span><h2>Translate the mechanism before the DDL</h2><p class="lab-copy" id="migration-story"></p></div><span class="lab-badge" id="migration-route-badge">—</span></div>
        <div class="controls"><div class="control grow"><label for="migration-route">Migration route</label><select id="migration-route"><option value="postgresMysql">PostgreSQL 18 → MySQL 8.4/InnoDB</option><option value="mysqlSqlite">MySQL 8.4/InnoDB → SQLite 3.x</option></select></div><button class="button primary" id="review-migration">Run architecture review</button></div>
        <div class="migration-path"><div><small>source</small><strong id="migration-source">—</strong></div><span>→ translate →</span><div><small>target</small><strong id="migration-target">—</strong></div></div>
        <div class="migration-dimensions" id="migration-dimensions"></div>
        <div class="metric-grid compact"><div class="metric"><span>Contracts translated</span><strong id="migration-score">0 / 4</strong><small>mechanism-aware decisions</small></div><div class="metric"><span>Critical gaps</span><strong id="migration-gaps">4</strong><small>before production</small></div><div class="metric"><span>Review verdict</span><strong id="migration-verdict">NOT READY</strong><small>rehearsal gate</small></div></div>
        <div class="diagnosis warning" id="migration-diagnosis"><span class="diagnosis-label">Design review</span><p>Select one decision for every implementation delta, then run the review.</p></div>
      </section>

      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Level 3 · Rehearsal evidence</span><h2>Read the failure in both dialects</h2><p class="lab-copy">The source plan proves what the feature relied on; the target rehearsal exposes which assumption did not cross the boundary.</p></div><span class="lab-badge">source → target</span></div>
        <pre class="migration-evidence"><code id="migration-evidence"></code></pre>
        <div class="engine-doc-links" id="migration-sources"></div>
      </section>

      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Level 4 · Explain your design</span><h2>Four questions every engine migration must answer</h2></div></div>
        <section class="concept-grid migration-principles"><article class="concept-card"><span class="concept-number">locator</span><h3>Where does a row live?</h3><p>Know what secondary entries point to and how the primary key changes every index.</p></article><article class="concept-card"><span class="concept-number">capability</span><h3>Can the target express it?</h3><p>Translate partial, functional, full-text, spatial, and partition features by semantics.</p></article><article class="concept-card"><span class="concept-number">concurrency</span><h3>What waits or retries?</h3><p>Race the invariant under the target's snapshots, locks, writer model, and errors.</p></article><article class="concept-card"><span class="concept-number">operations</span><h3>How does it roll out?</h3><p>Rehearse locks, temporary space, replication or WAL impact, failure artifacts, and rollback.</p></article></section>
      </section>

      <div class="insight"><span class="insight-mark">!</span><p><strong>Feature parity is not behavioral parity.</strong> Keep the source workload and invariants as executable tests, then prove the target's physical mechanism produces acceptable outcomes under load, failure, and maintenance.</p></div>
      ${DSL.lessonFooter("migration-capstone")}
    </article>`;
    setupMigrationCapstone();
  }

  function setupMigrationCapstone() {
    const route = document.getElementById("migration-route");

    function renderScenario() {
      const scenario = MIGRATIONS[route.value];
      document.getElementById("migration-story").textContent = scenario.story;
      document.getElementById("migration-route-badge").textContent = `${scenario.source} → ${scenario.target}`;
      document.getElementById("migration-source").textContent = scenario.source;
      document.getElementById("migration-target").textContent = scenario.target;
      document.getElementById("migration-evidence").textContent = scenario.evidence;
      document.getElementById("migration-sources").innerHTML = scenario.sources.map((source) => `<a href="${source.url}" target="_blank" rel="noreferrer">${source.label} ↗</a>`).join("");
      document.getElementById("migration-dimensions").innerHTML = scenario.dimensions.map((dimension, index) => `<article class="migration-dimension" data-migration-dimension="${index}"><span>${String(index + 1).padStart(2, "0")}</span><h3>${dimension.title}</h3><p>${dimension.symptom}</p><label for="migration-choice-${index}">Target design</label><select id="migration-choice-${index}">${dimension.options.map((option, optionIndex) => `<option value="${optionIndex}">${option}</option>`).join("")}</select><div class="migration-feedback">Awaiting review.</div></article>`).join("");
      document.getElementById("migration-score").textContent = `0 / ${scenario.dimensions.length}`;
      document.getElementById("migration-gaps").textContent = scenario.dimensions.length;
      document.getElementById("migration-verdict").textContent = "NOT READY";
      const diagnosis = document.getElementById("migration-diagnosis");
      diagnosis.className = "diagnosis warning";
      diagnosis.innerHTML = `<span class="diagnosis-label">Design review</span><p>Translate each source assumption into a target mechanism, then run the review.</p>`;
    }

    document.getElementById("review-migration").addEventListener("click", () => {
      const scenario = MIGRATIONS[route.value];
      let correct = 0;
      scenario.dimensions.forEach((dimension, index) => {
        const selected = Number(document.getElementById(`migration-choice-${index}`).value);
        const passed = selected === dimension.answer;
        if (passed) correct += 1;
        const card = document.querySelector(`[data-migration-dimension="${index}"]`);
        card.className = `migration-dimension ${passed ? "passed" : "failed"}`;
        const feedback = card.querySelector(".migration-feedback");
        feedback.textContent = `${passed ? "PASS" : "GAP"} · ${dimension.why}`;
      });
      const gaps = scenario.dimensions.length - correct;
      document.getElementById("migration-score").textContent = `${correct} / ${scenario.dimensions.length}`;
      document.getElementById("migration-gaps").textContent = gaps;
      document.getElementById("migration-verdict").textContent = gaps === 0 ? "REHEARSE" : "NOT READY";
      const diagnosis = document.getElementById("migration-diagnosis");
      diagnosis.className = `diagnosis ${gaps === 0 ? "resolved" : "warning"}`;
      diagnosis.innerHTML = gaps === 0
        ? `<span class="diagnosis-label">Design translated</span><p>All four implementation contracts have a target-aware design. The next gate is a production-shaped rehearsal with correctness, latency, lock, and recovery assertions.</p>`
        : `<span class="diagnosis-label">${gaps} gap${gaps === 1 ? "" : "s"} remain</span><p>The migration still assumes source behavior in the target. Use the feedback on each failed dimension before approving load or cutover rehearsal.</p>`;
    });

    route.addEventListener("change", renderScenario);
    renderScenario();
  }

  DSL.registerRenderer("migration-capstone", renderMigrationCapstone);
})(window.DataSystemsLab);
