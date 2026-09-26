(function registerIndexLayoutLesson(DSL) {
  "use strict";

  const HEAP_ROWS = [
    18, 42, 73, 5, 91, 12, 64, 28,
    39, 77, 43, 8, 55, 21, 88, 34,
    69, 3, 44, 81, 14, 58, 95, 26,
    72, 31, 45, 9, 61, 24, 85, 37,
  ];
  const MATCHING_KEYS = new Set([43, 44, 45]);

  const MODES = {
    heap: {
      name: "Heap table · no index",
      pageVisits: [1, 2, 3, 4, 5, 6, 7, 8],
      indexReads: 0,
      latency: "320 ms",
      explanation: "Without an index, the engine cannot know where keys 43–45 live. It reads every table page and filters each row.",
    },
    secondary: {
      name: "Secondary B-tree · heap unchanged",
      pageVisits: [3, 5, 7],
      indexReads: 1,
      latency: "150 ms",
      explanation: "The secondary index finds three row pointers quickly, but the rows remain scattered across heap pages 3, 5, and 7.",
    },
    clustered: {
      name: "Clustered B-tree · rows reordered",
      pageVisits: [5],
      indexReads: 1,
      latency: "70 ms",
      explanation: "Clustering places nearby keys on the same table page. One ordered leaf lookup leads to one contiguous data-page read.",
    },
  };

  function rowsForMode(mode) {
    return mode === "clustered" ? [...HEAP_ROWS].sort((a, b) => a - b) : HEAP_ROWS;
  }

  function physicalPageForKey(key, mode) {
    return Math.floor(rowsForMode(mode).indexOf(key) / 4) + 1;
  }

  function indexMarkup(mode) {
    if (mode === "heap") {
      return `<div class="index-empty"><strong>No index pages</strong><span>The engine has no map from key to row location.</span></div>`;
    }
    return `<div class="index-leaf" aria-label="Sorted index leaf entries">
      <span class="index-ellipsis">…</span>
      ${[42, 43, 44, 45, 55].map((key) => {
        const page = physicalPageForKey(key, mode);
        return `<span class="index-entry ${MATCHING_KEYS.has(key) ? "query-match" : ""}" data-index-key="${key}"><strong>${key}</strong><small>→ P${page}</small></span>`;
      }).join("")}
      <span class="index-ellipsis">…</span>
    </div>`;
  }

  function pagesMarkup(mode) {
    const rows = rowsForMode(mode);
    return Array.from({ length: 8 }, (_, pageIndex) => {
      const pageRows = rows.slice(pageIndex * 4, pageIndex * 4 + 4);
      return `<div class="physical-page" data-physical-page="${pageIndex + 1}">
        <span class="physical-page-label">Page ${pageIndex + 1}</span>
        <div class="physical-records">${pageRows.map((key) => `<span class="physical-record ${MATCHING_KEYS.has(key) ? "query-match" : ""}" data-record-key="${key}">${key}</span>`).join("")}</div>
      </div>`;
    }).join("");
  }

  function renderIndexLayout() {
    const lesson = DSL.getLesson("index-layout");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "An index may map rows—or <em>move them</em>.", "Secondary and clustered indexes both keep keys ordered, but they affect physical storage differently. Compare the layouts, then measure the page reads for one range query.")}
      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">${DSL.labLabel("index-layout")}</span><h2>See where the rows live</h2><p class="lab-copy">The query needs customer IDs 43–45. Change the storage design and watch both the table pages and the I/O path.</p></div><span class="lab-badge">logical key → physical page</span></div>
        <div class="query-box"><code>SELECT * FROM customers WHERE id BETWEEN 43 AND 45 ORDER BY id;</code></div>
        <div class="controls">
          <div class="control grow"><label for="physical-layout-mode">Storage design</label><select id="physical-layout-mode"><option value="heap">Heap table · no index</option><option value="secondary">Secondary B-tree · table stays in insertion order</option><option value="clustered">Clustered B-tree · table ordered by ID</option></select></div>
          <button class="button primary" id="run-physical-query">Run range query</button>
        </div>
        <div class="layout-explainer">
          <div class="layout-section"><div class="layout-section-label"><span>1 · Lookup structure</span><strong id="index-layout-label">none</strong></div><div id="physical-index-view"></div></div>
          <div class="layout-flow-arrow" aria-hidden="true">↓ row pointer(s)</div>
          <div class="layout-section"><div class="layout-section-label"><span>2 · Physical table pages on disk</span><strong id="table-layout-label">insertion order</strong></div><div class="physical-page-grid" id="physical-page-grid"></div></div>
        </div>
        <div class="metric-grid compact">
          <div class="metric"><span>Index pages read</span><strong id="physical-index-reads">—</strong><small>to locate the range</small></div>
          <div class="metric"><span>Data pages read</span><strong id="physical-data-reads">—</strong><small>to fetch complete rows</small></div>
          <div class="metric"><span>Illustrative latency</span><strong id="physical-latency">—</strong><small>same query, different layout</small></div>
        </div>
        <div class="diagnosis" id="physical-diagnosis" aria-live="polite"><span class="diagnosis-label">Mental model</span><p>A secondary index is a separate sorted structure. Select a design to see whether the table rows themselves move.</p></div>
      </section>
      <section class="concept-grid">
        <div class="concept-card"><span class="concept-number">heap</span><h3>Rows follow writes</h3><p>New rows occupy available space. A range of logical keys may be scattered across many physical pages.</p></div>
        <div class="concept-card"><span class="concept-number">secondary</span><h3>Keys point to rows</h3><p>The index is ordered, but following its pointers can still cause random reads across the table.</p></div>
        <div class="concept-card"><span class="concept-number">clustered</span><h3>Rows follow the key</h3><p>The table’s physical order matches one index, turning key ranges into sequential page access.</p></div>
      </section>
      ${DSL.EngineLens.render({ id: "layout-engine-lens", title: "What does an index pointer mean in each engine?", copy: "The portable idea is an ordered lookup structure. The destination of that lookup—and whether the row itself lives in the tree—is an engine decision with schema consequences." })}
      <div class="insight"><span class="insight-mark">!</span><p><strong>Engine details differ:</strong> InnoDB clusters rows by primary key. A SQL Server clustered index stores table rows at its leaf level. PostgreSQL heaps stay separate from indexes; <code>CLUSTER</code> performs a one-time reorder that later writes do not automatically preserve.</p></div>
      ${DSL.lessonFooter("index-layout")}
    </article>`;
    setupIndexLayoutLab();
    DSL.EngineLens.mount("layout-engine-lens", layoutEngineConfig());
  }

  function layoutEngineConfig() {
    return { engines: [
      {
        id: "postgres", label: "PostgreSQL", version: "PostgreSQL 18", mechanism: "Heap table + separate index files", signature: "leaf key → heap TID (block, offset)",
        diagram: [{ kicker: "predicate", label: "id = 44", detail: "logical key" }, { kicker: "index page", label: "B-tree leaf", detail: "key + TID" }, { kicker: "pointer", label: "(5, 3)", detail: "block, slot" }, { kicker: "heap", label: "tuple", detail: "row bytes" }],
        steps: [{ title: "Search the B-tree", copy: "Internal pages route the key to a leaf entry." }, { title: "Read the leaf entry", copy: "The leaf stores a heap tuple identifier, not the complete heap row." }, { title: "Follow the TID", copy: "The block and item offset identify a physical heap tuple version." }, { title: "Check visibility and return", copy: "MVCC visibility is decided at the heap unless an index-only scan can rely on the visibility map." }],
        counters: [{ label: "Tree traversals", value: "1", note: "modeled" }, { label: "Heap fetches", value: "1", note: "unless index-only" }, { label: "PK changes layout", value: "no", note: "heap remains separate" }],
        incident: { title: "The range is ordered; the heap is scattered", copy: "An index scan finds keys cheaply but still performs random heap fetches. Buffers reveal the physical work the latency chart hides.", evidence: "Index Scan using customers_pkey\n  Index Cond: (id BETWEEN 43 AND 45)\n  Buffers: shared hit=2 read=3" },
        challenge: { prompt: "You add a PRIMARY KEY to a 500 GB PostgreSQL heap. What happens to existing row order?", options: ["Heap rows reorder by key", "A separate unique B-tree is built", "Every CTID becomes the key"], answer: 1, why: "A PostgreSQL primary key is enforced by a unique index, but ordinary heap storage stays separate and is not automatically ordered by that key." },
        source: { label: "storage documentation", url: "https://www.postgresql.org/docs/18/storage.html" },
      },
      {
        id: "mysql", label: "MySQL / InnoDB", version: "MySQL 8.4 · InnoDB", mechanism: "Clustered primary-key B-tree", signature: "secondary key → primary key → clustered leaf row",
        diagram: [{ kicker: "predicate", label: "email = …", detail: "secondary key" }, { kicker: "secondary leaf", label: "email + PK", detail: "PK copied here" }, { kicker: "clustered tree", label: "search PK", detail: "second traversal" }, { kicker: "leaf", label: "complete row", detail: "row data" }],
        steps: [{ title: "Search the secondary tree", copy: "The email index finds an entry containing the row's primary-key columns." }, { title: "Recover the primary key", copy: "InnoDB secondary records use the primary key as their row locator." }, { title: "Traverse the clustered index", copy: "A second B-tree lookup follows that primary key." }, { title: "Read the clustered leaf", copy: "The clustered leaf record contains the table row itself." }],
        counters: [{ label: "Tree traversals", value: "2", note: "secondary lookup" }, { label: "Locator", value: "primary key", note: "copied into leaves" }, { label: "Rows ordered by", value: "clustered key", note: "usually the PK" }],
        incident: { title: "A wide primary key silently enlarged every index", copy: "A 36-character UUID primary key is repeated in each secondary index record, reducing fan-out and increasing cache and write cost.", evidence: "SHOW INDEX FROM orders;\nPRIMARY(id)\nidx_status_created(status, created_at)\n-- each secondary entry also carries id" },
        challenge: { prompt: "You replace a wide text primary key with a compact bigint. Which structure benefits?", options: ["Only the PRIMARY index", "Every secondary index entry", "Only the redo log"], answer: 1, why: "InnoDB stores the primary-key columns in every secondary index record, so a shorter primary key can shrink all secondary indexes." },
        source: { label: "InnoDB index documentation", url: "https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html" },
      },
      {
        id: "sqlite", label: "SQLite", version: "SQLite 3.x", mechanism: "Rowid table B-tree or WITHOUT ROWID index B-tree", signature: "index key → rowid (or PRIMARY KEY) → table B-tree",
        diagram: [{ kicker: "predicate", label: "word = …", detail: "index key" }, { kicker: "index b-tree", label: "key + rowid", detail: "ordinary table" }, { kicker: "table b-tree", label: "rowid search", detail: "integer key" }, { kicker: "leaf", label: "record payload", detail: "column bytes" }],
        steps: [{ title: "Choose the table form", copy: "Ordinary tables use a 64-bit rowid as the table B-tree key." }, { title: "Read the index row key", copy: "A secondary index appends the rowid; WITHOUT ROWID indexes append the declared primary key instead." }, { title: "Search the table B-tree", copy: "The rowid lookup locates the record payload in an ordinary table." }, { title: "Contrast WITHOUT ROWID", copy: "A WITHOUT ROWID table stores rows in an index B-tree keyed by its primary key, sometimes eliminating a duplicate tree." }],
        counters: [{ label: "Ordinary lookup", value: "2 trees", note: "secondary + table" }, { label: "INTEGER PRIMARY KEY", value: "rowid alias", note: "ordinary table" }, { label: "WITHOUT ROWID", value: "PK tree", note: "clustered form" }],
        incident: { title: "A text primary key occupied two B-trees", copy: "In an ordinary rowid table, a non-integer PRIMARY KEY is a unique index in addition to the rowid table. Testing WITHOUT ROWID can remove duplication for the right schema.", evidence: "CREATE TABLE wordcount(\n  word TEXT PRIMARY KEY, cnt INTEGER\n) WITHOUT ROWID;\n-- one PK-keyed table structure" },
        challenge: { prompt: "Which declaration makes id an alias for the rowid in an ordinary SQLite table?", options: ["id INT PRIMARY KEY", "id INTEGER PRIMARY KEY", "id TEXT UNIQUE"], answer: 1, why: "The exact INTEGER PRIMARY KEY declaration aliases the rowid; other primary-key spellings normally create a separate uniqueness index." },
        source: { label: "file-format documentation", url: "https://www.sqlite.org/fileformat.html" },
      },
    ] };
  }

  function setupIndexLayoutLab() {
    const modeSelect = document.getElementById("physical-layout-mode");
    const runButton = document.getElementById("run-physical-query");

    function resetVisualization() {
      DSL.clearTimers();
      const mode = modeSelect.value;
      const clustered = mode === "clustered";
      document.getElementById("physical-index-view").innerHTML = indexMarkup(mode);
      document.getElementById("physical-page-grid").innerHTML = pagesMarkup(mode);
      document.getElementById("index-layout-label").textContent = mode === "heap" ? "none" : "sorted keys + pointers";
      document.getElementById("table-layout-label").textContent = clustered ? "physically sorted by ID" : "unchanged insertion order";
      document.getElementById("physical-index-reads").textContent = "—";
      document.getElementById("physical-data-reads").textContent = "—";
      document.getElementById("physical-latency").textContent = "—";
      const diagnosis = document.getElementById("physical-diagnosis");
      diagnosis.className = "diagnosis";
      diagnosis.innerHTML = `<span class="diagnosis-label">Physical effect</span><p>${clustered ? "The records moved: IDs are now physically sorted across pages." : mode === "secondary" ? "Only the index was added. Compare the page contents with the heap: no table row moved." : "Rows remain in insertion order, with no separate lookup structure."}</p>`;
    }

    function runQuery() {
      DSL.clearTimers();
      const mode = modeSelect.value;
      const design = MODES[mode];
      const indexReads = document.getElementById("physical-index-reads");
      const dataReads = document.getElementById("physical-data-reads");
      const latency = document.getElementById("physical-latency");
      const diagnosis = document.getElementById("physical-diagnosis");
      document.querySelectorAll(".physical-page").forEach((page) => page.classList.remove("page-read"));
      document.querySelectorAll(".index-entry").forEach((entry) => entry.classList.remove("index-read"));
      runButton.disabled = true;
      indexReads.textContent = String(design.indexReads);
      dataReads.textContent = "0";
      latency.textContent = "…";
      diagnosis.className = "diagnosis investigating";
      diagnosis.innerHTML = `<span class="diagnosis-label">Executing</span><p>${design.name}: following the available access path…</p>`;
      if (mode !== "heap") document.querySelectorAll(".index-entry.query-match").forEach((entry) => entry.classList.add("index-read"));

      design.pageVisits.forEach((pageNumber, index) => {
        DSL.setTimer(() => {
          document.querySelector(`[data-physical-page="${pageNumber}"]`).classList.add("page-read");
          dataReads.textContent = String(index + 1);
          if (index === design.pageVisits.length - 1) {
            latency.textContent = design.latency;
            runButton.disabled = false;
            diagnosis.className = `diagnosis ${mode === "heap" ? "warning" : "resolved"}`;
            diagnosis.innerHTML = `<span class="diagnosis-label">${mode === "heap" ? "Full scan" : "Observable effect"}</span><p>${design.explanation}</p>`;
          }
        }, 140 + index * 170);
      });
    }

    modeSelect.addEventListener("change", resetVisualization);
    runButton.addEventListener("click", runQuery);
    resetVisualization();
  }

  DSL.registerRenderer("index-layout", renderIndexLayout);
})(window.DataSystemsLab);
