(function registerPredicateIndexesLesson(DSL) {
  "use strict";

  const ENGINES = {
    postgres: { label: "PostgreSQL 18", partial: true },
    mysql: { label: "MySQL 8.4 · InnoDB", partial: false },
    sqlite: { label: "SQLite 3.x", partial: true },
  };

  const CHECK_QUESTIONS = [
    { prompt: "Only 5% of orders are open. Which native feature can omit the other 95% in PostgreSQL and SQLite?", options: ["Partial index", "Covering index", "Hash join"], answer: 0, why: "A partial index stores only rows whose WHERE predicate evaluates true." },
    { prompt: "MySQL 8.4 must accelerate WHERE status='open' AND tenant_id=?. What is the honest portable starting point?", options: ["Pretend WHERE is accepted in CREATE INDEX", "Composite B-tree beginning with status", "BRIN on status"], answer: 1, why: "MySQL has no native partial-index WHERE clause; a selective composite access path is a direct alternative to measure." },
    { prompt: "An index is built on lower(email). Which predicate most reliably exposes the indexed expression?", options: ["WHERE email = ?", "WHERE lower(email) = lower(?)", "WHERE length(email) > 0"], answer: 1, why: "The query must expose the indexed expression; SQLite in particular requires the expression to match as written, apart from minor syntax differences." },
  ];

  function indexPlan(engineId, scenario, queryShape) {
    const engine = ENGINES[engineId];
    const exact = queryShape === "exact";
    if (scenario === "partial") {
      const nativePartial = engine.partial;
      const entries = nativePartial ? 50 : 1000;
      const sql = engineId === "postgres"
        ? "CREATE INDEX orders_open_tenant_idx\nON orders (tenant_id, created_at)\nWHERE status = 'open';"
        : engineId === "sqlite"
          ? "CREATE INDEX orders_open_tenant_idx\nON orders (tenant_id, created_at)\nWHERE status = 'open';"
          : "CREATE INDEX orders_status_tenant_idx\nON orders (status, tenant_id, created_at);\n-- no native partial-index WHERE clause";
      return {
        entries,
        qualifying: 50,
        usable: exact,
        writeEntries: nativePartial ? 5 : 100,
        sql,
        verdict: exact
          ? nativePartial ? "The query implies the index predicate, so the compact subset is eligible." : "The leading status value narrows the full InnoDB B-tree; it is useful but not physically partial."
          : nativePartial ? "The query does not guarantee status='open', so the partial index cannot contain every possible answer." : "Without the leading status predicate, the composite index loses its strongest access prefix.",
      };
    }

    const sql = engineId === "mysql"
      ? "CREATE INDEX users_lower_email_idx\nON users ((LOWER(email)));"
      : "CREATE INDEX users_lower_email_idx\nON users (lower(email));";
    return {
      entries: 1000,
      qualifying: 1000,
      usable: exact,
      writeEntries: 100,
      sql,
      verdict: exact
        ? "The predicate exposes the same deterministic expression, making the computed key eligible for lookup."
        : "The query addresses the base column rather than the indexed expression; do not assume the optimizer can rewrite it.",
    };
  }

  function productionEvidence(engineId, scenario, exact) {
    if (scenario === "expression") {
      if (engineId === "postgres") return exact
        ? "Index Scan using users_lower_email_idx\n  Index Cond: (lower(email) = 'ada@example.com')"
        : "Seq Scan on users\n  Filter: (email = 'Ada@Example.com')";
      if (engineId === "mysql") return exact
        ? "type: ref\nkey: users_lower_email_idx\nrows: 1"
        : "type: ALL\nkey: NULL\nrows: 1000000";
      return exact
        ? "SEARCH users USING INDEX users_lower_email_idx (<expr>=?)"
        : "SCAN users";
    }

    if (engineId === "postgres") return exact
      ? "Index Scan using orders_open_tenant_idx\n  Index Cond: (tenant_id = 42)"
      : "Seq Scan on orders\n  Filter: (tenant_id = 42)";
    if (engineId === "mysql") return exact
      ? "type: ref\nkey: orders_status_tenant_idx\nrows: 48"
      : "type: ALL\nkey: NULL\nrows: 1000000";
    return exact
      ? "SEARCH orders USING INDEX orders_open_tenant_idx"
      : "SCAN orders";
  }

  function renderPredicateIndexes() {
    const lesson = DSL.getLesson("predicate-indexes");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "Index the rows—or the value—you <em>actually query.</em>", "Partial indexes remove irrelevant rows from a B-tree. Expression and functional indexes materialize the result of a deterministic computation. Both can cut work dramatically, but only when a query proves it can use the stored key set.", "Advanced")}
      <div class="engine-levels standalone-levels"><span>1 · portable model</span><span>2 · page-level design</span><span>3 · production miss</span><span>4 · design check</span></div>

      <section class="concept-grid">
        <article class="concept-card"><span class="concept-number">subset</span><h3>Partial index</h3><p>Only rows satisfying an index predicate receive entries. Fewer entries mean fewer pages and fewer writes for excluded rows.</p></article>
        <article class="concept-card"><span class="concept-number">computed key</span><h3>Expression index</h3><p>The leaf stores a deterministic derived value such as <code>lower(email)</code>, then maps it back to the row locator.</p></article>
        <article class="concept-card"><span class="concept-number">proof</span><h3>Query compatibility</h3><p>The optimizer must prove the query’s answers are represented. Similar intent is not always a matching predicate or expression.</p></article>
      </section>

      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Level 2 · Lab 28</span><h2>Build the smallest truthful access path</h2><p class="lab-copy">The table model contains 1,000 rows. For partial-index work, 50 are open. Change the engine and query shape to see which rows reach the leaf and whether the optimizer can safely use it.</p></div><span class="lab-badge">modeled estimates</span></div>
        <div class="controls"><div class="control"><label for="predicate-engine">Engine</label><select id="predicate-engine"><option value="postgres">PostgreSQL 18</option><option value="mysql">MySQL 8.4 · InnoDB</option><option value="sqlite">SQLite 3.x</option></select></div><div class="control grow"><label for="predicate-scenario">Design goal</label><select id="predicate-scenario"><option value="partial">Open orders · 5% of table</option><option value="expression">Case-normalized email lookup</option></select></div><div class="control"><label for="predicate-query">Query shape</label><select id="predicate-query"><option value="exact">Matches predicate/expression</option><option value="mismatch">Omits or changes it</option></select></div></div>
        <div class="predicate-flow" aria-live="polite"><div><small>table rows · representative sample</small><div class="predicate-row-grid" id="predicate-rows"></div></div><span>eligible →</span><div><small>index leaf entries</small><div class="predicate-leaf" id="predicate-leaf"></div></div></div>
        <div class="metric-grid compact"><div class="metric"><span>Index entries</span><strong id="predicate-entry-count">—</strong><small>of 1,000 table rows</small></div><div class="metric"><span>Modeled leaf pages</span><strong id="predicate-pages">—</strong><small>100 entries per page</small></div><div class="metric"><span>Index writes / 100 updates</span><strong id="predicate-writes">—</strong><small>illustrative affected rows</small></div></div>
        <pre class="query-box"><code id="predicate-sql"></code></pre>
        <div class="diagnosis" id="predicate-diagnosis"><span class="diagnosis-label">Planner proof</span><p>—</p></div>
      </section>

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Level 3 · Production evidence</span><strong>Index exists; endpoint still scans</strong><span class="severity">predicate mismatch</span></div>
        <div class="predicate-incident"><pre class="evidence"><code id="predicate-evidence"></code></pre><div><h3 id="predicate-incident-title">—</h3><p class="lab-copy" id="predicate-incident-copy">—</p><div class="engine-doc-links"><a href="https://www.postgresql.org/docs/18/indexes-partial.html" target="_blank" rel="noreferrer">PostgreSQL 18 partial indexes ↗</a><a href="https://dev.mysql.com/doc/refman/8.4/en/create-index.html" target="_blank" rel="noreferrer">MySQL 8.4 CREATE INDEX ↗</a><a href="https://sqlite.org/partialindex.html" target="_blank" rel="noreferrer">SQLite partial indexes ↗</a></div></div></div>
      </section>

      <section class="lab"><div class="lab-top"><div><span class="lab-kicker">Level 4 · Prediction check</span><h2>Choose the index the engine can really use</h2><p class="lab-copy">The feedback separates a logically attractive design from one the selected engine can represent and match.</p></div><button class="button" type="button" data-quiz-reset>Reset</button></div><div id="predicate-quiz">${DSL.Quiz.render(CHECK_QUESTIONS, "Predicate and expression check")}</div></section>

      <div class="insight"><span class="insight-mark">!</span><p><strong>Small is only correct when it is complete for the query.</strong> A partial index wins by omitting rows; that same omission is why the optimizer must prove the query cannot need them.</p></div>
      ${DSL.lessonFooter("predicate-indexes")}
    </article>`;
    setupPredicateLab();
    DSL.Quiz.mount(document.getElementById("predicate-quiz"), CHECK_QUESTIONS, { noun: "decision", successTitle: "Designs are engine-aware" });
  }

  function setupPredicateLab() {
    function update() {
      const engineId = document.getElementById("predicate-engine").value;
      const scenario = document.getElementById("predicate-scenario").value;
      const queryShape = document.getElementById("predicate-query").value;
      const plan = indexPlan(engineId, scenario, queryShape);
      const nativeSubset = scenario === "partial" && ENGINES[engineId].partial;

      document.getElementById("predicate-rows").innerHTML = Array.from({ length: 40 }, (_, index) => {
        const qualifies = scenario === "expression" || index < 2;
        return `<i class="${qualifies ? "qualifies" : "excluded"}" title="${qualifies ? "qualifies" : "excluded"}"></i>`;
      }).join("");
      const visibleEntries = nativeSubset ? 2 : 40;
      document.getElementById("predicate-leaf").innerHTML = Array.from({ length: visibleEntries }, (_, index) => `<i class="${index < 2 ? "qualifies" : "extra"}">${scenario === "partial" ? index < 2 ? "open" : "other" : "fx"}</i>`).join("");
      document.getElementById("predicate-entry-count").textContent = `${plan.entries.toLocaleString()} / 1,000`;
      document.getElementById("predicate-pages").textContent = Math.ceil(plan.entries / 100);
      document.getElementById("predicate-writes").textContent = plan.writeEntries;
      document.getElementById("predicate-sql").textContent = plan.sql;
      const diagnosis = document.getElementById("predicate-diagnosis");
      diagnosis.className = `diagnosis ${plan.usable ? "resolved" : "warning"}`;
      diagnosis.innerHTML = `<span class="diagnosis-label">${plan.usable ? "Eligible path" : "Cannot prove match"}</span><p>${plan.verdict}</p>`;

      const engine = ENGINES[engineId].label;
      document.getElementById("predicate-evidence").textContent = productionEvidence(engineId, scenario, queryShape === "exact");
      document.getElementById("predicate-incident-title").textContent = `${engine}: ${plan.usable ? "the stored key matches" : "the access path disappears"}`;
      document.getElementById("predicate-incident-copy").textContent = scenario === "partial"
        ? ENGINES[engineId].partial ? "The partial leaf is compact, but only a query that implies its status predicate may rely on it." : "The composite tree includes every row. It can still be useful, but its storage and write cost differ from a true partial index."
        : "Expression indexes are physical computed keys. Keep application SQL, collation, and deterministic function semantics aligned with the definition.";
    }

    ["predicate-engine", "predicate-scenario", "predicate-query"].forEach((id) => document.getElementById(id).addEventListener("change", update));
    update();
  }

  DSL.registerRenderer("predicate-indexes", renderPredicateIndexes);
})(window.DataSystemsLab);
