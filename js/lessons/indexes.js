(function registerIndexLessons(DSL) {
  "use strict";

  const indexTypes = {
    btree: {
      name: "B-tree",
      visual: `<div class="mini-btree"><div class="mini-node">30 | 60</div><div class="mini-row"><div class="mini-node">05 · 12 · 27</div><div class="mini-node">31 · 44 · 52</div><div class="mini-node">63 · 84 · 96</div></div></div>`,
      point: "Good", range: "Excellent", writes: "Good", ordered: "Yes",
      note: "The general-purpose default. Sorted keys support equality, ranges, ordering, and prefixes.",
    },
    hash: {
      name: "Hash index",
      visual: `<div class="hash-buckets">${[["00", "user:8"], ["01", "user:21 → user:40"], ["10", "user:13"], ["11", "user:7 → user:18"]].map((entry) => `<div class="bucket"><span class="bucket-key">${entry[0]}</span><span class="bucket-value">${entry[1]}</span></div>`).join("")}</div>`,
      point: "Excellent", range: "Poor", writes: "Excellent", ordered: "No",
      note: "Fast direct lookup when the full key is known. Hashing destroys useful ordering.",
    },
    lsm: {
      name: "LSM tree",
      visual: `<div class="lsm-levels"><div class="lsm-level"><span class="lsm-label">RAM</span><div class="sstable" style="width:35%">memtable</div></div><div class="lsm-level"><span class="lsm-label">L0</span><div class="sstable" style="width:43%">SSTable</div><div class="sstable" style="width:31%">SSTable</div></div><div class="lsm-level"><span class="lsm-label">L1</span><div class="sstable" style="width:80%">merged sorted run</div></div><div class="lsm-level"><span class="lsm-label">L2</span><div class="sstable" style="width:100%">compacted run</div></div></div>`,
      point: "Good", range: "Good", writes: "Excellent", ordered: "Yes",
      note: "Buffers writes in memory, then merges sorted files. Great write throughput; compaction is the trade-off.",
    },
    inverted: {
      name: "Inverted index",
      visual: `<div class="inverted-visual">${[["database", [1, 4, 8]], ["index", [1, 2, 8, 9]], ["query", [2, 5, 9]]].map(([term, ids]) => `<div class="term-row"><span class="term">${term}</span><span class="postings">${ids.map((id) => `<i class="posting">d${id}</i>`).join("")}</span></div>`).join("")}</div>`,
      point: "By term", range: "Poor", writes: "Mixed", ordered: "No",
      note: "Maps each token to matching documents. The foundation of full-text search systems.",
    },
  };

  function treeMarkup() {
    return `<svg class="tree-connectors" aria-hidden="true"><line x1="50%" y1="39%" x2="20%" y2="65%" data-edge="left"/><line x1="50%" y1="39%" x2="50%" y2="65%" data-edge="middle"/><line x1="50%" y1="39%" x2="80%" y2="65%" data-edge="right"/></svg>
      <div class="btree">
        <div class="tree-row"><div class="tree-node" data-node="root" data-label="ROOT PAGE"><span class="tree-key">30</span><span class="tree-key">60</span></div></div>
        <div class="tree-row">
          <div class="tree-node" data-node="left" data-label="LEAF PAGE">${[5, 12, 19, 27].map((key) => `<span class="tree-key" data-key="${key}">${key}</span>`).join("")}</div>
          <div class="tree-node" data-node="middle" data-label="LEAF PAGE">${[31, 38, 44, 52].map((key) => `<span class="tree-key" data-key="${key}">${key}</span>`).join("")}</div>
          <div class="tree-node" data-node="right" data-label="LEAF PAGE">${[63, 71, 84, 96].map((key) => `<span class="tree-key" data-key="${key}">${key}</span>`).join("")}</div>
        </div>
      </div>`;
  }

  function renderBtree() {
    const lesson = DSL.getLesson("btree");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "Walk a B-tree, page by page.", "A B-tree keeps sorted keys in a shallow hierarchy. Each node is sized to a storage page, so every step represents one page read.")}
      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Lab 03</span><h2>Trace an index lookup</h2><p class="lab-copy">Search for a key. The root narrows the range; one leaf page finishes the lookup. Compare that with reading every row.</p></div><span class="lab-badge">O(log n)</span></div>
        <div class="controls"><div class="control grow"><label for="lookup-key">Search key</label><select id="lookup-key">${[5, 12, 19, 27, 31, 38, 44, 52, 63, 71, 84, 96].map((value) => `<option ${value === 44 ? "selected" : ""}>${value}</option>`).join("")}</select></div><button class="button primary" id="run-lookup">Run lookup</button><button class="button" id="random-key">Random key</button></div>
        <div class="viz-stage" id="tree-stage">${treeMarkup()}</div>
        <div class="viz-caption"><span class="live-status"><i class="pulse" id="tree-pulse"></i><span id="tree-status" aria-live="polite">Choose a key to begin</span></span><span class="io-counter"><strong id="io-count">0</strong> page reads</span></div>
      </section>

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Production drill</span><strong>Tenant activity API timing out</strong><span class="severity">p95 3.2s</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Symptom → composite key order</span><h2>“We already have an index.” So why is it scanning?</h2><p class="lab-copy">The endpoint filters one tenant and a time range. Its existing index puts <code>status</code> between those fields. Compare that gap with an index whose leading columns match the query.</p></div><span class="lab-badge">EXPLAIN</span></div>
        <div class="query-box"><code>SELECT * FROM events<br>WHERE tenant_id = 'acme' AND created_at &gt; now() - interval '1 day'<br>ORDER BY created_at DESC LIMIT 50;</code></div>
        <div class="controls"><div class="control grow"><label for="composite-index">Index under test</label><select id="composite-index"><option value="gap">(tenant_id, status, created_at)</option><option value="aligned">(tenant_id, created_at DESC) INCLUDE (type)</option></select></div><button class="button primary" id="run-composite">Run EXPLAIN ANALYZE</button></div>
        <div class="key-order" id="key-order" aria-label="Composite index key order"></div>
        <div class="leaf-scan" id="leaf-scan" aria-label="Index leaf pages scanned" aria-live="polite"></div>
        <div class="metric-grid compact"><div class="metric"><span>Leaf pages</span><strong id="composite-pages">—</strong><small>read from the index</small></div><div class="metric"><span>Rows inspected</span><strong id="composite-rows">—</strong><small>before LIMIT 50</small></div><div class="metric"><span>Execution</span><strong id="composite-time">—</strong><small>simplified estimate</small></div></div>
        <div class="diagnosis" id="composite-diagnosis"><span class="diagnosis-label">Investigation</span><p>Run both designs and watch where the B-tree can stop scanning.</p></div>
      </section>

      <section class="concept-grid">
        <div class="concept-card"><span class="concept-number">root</span><h3>Start broad</h3><p>Separator keys decide which child page could contain the value.</p></div>
        <div class="concept-card"><span class="concept-number">prefix</span><h3>Order defines reach</h3><p>A composite index narrows efficiently while query predicates match its leading key order.</p></div>
        <div class="concept-card"><span class="concept-number">leaf</span><h3>Stop early</h3><p>A well-aligned range reads adjacent leaf entries and stops as soon as LIMIT is satisfied.</p></div>
      </section>
      <div class="insight"><span class="insight-mark">!</span><p><strong>Why this scales:</strong> a shallow tree finds the start quickly; the real production win often comes from how little of the leaf range and table must be touched afterward.</p></div>
      ${DSL.lessonFooter("btree")}
    </article>`;
    setupBtreeLab();
    setupCompositeIndexLab();
  }

  function setupBtreeLab() {
    const values = [5, 12, 19, 27, 31, 38, 44, 52, 63, 71, 84, 96];
    const select = document.getElementById("lookup-key");

    function runLookup() {
      DSL.clearTimers();
      document.querySelectorAll(".tree-node,.tree-key").forEach((element) => element.classList.remove("visited", "found", "match"));
      document.querySelectorAll(".tree-connectors line").forEach((element) => element.classList.remove("active"));
      const key = Number(select.value);
      const branch = key < 30 ? "left" : key < 60 ? "middle" : "right";
      const pulse = document.getElementById("tree-pulse");
      const status = document.getElementById("tree-status");
      const reads = document.getElementById("io-count");
      pulse.classList.add("active");
      status.textContent = `Read root page; compare ${key} with 30 and 60`;
      reads.textContent = "1";
      document.querySelector('[data-node="root"]').classList.add("visited");
      DSL.setTimer(() => {
        document.querySelector(`[data-edge="${branch}"]`).classList.add("active");
        status.textContent = `Follow ${branch} pointer to the matching key range`;
      }, 650);
      DSL.setTimer(() => {
        const node = document.querySelector(`[data-node="${branch}"]`);
        node.classList.add("found");
        node.querySelector(`[data-key="${key}"]`).classList.add("match");
        status.textContent = `Found key ${key} in the ${branch} leaf`;
        reads.textContent = "2";
        pulse.classList.remove("active");
      }, 1250);
    }

    document.getElementById("run-lookup").addEventListener("click", runLookup);
    document.getElementById("random-key").addEventListener("click", () => {
      select.value = values[Math.floor(Math.random() * values.length)];
      runLookup();
    });
  }

  function setupCompositeIndexLab() {
    const designs = {
      gap: {
        keys: ["tenant_id = acme", "status = ?", "created_at > 1 day"], usable: 1, pages: 12, rows: 18420, time: "3.2 s",
        detail: "The tree can seek to ACME, but the unknown status splits time-ordered rows into separate ranges. It scans every ACME status group, filters, then sorts.",
      },
      aligned: {
        keys: ["tenant_id = acme", "created_at DESC", "type included"], usable: 2, pages: 2, rows: 50, time: "18 ms",
        detail: "The leading keys match equality then range/order. The scan starts at ACME’s newest event, reads 50 adjacent entries, and stops; INCLUDE avoids extra heap reads for type.",
      },
    };
    const leaves = document.getElementById("leaf-scan");
    const keys = document.getElementById("key-order");

    function reset(design) {
      keys.innerHTML = design.keys.map((key, index) => `<span class="key-part ${index < design.usable ? "usable" : "blocked"}"><small>${index + 1}</small>${key}</span>`).join(`<span class="key-arrow">→</span>`);
      leaves.innerHTML = Array.from({ length: 12 }, (_, index) => `<span class="leaf-page" data-leaf="${index}"><small>leaf</small>${index + 1}</span>`).join("");
    }

    reset(designs.gap);
    document.getElementById("composite-index").addEventListener("change", (event) => reset(designs[event.target.value]));
    document.getElementById("run-composite").addEventListener("click", () => {
      DSL.clearTimers();
      const id = document.getElementById("composite-index").value;
      const design = designs[id];
      const button = document.getElementById("run-composite");
      const diagnosis = document.getElementById("composite-diagnosis");
      reset(design);
      button.disabled = true;
      ["composite-pages", "composite-rows", "composite-time"].forEach((key) => { document.getElementById(key).textContent = "…"; });
      diagnosis.className = "diagnosis investigating";
      diagnosis.innerHTML = `<span class="diagnosis-label">EXPLAIN ANALYZE</span><p>Walking matching leaf ranges…</p>`;

      for (let index = 0; index < design.pages; index += 1) {
        DSL.setTimer(() => {
          document.querySelector(`[data-leaf="${index}"]`).classList.add(id === "aligned" ? "optimized" : "scanned");
          document.getElementById("composite-pages").textContent = String(index + 1);
          if (index === design.pages - 1) {
            button.disabled = false;
            document.getElementById("composite-rows").textContent = design.rows.toLocaleString();
            document.getElementById("composite-time").textContent = design.time;
            diagnosis.className = `diagnosis ${id === "aligned" ? "resolved" : "warning"}`;
            diagnosis.innerHTML = `<span class="diagnosis-label">${id === "aligned" ? "Observable fix" : "Diagnosis"}</span><p>${design.detail}</p>`;
          }
        }, 90 + index * 90);
      }
    });
  }

  function renderIndexTypes() {
    const lesson = DSL.getLesson("index-types");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "There is no universally best index.", "An index is a trade: extra space and write work in exchange for faster reads. The right structure depends on the questions your system asks.", "Intermediate")}
      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Lab 04</span><h2>Index workbench</h2><p class="lab-copy">Switch structures and compare what each one preserves: equality, ordering, ranges, or words inside documents.</p></div><span class="lab-badge">workload → structure</span></div>
        <div class="index-picker" role="tablist" aria-label="Index type">${Object.entries(indexTypes).map(([id, item], index) => `<button class="index-option ${index === 0 ? "active" : ""}" data-index="${id}" role="tab" aria-selected="${index === 0}">${item.name}</button>`).join("")}</div>
        <div class="viz-stage"><div class="index-demo"><div class="index-visual" id="index-visual"></div><div><span class="lab-kicker" id="index-name"></span><p class="lab-copy" id="index-note"></p><div class="index-facts" id="index-facts"></div></div></div></div>
      </section>

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Architecture drill</span><strong>Four features, four access patterns</strong><span>Choose, then load test</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Feature → workload → structure</span><h2>Ship the index that matches the job</h2><p class="lab-copy">Pick a real feature and an index family. The load test makes the mismatch visible; the recommendation explains which property the feature needs.</p></div><span class="lab-badge">design review</span></div>
        <div class="controls"><div class="control grow"><label for="feature-workload">Feature under review</label><select id="feature-workload"><option value="session">Session lookup · exact token</option><option value="orders">Order history · sorted time range</option><option value="telemetry">Telemetry ingest · sustained writes</option><option value="search">Help center · keyword search</option></select></div><div class="control"><label for="feature-index">Proposed index</label><select id="feature-index"><option value="btree">B-tree</option><option value="hash">Hash</option><option value="lsm">LSM tree</option><option value="inverted">Inverted</option></select></div><button class="button primary" id="run-workload">Run load test</button></div>
        <div class="workload-flow" aria-live="polite"><div class="flow-node"><small>Request shape</small><strong id="workload-shape">GET exact token</strong></div><span class="flow-arrow">→</span><div class="flow-node"><small>Index behavior</small><strong id="workload-behavior">waiting</strong></div><span class="flow-arrow">→</span><div class="flow-node"><small>Production outcome</small><strong id="workload-outcome">run test</strong></div></div>
        <div class="metric-grid compact"><div class="metric"><span>Primary metric</span><strong id="workload-metric">—</strong><small>p95 / throughput</small></div><div class="metric"><span>Fit</span><strong id="workload-fit">—</strong><small>for this access pattern</small></div><div class="metric"><span>Trade-off</span><strong id="workload-tradeoff">—</strong><small id="workload-tradeoff-note">space, writes, or reads</small></div></div>
        <div class="diagnosis" id="workload-diagnosis"><span class="diagnosis-label">Design review</span><p>Select a proposal and test it against production-shaped traffic.</p></div>
      </section>
      <div class="insight"><span class="insight-mark">?</span><p><strong>Decision shortcut:</strong> start from the query shape, not the index name. “Find this exact key,” “scan this ordered range,” and “find documents containing these words” are different jobs.</p></div>
      ${DSL.lessonFooter("index-types")}
    </article>`;
    setupIndexWorkbench();
    setupWorkloadLab();
  }

  function setupIndexWorkbench() {
    function show(id) {
      const item = indexTypes[id];
      document.getElementById("index-visual").innerHTML = item.visual;
      document.getElementById("index-name").textContent = item.name;
      document.getElementById("index-note").textContent = item.note;
      document.getElementById("index-facts").innerHTML = [["Point lookup", item.point], ["Range scan", item.range], ["Write rate", item.writes], ["Keeps order", item.ordered]].map(([label, value]) => `<div class="fact-row"><span>${label}</span><strong class="${value === "Excellent" || value === "Yes" ? "good" : value === "Poor" || value === "No" ? "poor" : "mixed"}">${value}</strong></div>`).join("");
      document.querySelectorAll(".index-option").forEach((button) => {
        const active = button.dataset.index === id;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
      });
    }
    document.querySelectorAll(".index-option").forEach((button) => button.addEventListener("click", () => show(button.dataset.index)));
    show("btree");
  }

  function setupWorkloadLab() {
    const workloads = {
      session: {
        shape: "GET one exact token", recommended: "hash", reason: "A hash table maps the complete token directly to one bucket. It gives up ordering that this KV-style session lookup never uses.",
        results: { btree: ["7 ms", "Good", "sorted", "tree traversal"], hash: ["2 ms", "Best", "no ranges", "one bucket lookup"], lsm: ["12 ms", "Good", "read amp", "check memtable + runs"], inverted: ["timeout", "Wrong", "tokenization", "document postings"] },
      },
      orders: {
        shape: "RANGE by customer + time", recommended: "btree", reason: "A composite B-tree keeps each customer’s timestamps ordered, so pagination is a bounded range scan instead of a filter and sort.",
        results: { btree: ["18 ms", "Best", "write cost", "ordered leaf scan"], hash: ["2.4 s", "Wrong", "no order", "scan every bucket"], lsm: ["46 ms", "Good", "compaction", "merge sorted runs"], inverted: ["1.9 s", "Wrong", "no ranges", "postings mismatch"] },
      },
      telemetry: {
        shape: "APPEND 60k events / second", recommended: "lsm", reason: "An LSM engine turns random updates into sequential flushes. It accepts compaction and read amplification to sustain the write-heavy stream.",
        results: { btree: ["21k/s", "Risky", "page splits", "random tree writes"], hash: ["34k/s", "Mixed", "rehashing", "fast point writes"], lsm: ["74k/s", "Best", "compaction", "sequential flushes"], inverted: ["8k/s", "Wrong", "many postings", "token fan-out"] },
      },
      search: {
        shape: "MATCH several words", recommended: "inverted", reason: "An inverted index starts from each normalized term and intersects document postings; row-oriented indexes cannot efficiently look inside every body.",
        results: { btree: ["3.8 s", "Wrong", "full text scan", "leading wildcard"], hash: ["4.1 s", "Wrong", "exact only", "no token lookup"], lsm: ["2.7 s", "Wrong", "scan values", "sorted documents"], inverted: ["32 ms", "Best", "indexing lag", "intersect postings"] },
      },
    };
    const feature = document.getElementById("feature-workload");
    const proposal = document.getElementById("feature-index");
    const syncShape = () => { document.getElementById("workload-shape").textContent = workloads[feature.value].shape; };
    feature.addEventListener("change", syncShape);
    syncShape();

    document.getElementById("run-workload").addEventListener("click", () => {
      const workload = workloads[feature.value];
      const chosen = proposal.value;
      const [metric, fit, tradeoff, behavior] = workload.results[chosen];
      const ideal = chosen === workload.recommended;
      document.getElementById("workload-behavior").textContent = behavior;
      document.getElementById("workload-outcome").textContent = ideal ? "SLO holds" : fit === "Good" ? "SLO holds, with cost" : "SLO violated";
      document.getElementById("workload-metric").textContent = metric;
      document.getElementById("workload-fit").textContent = fit;
      document.getElementById("workload-fit").style.color = ideal ? "var(--green)" : fit === "Wrong" || fit === "Risky" ? "var(--coral)" : "var(--amber)";
      document.getElementById("workload-tradeoff").textContent = tradeoff;
      document.getElementById("workload-tradeoff-note").textContent = ideal ? "accepted consciously" : "cost of this proposal";
      const diagnosis = document.getElementById("workload-diagnosis");
      diagnosis.className = `diagnosis ${ideal ? "resolved" : "warning"}`;
      diagnosis.innerHTML = `<span class="diagnosis-label">${ideal ? "Architecture fit" : "Review finding"}</span><p>${ideal ? workload.reason : `This proposal is ${fit.toLowerCase()} here. Recommended: ${indexTypes[workload.recommended].name}. ${workload.reason}`}</p>`;
    });
  }

  DSL.registerRenderer("btree", renderBtree);
  DSL.registerRenderer("index-types", renderIndexTypes);
})(window.DataSystemsLab);
