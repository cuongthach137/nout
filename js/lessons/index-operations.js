(function registerIndexOperationsLesson(DSL) {
  "use strict";

  const BUILD_TIMES = {
    million: { rows: "1 million", standard: "30 s", concurrent: "70 s", units: 18 },
    hundred: { rows: "100 million", standard: "12 min", concurrent: "27 min", units: 48 },
    billion: { rows: "1 billion", standard: "2.2 h", concurrent: "5.1 h", units: 82 },
  };

  function renderIndexOperations() {
    const lesson = DSL.getLesson("index-operations");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "An index build is a <em>production operation</em>.", "On a large table, creating the right index is only half the job. You also need a safe rollout plan, enough I/O headroom, and visibility into transactions that can delay completion.", "Advanced")}
      <section class="lab incident-lab">
        <div class="incident-strip"><span>Change window</span><strong>Add an index to a live orders table</strong><span class="severity">writes: 4k/s</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Lab 06</span><h2>Plan the index build</h2><p class="lab-copy">Compare a standard build with PostgreSQL’s concurrent build. Scale the table, then introduce a long-running transaction and inspect the timeline.</p></div><span class="lab-badge">locks · scans · snapshots</span></div>
        <div class="query-box"><code>CREATE TABLE orders AS<br>SELECT g AS id, (g % 100000)::int AS customer_id,<br>&nbsp;&nbsp;now() - (g * interval '1 second') AS created_at<br>FROM generate_series(1, 1000000) AS g;</code></div>
        <div class="query-box"><code id="build-sql">CREATE INDEX orders_customer_created_idx ON orders (customer_id, created_at);</code></div>
        <div class="controls"><div class="control"><label for="build-size">Table size</label><select id="build-size"><option value="million">1 million rows</option><option value="hundred">100 million rows</option><option value="billion">1 billion rows</option></select></div><div class="control"><label for="build-mode">Build method</label><select id="build-mode"><option value="standard">CREATE INDEX</option><option value="concurrent">CREATE INDEX CONCURRENTLY</option></select></div><div class="control"><label for="old-transaction">Older transaction</label><select id="old-transaction"><option value="none">None</option><option value="long">2-hour reporting transaction</option></select></div><button class="button primary" id="simulate-build">Simulate rollout</button></div>
        <div class="build-timeline" id="build-timeline" aria-live="polite"></div>
        <div class="metric-grid compact"><div class="metric"><span>Estimated duration</span><strong id="build-duration">—</strong><small>illustrative, hardware-dependent</small></div><div class="metric"><span>Write downtime</span><strong id="build-downtime">—</strong><small>application impact</small></div><div class="metric"><span>Table scans</span><strong id="build-scans">—</strong><small>base table passes</small></div></div>
        <div class="diagnosis" id="build-diagnosis"><span class="diagnosis-label">Runbook</span><p>Choose a method. “Concurrent” reduces lock impact, but it is not free or instant.</p></div>
      </section>

      <section class="concept-grid">
        <div class="concept-card"><span class="concept-number">standard</span><h3>Faster, stronger lock</h3><p>A regular PostgreSQL build permits reads but blocks writes until the index is complete.</p></div>
        <div class="concept-card"><span class="concept-number">concurrent</span><h3>Writes continue</h3><p>The concurrent form performs extra coordination and scans, takes longer, and cannot run inside a transaction block.</p></div>
        <div class="concept-card"><span class="concept-number">failure</span><h3>Inspect before retrying</h3><p>A failed concurrent build can leave an invalid index that still adds update overhead and must be removed or rebuilt.</p></div>
      </section>
      ${DSL.EngineLens.render({ id: "build-engine-lens", title: "“Online” means a different protocol in each engine", copy: "The portable goal is to preserve application availability while deriving a new structure from live data. The scans, change capture, lock boundaries, and failure artifacts differ." })}
      <div class="insight"><span class="insight-mark">!</span><p><strong>At billion-row scale, the bottleneck is operational:</strong> estimate temporary space, replication lag, I/O saturation, and rollback steps before scheduling the build.</p></div>
      ${DSL.lessonFooter("index-operations")}
    </article>`;
    setupBuildLab();
    DSL.EngineLens.mount("build-engine-lens", buildEngineConfig());
  }

  function buildEngineConfig() {
    return { engines: [
      {
        id: "postgres", label: "PostgreSQL", version: "PostgreSQL 18", mechanism: "CREATE INDEX CONCURRENTLY", signature: "catalog invalid → scan → wait → scan → validate",
        diagram: [{ kicker: "catalog", label: "invalid index", detail: "writes already maintain it" }, { kicker: "pass 1", label: "heap scan", detail: "build entries" }, { kicker: "barrier", label: "wait snapshots", detail: "old xacts" }, { kicker: "pass 2", label: "validate", detail: "mark valid" }],
        steps: [{ title: "Register an invalid index", copy: "The catalog entry exists before it is safe for plans; concurrent writes begin maintaining it." }, { title: "Scan the table", copy: "The first pass derives index entries while normal inserts, updates, and deletes continue." }, { title: "Cross snapshot barriers", copy: "The build waits for transactions that could make its view unsafe." }, { title: "Validate and publish", copy: "A second scan catches concurrent changes before the index becomes valid for queries." }],
        counters: [{ label: "Heap scans", value: "2", note: "concurrent build" }, { label: "Writes blocked", value: "no", note: "normal DML continues" }, { label: "Failure artifact", value: "INVALID", note: "inspect and clean" }],
        incident: { title: "The build is “stuck” after both scans", copy: "An old snapshot can hold the validation phase. Killing the builder loses hours of work; first identify the wait and the transaction that owns it.", evidence: "SELECT phase, lockers_total, lockers_done\nFROM pg_stat_progress_create_index;\n-- phase: waiting for old snapshots" },
        challenge: { prompt: "A concurrent unique-index build fails during validation. What should the runbook check first?", options: ["Assume nothing was created", "Inspect for an INVALID index", "Restart PostgreSQL"], answer: 1, why: "A failed concurrent build can leave an invalid index that consumes space and update work even though the planner ignores it." },
        source: { label: "CREATE INDEX documentation", url: "https://www.postgresql.org/docs/18/sql-createindex.html" },
      },
      {
        id: "mysql", label: "MySQL / InnoDB", version: "MySQL 8.4 · InnoDB", mechanism: "Online DDL with ALGORITHM and LOCK", signature: "scan clustered index → sort/load → apply online DML log",
        diagram: [{ kicker: "guardrail", label: "LOCK=NONE", detail: "fail if unsupported" }, { kicker: "source", label: "clustered scan", detail: "derive keys" }, { kicker: "concurrent", label: "online log", detail: "capture DML" }, { kicker: "metadata", label: "final lock", detail: "publish schema" }],
        steps: [{ title: "Require the concurrency contract", copy: "LOCK=NONE asks MySQL to error rather than silently choose a mode that blocks DML when the operation cannot be online." }, { title: "Scan the clustered index", copy: "InnoDB reads the clustered records and creates sorted secondary entries." }, { title: "Capture concurrent DML", copy: "Changes made during an in-place build accumulate in an online log and are applied to the new index." }, { title: "Acquire metadata lock", copy: "The final data-dictionary change needs a brief exclusive metadata lock and can wait behind old transactions." }],
        counters: [{ label: "Table rebuild", value: "no", note: "secondary index" }, { label: "Concurrent DML", value: "yes", note: "LOCK=NONE" }, { label: "Final boundary", value: "MDL", note: "can wait" }],
        incident: { title: "The online DDL waits before doing visible work", copy: "A forgotten transaction holds a metadata lock. Online does not mean lock-free; inspect metadata-lock blockers before retrying.", evidence: "ALTER TABLE orders ADD INDEX idx_customer(customer_id),\n  ALGORITHM=INPLACE, LOCK=NONE;\n-- Waiting for table metadata lock" },
        challenge: { prompt: "Why specify LOCK=NONE instead of accepting LOCK=DEFAULT during a live rollout?", options: ["It makes the index smaller", "It fails if requested DML concurrency is unavailable", "It skips validation"], answer: 1, why: "LOCK=NONE turns the availability requirement into an executable guardrail instead of allowing the server to choose a stronger lock." },
        source: { label: "online DDL documentation", url: "https://dev.mysql.com/doc/refman/8.4/en/innodb-online-ddl-limitations.html" },
      },
      {
        id: "sqlite", label: "SQLite", version: "SQLite 3.x · WAL contrast", mechanism: "Schema change inside one write transaction", signature: "single writer → scan table → build index b-tree → commit schema",
        diagram: [{ kicker: "writer", label: "write lock", detail: "one writer" }, { kicker: "source", label: "table b-tree", detail: "scan records" }, { kicker: "build", label: "index b-tree", detail: "write pages" }, { kicker: "commit", label: "schema cookie", detail: "publish" }],
        steps: [{ title: "Become the database writer", copy: "CREATE INDEX is a write transaction; SQLite serializes it with other writers." }, { title: "Read every source row", copy: "The engine computes each index key from the table B-tree." }, { title: "Write the new B-tree", copy: "New index pages and schema metadata are part of the same atomic change." }, { title: "Commit the schema", copy: "In WAL mode, existing readers can retain older snapshots, but other writes still wait for the single writer." }],
        counters: [{ label: "Concurrent writers", value: "0", note: "single writer" }, { label: "Existing WAL readers", value: "continue", note: "old snapshot" }, { label: "Native online syntax", value: "none", note: "plan maintenance" }],
        incident: { title: "Mobile migration hits SQLITE_BUSY", copy: "A background writer overlaps startup migration. Keep the schema transaction short, coordinate writers, configure a bounded busy timeout, and ship a tested rollback path.", evidence: "BEGIN IMMEDIATE;\nCREATE INDEX idx_events_kind ON events(kind);\nCOMMIT;\n-- competing writer: SQLITE_BUSY" },
        challenge: { prompt: "In WAL mode, who must wait while CREATE INDEX owns the write transaction?", options: ["All established readers", "Other writers", "No connection"], answer: 1, why: "WAL lets readers coexist with a writer, but SQLite still permits only one writer at a time." },
        source: { label: "WAL documentation", url: "https://www.sqlite.org/wal.html" },
      },
    ] };
  }

  function setupBuildLab() {
    const size = document.getElementById("build-size");
    const mode = document.getElementById("build-mode");
    const transaction = document.getElementById("old-transaction");
    const sql = document.getElementById("build-sql");
    mode.addEventListener("change", () => { sql.textContent = `CREATE INDEX${mode.value === "concurrent" ? " CONCURRENTLY" : ""} orders_customer_created_idx ON orders (customer_id, created_at);`; });

    document.getElementById("simulate-build").addEventListener("click", () => {
      const table = BUILD_TIMES[size.value];
      const concurrent = mode.value === "concurrent";
      const oldSnapshot = transaction.value === "long";
      const phases = concurrent
        ? [
          ["Writers", "continue", "safe"], ["Catalog", "register invalid index", "work"], ["Scan 1", `build from ${table.rows} rows`, "work"],
          ["Wait", oldSnapshot ? "old snapshot · +2h" : "writers finish", oldSnapshot ? "blocked" : "work"], ["Scan 2", "catch concurrent writes", "work"], ["Ready", "mark valid", "safe"],
        ]
        : [["Writers", "blocked", "blocked"], ["Build", `scan ${table.rows} rows`, "work"], ["Ready", "release lock", "safe"]];
      document.getElementById("build-timeline").innerHTML = phases.map(([label, detail, kind], index) => `<div class="build-phase ${kind}" style="flex:${index === (concurrent ? 2 : 1) ? table.units : 18}"><strong>${label}</strong><small>${detail}</small></div>`).join("");
      document.getElementById("build-duration").textContent = concurrent ? `${table.concurrent}${oldSnapshot ? " + wait" : ""}` : table.standard;
      document.getElementById("build-downtime").textContent = concurrent ? "0" : table.standard;
      document.getElementById("build-scans").textContent = concurrent ? "2" : "1";
      const diagnosis = document.getElementById("build-diagnosis");
      diagnosis.className = `diagnosis ${concurrent ? (oldSnapshot ? "warning" : "resolved") : "warning"}`;
      diagnosis.innerHTML = concurrent
        ? `<span class="diagnosis-label">Concurrent plan</span><p>${oldSnapshot ? "Writes remain available, but the build waits for transactions whose snapshots could conflict with validation. Find and resolve unexpectedly old transactions before the change." : "Writes remain available. Budget for two table scans, extra CPU/I/O, and a longer wall-clock build."}</p>`
        : `<span class="diagnosis-label">Blocking plan</span><p>The faster single scan blocks inserts, updates, and deletes for ${table.standard}. This may be acceptable in a maintenance window, but it is unsafe during normal traffic.</p>`;
    });
  }

  DSL.registerRenderer("index-operations", renderIndexOperations);
})(window.DataSystemsLab);
