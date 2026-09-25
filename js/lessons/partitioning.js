(function registerPartitioningLesson(DSL) {
  "use strict";

  const SCHEMES = {
    monthly: { label: "Range by created_at · monthly", key: "created_at", count: 24 },
    daily: { label: "Range by created_at · daily", key: "created_at", count: 1095 },
    tenant: { label: "Hash by tenant_id", key: "tenant_id", count: 32 },
    status: { label: "List by status", key: "status", count: 5 },
  };

  const QUERIES = {
    recent: { label: "created_at >= now() - 7 days", key: "created_at" },
    tenant: { label: "tenant_id = 42", key: "tenant_id" },
    paid: { label: "status = 'paid'", key: "status" },
    all: { label: "amount > 100 · no partition key", key: "amount" },
  };

  function partitionLabel(schemeId, index) {
    if (schemeId === "monthly") return `2025-${String(index + 1).padStart(2, "0")}`;
    if (schemeId === "daily") return `day ${String(index + 1).padStart(3, "0")}`;
    if (schemeId === "tenant") return `bucket ${String(index).padStart(2, "0")}`;
    return ["new", "paid", "shipped", "refunded", "cancelled"][index];
  }

  function calculatePartitionPlan(schemeId, queryId, hasLocalIndex) {
    const scheme = SCHEMES[schemeId];
    const query = QUERIES[queryId];
    const matchesBounds = scheme.key === query.key;
    let scanned = scheme.count;
    if (matchesBounds) {
      scanned = schemeId === "daily" && queryId === "recent" ? 7 : 1;
    }
    const pruned = scheme.count - scanned;
    const pagesPerPartition = hasLocalIndex ? 8 : 180;
    const dataPages = scanned * pagesPerPartition;
    const planningMs = scheme.count * 0.025 + scanned * 0.04;
    return { scheme, query, matchesBounds, scanned, pruned, dataPages, planningMs, hasLocalIndex };
  }

  function renderPartitioning() {
    const lesson = DSL.getLesson("partitioning");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "Partitioning removes <em>whole branches of work.</em>", "A partitioned table routes rows into child tables using explicit bounds. A matching query predicate lets the planner prune children before execution; an index then narrows rows inside each surviving child.", "Intermediate")}

      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Lab 27 · pruning</span><h2>Route a query across physical partitions</h2><p class="lab-copy">Change the partition key and filter independently. Watch pruning disappear when the predicate does not constrain the bounds, then add a local index to separate the two optimizations.</p></div><span class="lab-badge">bounds first · index second</span></div>
        <div class="controls"><div class="control"><label for="partition-scheme">Partition scheme</label><select id="partition-scheme"><option value="monthly">Range by created_at · 24 months</option><option value="daily">Range by created_at · 1,095 days</option><option value="tenant">Hash by tenant_id · 32 buckets</option><option value="status">List by status · 5 values</option></select></div><div class="control grow"><label for="partition-query">Query predicate</label><select id="partition-query"><option value="recent">created_at · last 7 days</option><option value="tenant">tenant_id = 42</option><option value="paid">status = 'paid'</option><option value="all">amount > 100 · no partition key</option></select></div><div class="control"><label for="partition-index">Inside each child</label><select id="partition-index"><option value="none">No matching index</option><option value="local">Local B-tree on filter</option></select></div><button class="button primary" id="plan-partitions">Plan query</button></div>

        <div class="partition-router"><div class="partition-parent"><small>orders · virtual parent</small><strong id="partition-route-key">route by created_at</strong><span id="partition-query-label">—</span></div><div class="partition-fanout">↓ prune by bounds ↓</div><div class="partition-grid" id="partition-grid" aria-live="polite"></div></div>
        <div class="tuple-legend"><span><i class="partition-scanned"></i>scanned child</span><span><i class="partition-pruned"></i>pruned child</span><span><i class="partition-indexed"></i>local index lookup</span></div>
        <div class="metric-grid compact"><div class="metric"><span>Partitions scanned</span><strong id="partitions-scanned">—</strong><small>executor branches</small></div><div class="metric"><span>Data pages read</span><strong id="partition-pages">—</strong><small>simplified estimate</small></div><div class="metric"><span>Planning overhead</span><strong id="partition-planning">—</strong><small>grows with child count</small></div></div>
        <pre class="query-box"><code id="partition-explain">Append\n  Subplans Removed: —</code></pre>
        <div class="diagnosis" id="partition-diagnosis"><span class="diagnosis-label">Ready</span><p>Plan the query to see which physical children survive.</p></div>
      </section>

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Production drill</span><strong>Delete 90 days of event history</strong><span class="severity">retention</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Row operation → partition operation</span><h2>Retention can be a data-layout decision</h2><p class="lab-copy">Compare deleting every expired row with detaching and dropping already-isolated time partitions. The numbers are directional estimates; lock duration and filesystem behavior require production rehearsal.</p></div><span class="lab-badge">90-day window</span></div>
        <div class="controls"><div class="control"><label for="retention-method">Retention method</label><select id="retention-method"><option value="delete">DELETE expired rows</option><option value="drop">Detach + drop old partitions</option></select></div><div class="control grow"><label for="retention-rows">Expired rows</label><select id="retention-rows"><option value="5000000">5 million</option><option value="50000000" selected>50 million</option><option value="500000000">500 million</option></select></div><button class="button primary" id="run-retention">Run model</button></div>
        <div class="retention-strip" id="retention-strip"><span>old</span><i></i><i></i><i></i><i class="keep"></i><i class="keep"></i><i class="keep"></i><span>current</span></div>
        <div class="metric-grid compact"><div class="metric"><span>Rows individually changed</span><strong id="retention-touched">—</strong><small>tuple work</small></div><div class="metric"><span>WAL generated</span><strong id="retention-wal">—</strong><small>illustrative estimate</small></div><div class="metric"><span>Cleanup debt</span><strong id="retention-debt">—</strong><small>what remains afterward</small></div></div>
        <div class="diagnosis" id="retention-diagnosis"><span class="diagnosis-label">Investigation</span><p>Compare the work units. Partitioning pays when your operational boundary matches the partition boundary.</p></div>
      </section>

      ${DSL.EngineLens.render({ id: "partition-engine-lens", title: "Pruning is portable; partition ownership is not", copy: "PostgreSQL and MySQL both prove that bounds cannot match, but their index and constraint rules differ. SQLite provides no native declarative partitioned-table layer, making manual sharding an application architecture." })}
      <section class="concept-grid">
        <article class="concept-card"><span class="concept-number">01 · Bounds</span><h3>Pruning is not an index scan</h3><p>Partition bounds decide which child tables can contain a result. Indexes are optional, separate access paths inside those children.</p></article>
        <article class="concept-card"><span class="concept-number">02 · Shape</span><h3>Match dominant operations</h3><p>Choose a key that appears in high-value filters or lifecycle operations—not merely a column with many distinct values.</p></article>
        <article class="concept-card"><span class="concept-number">03 · Cost</span><h3>More is not always better</h3><p>Thousands of children add planning work and metadata memory. A query missing the partition key may fan out across all of them.</p></article>
      </section>

      <div class="insight"><span class="insight-mark">!</span><p><strong>Partitioning is an operational contract.</strong> It is most valuable when query filters, data placement, maintenance, and retention share the same boundary. If they do not, it can turn one table into many tables the planner must still visit.</p></div>
      ${DSL.lessonFooter("partitioning")}
    </article>`;
    setupPartitionLab();
    setupRetentionLab();
    DSL.EngineLens.mount("partition-engine-lens", partitionEngineConfig());
  }

  function partitionEngineConfig() {
    return { engines: [
      {
        id: "postgres", label: "PostgreSQL", version: "PostgreSQL 18", mechanism: "Virtual parent + physical child tables and child indexes", signature: "Append; Subplans Removed; runtime pruning can vary by parameter",
        diagram: [{ kicker: "predicate", label: "created_at ≥ $1", detail: "bound expression" }, { kicker: "parent", label: "orders", detail: "no row storage" }, { kicker: "prune", label: "prove bounds", detail: "plan/init/runtime" }, { kicker: "child", label: "orders_2026_09", detail: "scan or local index" }],
        steps: [{ title: "Route through a virtual parent", copy: "The partitioned parent describes bounds; actual rows and index entries live in child relations." }, { title: "Prove exclusions from bounds", copy: "Pruning uses partition bounds—not the presence of an index—to remove impossible children." }, { title: "Prune at multiple times", copy: "Known constants can prune during planning; prepared parameters and nested-loop values can trigger initialization or execution-time pruning." }, { title: "Choose access within a child", copy: "Each surviving partition can still use a sequential scan or its own physical index." }],
        counters: [{ label: "Parent storage", value: "virtual", note: "children own rows" }, { label: "Pruning evidence", value: "Subplans Removed", note: "EXPLAIN" }, { label: "Indexes", value: "per child", note: "parent definition virtual" }],
        incident: { title: "Prepared query prunes at execution, not plan display", copy: "A parameter value is unknown during generic planning. Inspect loops and “never executed” children in EXPLAIN ANALYZE before declaring pruning broken.", evidence: "Append\n  Subplans Removed: 10\n  -> Index Scan on orders_2026_09 (actual loops=1)\n  -> Seq Scan on orders_2026_08 (never executed)" },
        challenge: { prompt: "Can adding an index on created_at make PostgreSQL partition pruning happen?", options: ["Yes; indexes define bounds", "No; bounds drive pruning", "Only with BRIN"], answer: 1, why: "Partition bounds determine which children are impossible. An index only changes access inside children that survive." },
        source: { label: "partitioning documentation", url: "https://www.postgresql.org/docs/18/ddl-partitioning.html" },
      },
      {
        id: "mysql", label: "MySQL / InnoDB", version: "MySQL 8.4 · InnoDB", mechanism: "Native RANGE/LIST/HASH/KEY partitions", signature: "EXPLAIN partitions column lists survivors",
        diagram: [{ kicker: "predicate", label: "region_code 126..129", detail: "constant range" }, { kicker: "expression", label: "partition function", detail: "map values" }, { kicker: "prune", label: "p0,p3 removed", detail: "impossible" }, { kicker: "execute", label: "p1,p2", detail: "local access" }],
        steps: [{ title: "Evaluate the partition expression", copy: "The optimizer reduces supported equality or range predicates to partition identifiers." }, { title: "Build the survivor list", copy: "Only partitions that can contain those values appear in the execution set." }, { title: "Expose the list in EXPLAIN", copy: "The partitions column is the quickest confirmation of the pruning decision." }, { title: "Respect key restrictions", copy: "Unique-key design and partition-key rules constrain schemas; verify the exact MySQL 8.4 limitations before migration." }],
        counters: [{ label: "Evidence", value: "partitions", note: "EXPLAIN column" }, { label: "InnoDB support", value: "native", note: "MySQL 8.4" }, { label: "Explicit target", value: "PARTITION(...) ", note: "manual selection" }],
        incident: { title: "A function-wrapped predicate scans every partition", copy: "The data is range-partitioned by date, but the predicate form cannot be reduced to the partition expression. EXPLAIN lists every child.", evidence: "EXPLAIN SELECT * FROM events\nWHERE DATE_FORMAT(created_at,'%Y-%m')='2026-09';\npartitions: p2025_01,...,p2026_09" },
        challenge: { prompt: "Where do you confirm MySQL's chosen partition set?", options: ["EXPLAIN partitions", "SHOW BINARY LOGS", "key_len only"], answer: 0, why: "The partitions field identifies which partitions the optimizer expects to access." },
        source: { label: "partition-pruning documentation", url: "https://dev.mysql.com/doc/refman/8.4/en/partitioning-pruning.html" },
      },
      {
        id: "sqlite", label: "SQLite", version: "SQLite 3.x · architectural contrast", mechanism: "No native declarative partitioned-table abstraction", signature: "manual tables/databases + UNION ALL or application routing",
        diagram: [{ kicker: "application", label: "route by month", detail: "your metadata" }, { kicker: "schema", label: "events_2026_09", detail: "separate table" }, { kicker: "query", label: "UNION ALL", detail: "manual branches" }, { kicker: "planner", label: "plan each branch", detail: "no native bounds" }],
        steps: [{ title: "Define the routing contract yourself", copy: "Separate tables or attached database files can model shards, but SQLite does not own a declarative parent and bound catalog." }, { title: "Generate targeted SQL", copy: "The application or a view decides which tables appear in a UNION ALL query." }, { title: "Plan each named branch", copy: "SQLite can use indexes and constant simplification within branches, but it has no native partition-pruning protocol equivalent to PostgreSQL or MySQL." }, { title: "Own lifecycle and integrity", copy: "Creating, dropping, migrating, and enforcing cross-shard uniqueness become application responsibilities." }],
        counters: [{ label: "Native parent", value: "none", note: "manual design" }, { label: "Routing owner", value: "application", note: "or generated SQL" }, { label: "Cross-shard UNIQUE", value: "not global", note: "design explicitly" }],
        incident: { title: "A view fans a dashboard across 84 monthly tables", copy: "The abstraction looks like one table, but every named UNION branch is planned. Generate the month list from the time predicate rather than querying the all-history view.", evidence: "CREATE VIEW events_all AS\nSELECT * FROM events_2025_01 UNION ALL ...;\n-- app query names only relevant shards" },
        challenge: { prompt: "Who guarantees that a manually sharded SQLite query includes every required month?", options: ["A native partition catalog", "The application/schema design", "The WAL checkpointer"], answer: 1, why: "Without native declarative partition bounds, routing correctness belongs to the application and migration tooling." },
        source: { label: "query-planner documentation", url: "https://www.sqlite.org/queryplanner.html" },
      },
    ] };
  }

  function setupPartitionLab() {
    function update() {
      const schemeId = document.getElementById("partition-scheme").value;
      const queryId = document.getElementById("partition-query").value;
      const hasLocalIndex = document.getElementById("partition-index").value === "local";
      const plan = calculatePartitionPlan(schemeId, queryId, hasLocalIndex);
      const visibleCount = Math.min(plan.scheme.count, 16);
      const visibleScanned = plan.scanned === plan.scheme.count ? visibleCount : Math.min(plan.scanned, visibleCount);

      document.getElementById("partition-route-key").textContent = `route by ${plan.scheme.key}`;
      document.getElementById("partition-query-label").textContent = `WHERE ${plan.query.label}`;
      document.getElementById("partition-grid").innerHTML = `${Array.from({ length: visibleCount }, (_, index) => {
        const scanned = index < visibleScanned;
        return `<div class="partition-child ${scanned ? "scanned" : "pruned"} ${scanned && hasLocalIndex ? "indexed" : ""}"><small>${partitionLabel(schemeId, index)}</small><strong>${scanned ? hasLocalIndex ? "index → rows" : "scan rows" : "pruned"}</strong></div>`;
      }).join("")}${plan.scheme.count > visibleCount ? `<div class="partition-overflow">+${(plan.scheme.count - visibleCount).toLocaleString()} more children</div>` : ""}`;

      document.getElementById("partitions-scanned").textContent = `${plan.scanned.toLocaleString()} / ${plan.scheme.count.toLocaleString()}`;
      document.getElementById("partition-pages").textContent = plan.dataPages.toLocaleString();
      document.getElementById("partition-planning").textContent = `${plan.planningMs.toFixed(1)} ms`;
      document.getElementById("partition-explain").textContent = `Append on orders  (children=${plan.scheme.count.toLocaleString()})\n  Subplans Removed: ${plan.pruned.toLocaleString()}\n  Children executed: ${plan.scanned.toLocaleString()}${hasLocalIndex ? "\n  → Index Scan inside each executed child" : "\n  → Sequential Scan inside each executed child"}`;

      const diagnosis = document.getElementById("partition-diagnosis");
      if (!plan.matchesBounds) {
        diagnosis.className = "diagnosis warning";
        diagnosis.innerHTML = `<span class="diagnosis-label">Fan-out</span><p>The predicate constrains ${plan.query.key}, not the ${plan.scheme.key} partition bounds, so all ${plan.scheme.count.toLocaleString()} children survive. ${hasLocalIndex ? "Local indexes reduce row work inside each child but do not create pruning." : "Every child also scans its rows."}</p>`;
      } else if (plan.scheme.count > 500) {
        diagnosis.className = "diagnosis warning";
        diagnosis.innerHTML = `<span class="diagnosis-label">Pruned, with overhead</span><p>Bounds reduce execution to ${plan.scanned} daily partitions, but the planner still manages ${plan.scheme.count.toLocaleString()} children. Measure planning time and metadata memory before choosing extremely fine granularity.</p>`;
      } else {
        diagnosis.className = "diagnosis resolved";
        diagnosis.innerHTML = `<span class="diagnosis-label">Effective pruning</span><p>The predicate matches the ${plan.scheme.key} bounds, removing ${plan.pruned.toLocaleString()} children before execution. ${hasLocalIndex ? "The local index then narrows rows inside the remaining child." : "The remaining child still performs a row scan."}</p>`;
      }
    }

    document.getElementById("plan-partitions").addEventListener("click", update);
    ["partition-scheme", "partition-query", "partition-index"].forEach((id) => document.getElementById(id).addEventListener("change", update));
    update();
  }

  function setupRetentionLab() {
    document.getElementById("run-retention").addEventListener("click", () => {
      const rows = Number(document.getElementById("retention-rows").value);
      const drop = document.getElementById("retention-method").value === "drop";
      const walGiB = drop ? 0.02 : rows * 420 / 1024 / 1024 / 1024;
      document.getElementById("retention-touched").textContent = drop ? "0" : rows.toLocaleString();
      document.getElementById("retention-wal").textContent = drop ? "metadata only" : `${walGiB.toFixed(1)} GiB`;
      document.getElementById("retention-debt").textContent = drop ? "none per row" : "dead tuples + vacuum";
      document.getElementById("retention-strip").classList.toggle("dropped", drop);
      const diagnosis = document.getElementById("retention-diagnosis");
      diagnosis.className = `diagnosis ${drop ? "resolved" : "warning"}`;
      diagnosis.innerHTML = drop
        ? `<span class="diagnosis-label">Boundary aligned</span><p>Detaching and dropping old time partitions avoids changing ${rows.toLocaleString()} rows individually. It still needs a deliberate lock and dependency plan, but it creates no row-by-row dead-tuple backlog.</p>`
        : `<span class="diagnosis-label">Row-by-row cost</span><p>The delete creates ${rows.toLocaleString()} obsolete row versions, about ${walGiB.toFixed(1)} GiB of modeled WAL, and follow-up vacuum work. Batch carefully—or redesign future data so retention maps to partition boundaries.</p>`;
    });
  }

  DSL.registerRenderer("partitioning", renderPartitioning);
})(window.DataSystemsLab);
