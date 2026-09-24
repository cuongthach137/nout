(function registerQueryPlanningLesson(DSL) {
  "use strict";

  function renderPlanner() {
    const lesson = DSL.getLesson("planner");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "The fastest plan can change with one number.", "An index lookup is not free. When a query returns much of a table, many scattered lookups can cost more than reading the table once.", "Intermediate")}
      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Lab 10</span><h2>Cost-based query planner</h2><p class="lab-copy">Change the share of rows that match. The simplified planner estimates page work and chooses the cheaper path.</p></div><span class="lab-badge">estimate → choose</span></div>
        <div class="controls"><div class="control grow"><label for="selectivity">Rows matching: <span class="range-value" id="selectivity-value">1%</span></label><input id="selectivity" type="range" min="1" max="100" value="1"></div><div class="control"><label for="table-size">Table size</label><select id="table-size"><option value="1000">1,000 rows</option><option value="10000" selected>10,000 rows</option><option value="100000">100,000 rows</option></select></div></div>
        <div class="plan-layout">
          <div class="plan-card" id="index-plan"><h3>Index scan</h3><p class="lab-copy">Traverse the tree, then fetch matching table pages.</p><div class="plan-cost"><span id="index-cost">—</span> <small>cost units</small></div><div class="cost-bar"><div class="cost-fill" id="index-bar"></div></div><p class="plan-note" id="index-note"></p></div>
          <div class="plan-card" id="seq-plan"><h3>Sequential scan</h3><p class="lab-copy">Read every table page once and filter rows.</p><div class="plan-cost"><span id="seq-cost">—</span> <small>cost units</small></div><div class="cost-bar"><div class="cost-fill" id="seq-bar"></div></div><p class="plan-note" id="seq-note"></p></div>
        </div>
        <div class="viz-caption"><span id="planner-status" aria-live="polite"></span><span>Lower cost wins</span></div>
      </section>

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Production drill</span><strong>Fast for most tenants, 5s for one</strong><span class="severity">plan regression</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Symptom → estimates → actuals</span><h2>The plan is only as good as its statistics</h2><p class="lab-copy">A large tenant imported years of history. The planner still estimates 1% of rows will match, chooses scattered index fetches, and discovers 45% at runtime. Compare the estimate with reality, then refresh statistics.</p></div><span class="lab-badge">EXPLAIN ANALYZE</span></div>
        <div class="controls"><div class="control grow"><label for="tenant-shape">Request</label><select id="tenant-shape"><option value="typical">Typical tenant · 1% of rows</option><option value="whale" selected>MegaCorp · 45% of rows</option></select></div><button class="button primary" id="run-plan-incident">Run query</button><button class="button" id="refresh-stats">ANALYZE events</button></div>
        <div class="estimate-actual"><div><div class="bar-label"><span>Planner estimate</span><strong id="estimate-label">1%</strong></div><div class="distribution-track"><span id="estimate-bar"></span></div></div><div><div class="bar-label"><span>Actual rows</span><strong id="actual-label">45%</strong></div><div class="distribution-track"><span id="actual-bar"></span></div></div></div>
        <div class="plan-trace" aria-live="polite"><div><small>Statistics</small><strong id="stats-state">18 days old</strong></div><span>→</span><div><small>Chosen plan</small><strong id="incident-plan">—</strong></div><span>→</span><div><small>Actual work</small><strong id="incident-work">—</strong></div><span>→</span><div><small>p95</small><strong id="incident-latency">—</strong></div></div>
        <div class="diagnosis" id="planner-diagnosis"><span class="diagnosis-label">Investigation</span><p>Run the production query. Compare estimated and actual rows before changing indexes.</p></div>
      </section>
      ${DSL.EngineLens.render({ id: "planner-engine-lens", title: "Translate the same access path into each engine’s evidence", copy: "Every optimizer estimates rows and chooses physical operators, but the plan vocabulary and the strongest warning signals differ. Learn to translate mechanisms, not memorize one output format." })}
      <div class="insight"><span class="insight-mark">!</span><p><strong>Statistics matter:</strong> planners use approximate row counts and value distributions. Stale statistics can make a mathematically reasonable planner choose badly.</p></div>
      ${DSL.lessonFooter("planner")}
    </article>`;
    setupPlannerLab();
    setupStatisticsIncident();
    DSL.EngineLens.mount("planner-engine-lens", plannerEngineConfig());
  }

  function plannerEngineConfig() {
    return { engines: [
      {
        id: "postgres", label: "PostgreSQL", version: "PostgreSQL 18", mechanism: "Tree of scan, join, sort, and aggregate nodes", signature: "cost=startup..total rows=estimate → actual time/rows/loops",
        diagram: [{ kicker: "predicate", label: "status='paid'", detail: "query clause" }, { kicker: "statistics", label: "histogram", detail: "estimate selectivity" }, { kicker: "candidate", label: "bitmap vs seq", detail: "cost both" }, { kicker: "chosen", label: "Bitmap Heap Scan", detail: "execute + recheck" }],
        steps: [{ title: "Estimate result rows", copy: "Column statistics and predicates produce cardinality estimates that flow upward through the plan tree." }, { title: "Cost physical alternatives", copy: "Sequential, index, bitmap, and index-only scans trade startup, CPU, and page access costs." }, { title: "Choose a node tree", copy: "The cheapest estimated complete plan wins, not necessarily the scan with the smallest first step." }, { title: "Compare estimates with reality", copy: "EXPLAIN ANALYZE adds actual time, rows, loops, and buffer evidence; multiply inner work by loops." }],
        counters: [{ label: "Plan clue", value: "rows vs actual", note: "cardinality error" }, { label: "I/O clue", value: "BUFFERS", note: "heap + index pages" }, { label: "Covering clue", value: "Heap Fetches", note: "index-only reality" }],
        incident: { title: "One tenant turns an Index Scan into random I/O", copy: "The planner expected 820 rows and received 418,204. The scan node is the symptom; the estimate gap explains why it was selected.", evidence: "Index Scan on orders_customer_idx\n  (rows=820) (actual rows=418204 loops=1)\n  Buffers: shared read=5870" },
        challenge: { prompt: "An inner Index Scan reports actual time 0.03 ms and loops=200,000. What is the first calculation?", options: ["Treat it as 0.03 ms total", "Multiply inner work by loops", "Disable all index scans"], answer: 1, why: "Nested-loop inner nodes repeat. Per-loop work that looks tiny can dominate after multiplication." },
        source: { label: "EXPLAIN documentation", url: "https://www.postgresql.org/docs/18/using-explain.html" },
      },
      {
        id: "mysql", label: "MySQL / InnoDB", version: "MySQL 8.4", mechanism: "Access type, chosen key, rows, filtered, and iterator timing", signature: "type/access_type + key + rows × filtered",
        diagram: [{ kicker: "predicate", label: "status='paid'", detail: "WHERE" }, { kicker: "candidates", label: "possible_keys", detail: "eligible indexes" }, { kicker: "choice", label: "type=range", detail: "key=idx_status" }, { kicker: "remaining", label: "filtered=12%", detail: "post-access filter" }],
        steps: [{ title: "Read access_type", copy: "Traditional EXPLAIN calls it type; JSON calls it access_type. ALL signals a full scan, while ref and range describe indexed access shapes." }, { title: "Compare possible_keys and key", copy: "Eligibility is not selection. The key column identifies the index the optimizer actually chose." }, { title: "Estimate rows that survive", copy: "rows estimates examined rows; rows multiplied by filtered estimates rows passed to the next table." }, { title: "Use EXPLAIN ANALYZE", copy: "TREE format adds actual iterator timing and row counts, exposing loops and estimate errors." }],
        counters: [{ label: "Access clue", value: "type", note: "ALL / range / ref" }, { label: "Index chosen", value: "key", note: "NULL means none" }, { label: "Flow estimate", value: "rows × filtered", note: "next iterator" }],
        incident: { title: "possible_keys is not proof of index use", copy: "The index is eligible, but key is NULL and type is ALL because the cost model expects most rows to match.", evidence: "type: ALL\npossible_keys: idx_status\nkey: NULL\nrows: 980000\nfiltered: 45.00" },
        challenge: { prompt: "EXPLAIN shows rows=10,000 and filtered=5.00. Roughly how many rows flow onward?", options: ["500", "5,000", "10,005"], answer: 0, why: "rows × filtered percentage gives roughly 10,000 × 0.05 = 500 rows for the next operation." },
        source: { label: "EXPLAIN output documentation", url: "https://dev.mysql.com/doc/refman/8.4/en/explain-output.html" },
      },
      {
        id: "sqlite", label: "SQLite", version: "SQLite 3.x", mechanism: "EXPLAIN QUERY PLAN SCAN/SEARCH tree", signature: "SCAN table | SEARCH table USING [COVERING] INDEX",
        diagram: [{ kicker: "predicate", label: "status=?", detail: "WHERE term" }, { kicker: "planner", label: "usable index", detail: "term matching" }, { kicker: "detail", label: "SEARCH orders", detail: "USING INDEX" }, { kicker: "result", label: "rowid lookup", detail: "or covering" }],
        steps: [{ title: "Start with SCAN versus SEARCH", copy: "SCAN visits all records in an object; SEARCH uses an index to visit a subset." }, { title: "Read the named index and terms", copy: "The detail text identifies the chosen index and which WHERE terms constrain it." }, { title: "Notice COVERING", copy: "A covering index supplies requested columns without a separate table B-tree lookup." }, { title: "Inspect nested-loop order", copy: "Each SCAN or SEARCH row is one loop; indentation shows the outer-to-inner nesting order." }],
        counters: [{ label: "Full access", value: "SCAN", note: "may still use order" }, { label: "Subset access", value: "SEARCH", note: "indexed terms" }, { label: "Table lookup", value: "skipped", note: "when COVERING" }],
        incident: { title: "A harmless expression disabled SEARCH", copy: "The index is on lower(email), but the query applies a different expression spelling, so the plan returns to a table scan.", evidence: "EXPLAIN QUERY PLAN\nSELECT id FROM users WHERE trim(lower(email))=?;\n`--SCAN users" },
        challenge: { prompt: "Which detail confirms that requested columns come entirely from the index?", options: ["SCAN", "USING COVERING INDEX", "USE TEMP B-TREE"], answer: 1, why: "USING COVERING INDEX means SQLite can answer from the index B-tree without a separate table lookup." },
        source: { label: "query-plan documentation", url: "https://www.sqlite.org/eqp.html" },
      },
    ] };
  }

  function setupPlannerLab() {
    const slider = document.getElementById("selectivity");
    const size = document.getElementById("table-size");

    function update() {
      const percent = Number(slider.value);
      const rows = Number(size.value);
      const pages = Math.ceil(rows / 100);
      const matches = Math.round(rows * percent / 100);
      const treeDepth = Math.ceil(Math.log(rows) / Math.log(100)) + 1;
      const indexCost = Math.round(treeDepth + matches * 0.55);
      const sequentialCost = pages;
      const maximum = Math.max(indexCost, sequentialCost);
      document.getElementById("selectivity-value").textContent = `${percent}% · ${matches.toLocaleString()} rows`;
      document.getElementById("index-cost").textContent = indexCost.toLocaleString();
      document.getElementById("seq-cost").textContent = sequentialCost.toLocaleString();
      document.getElementById("index-bar").style.width = `${Math.max(3, indexCost / maximum * 100)}%`;
      document.getElementById("seq-bar").style.width = `${Math.max(3, sequentialCost / maximum * 100)}%`;
      document.getElementById("index-note").textContent = `${treeDepth} tree pages + about ${Math.round(matches * 0.55).toLocaleString()} scattered fetches`;
      document.getElementById("seq-note").textContent = `${pages.toLocaleString()} contiguous pages, independent of matches`;
      const indexWins = indexCost < sequentialCost;
      document.getElementById("index-plan").classList.toggle("winner", indexWins);
      document.getElementById("seq-plan").classList.toggle("winner", !indexWins);
      document.getElementById("planner-status").textContent = indexWins ? `Index scan wins at ${percent}% selectivity` : `Sequential scan wins at ${percent}% selectivity`;
    }

    slider.addEventListener("input", update);
    size.addEventListener("change", update);
    update();
  }

  function setupStatisticsIncident() {
    let statsFresh = false;
    const tenant = document.getElementById("tenant-shape");
    const actualPercent = () => tenant.value === "whale" ? 45 : 1;

    function renderBars(estimated = 1) {
      const actual = actualPercent();
      document.getElementById("estimate-label").textContent = `${estimated}%`;
      document.getElementById("actual-label").textContent = `${actual}%`;
      document.getElementById("estimate-bar").style.width = `${estimated}%`;
      document.getElementById("actual-bar").style.width = `${actual}%`;
    }

    tenant.addEventListener("change", () => {
      statsFresh = false;
      document.getElementById("stats-state").textContent = "18 days old";
      ["incident-plan", "incident-work", "incident-latency"].forEach((id) => { document.getElementById(id).textContent = "—"; });
      const diagnosis = document.getElementById("planner-diagnosis");
      diagnosis.className = "diagnosis";
      diagnosis.innerHTML = `<span class="diagnosis-label">Investigation</span><p>Run the request with the current statistics.</p>`;
      renderBars(1);
    });

    document.getElementById("refresh-stats").addEventListener("click", () => {
      statsFresh = true;
      const percent = actualPercent();
      document.getElementById("stats-state").textContent = "fresh histogram";
      renderBars(percent);
      DSL.showToast(`Statistics refreshed — estimate is now ${percent}%`);
    });

    document.getElementById("run-plan-incident").addEventListener("click", () => {
      const actual = actualPercent();
      const estimate = statsFresh ? actual : 1;
      const rows = 100000;
      const pages = 1000;
      const estimatedIndexCost = 4 + rows * estimate / 100 * 0.08;
      const chooseIndex = estimatedIndexCost < pages;
      const actualWork = chooseIndex ? Math.round(4 + rows * actual / 100 * 0.08) : pages;
      const latency = actualWork < 200 ? `${Math.round(actualWork * 1.4)} ms` : `${(actualWork * 1.4 / 1000).toFixed(1)} s`;
      document.getElementById("incident-plan").textContent = chooseIndex ? "Index scan" : "Sequential scan";
      document.getElementById("incident-work").textContent = `${actualWork.toLocaleString()} cost`;
      document.getElementById("incident-latency").textContent = latency;
      renderBars(estimate);

      const healthy = actualWork <= pages;
      const diagnosis = document.getElementById("planner-diagnosis");
      diagnosis.className = `diagnosis ${healthy ? "resolved" : "warning"}`;
      diagnosis.innerHTML = healthy
        ? `<span class="diagnosis-label">Observable fix</span><p>The fresh estimate makes the planner choose one sequential pass (${pages.toLocaleString()} pages) instead of thousands of scattered heap fetches. Measure estimated versus actual rows before forcing a plan.</p>`
        : `<span class="diagnosis-label">Root cause</span><p>The planner expected ${Math.round(rows * estimate / 100).toLocaleString()} rows but received ${Math.round(rows * actual / 100).toLocaleString()}. Its index choice was rational for the stale estimate and expensive for the real tenant.</p>`;
    });

    renderBars(1);
  }

  DSL.registerRenderer("planner", renderPlanner);
})(window.DataSystemsLab);
