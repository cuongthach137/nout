(function registerAccessPathsLesson(DSL) {
  "use strict";

  const SCANS = {
    "index-only": { label: "Index Only Scan", indexPages: 2, heapPages: [], time: "7 ms", note: "Every requested column is stored in the index, and all-visible bits let PostgreSQL skip heap visibility checks." },
    index: { label: "Index Scan", indexPages: 2, heapPages: [2, 9], time: "18 ms", note: "The index returns row locations one at a time; the executor follows them into scattered heap pages." },
    bitmap: { label: "Bitmap Heap Scan", indexPages: 3, heapPages: [2, 4, 6, 9, 11], time: "54 ms", note: "The executor builds a bitmap, sorts work by physical page, then visits each required heap page once." },
    seq: { label: "Seq Scan", indexPages: 0, heapPages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], time: "130 ms", note: "At high selectivity, reading the table once is cheaper than thousands of index-to-heap jumps." },
  };

  function chooseScan() {
    const selectivity = document.getElementById("scan-selectivity").value;
    const projection = document.getElementById("scan-projection").value;
    const visibility = document.getElementById("scan-visibility").value;
    if (selectivity === "wide") return "seq";
    if (selectivity === "medium") return "bitmap";
    if (projection === "covered" && visibility === "stable") return "index-only";
    return "index";
  }

  function renderAccessPaths() {
    const lesson = DSL.getLesson("access-paths");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "One index can produce <em>four different scans</em>.", "The optimizer chooses an access path from estimated cost—not from a rule that says indexes are always faster. See how selectivity, projected columns, and MVCC visibility change the plan.", "Intermediate")}
      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Lab 05A</span><h2>Read an EXPLAIN plan physically</h2><p class="lab-copy">Change the query shape. The plan diagram shows the executor’s steps; the page strip shows the actual storage work those steps imply.</p></div><span class="lab-badge">estimate → access path</span></div>
        <div class="controls">
          <div class="control"><label for="scan-selectivity">Rows matching</label><select id="scan-selectivity"><option value="rare">Rare · 0.5%</option><option value="medium">Medium · 15%</option><option value="wide">Wide · 65%</option></select></div>
          <div class="control"><label for="scan-projection">Columns requested</label><select id="scan-projection"><option value="covered">id, total · covered</option><option value="full">SELECT * · needs heap</option></select></div>
          <div class="control"><label for="scan-visibility">Table activity</label><select id="scan-visibility"><option value="stable">Mostly static · all-visible</option><option value="churn">Recently updated</option></select></div>
          <button class="button primary" id="run-scan-plan">Run EXPLAIN</button>
        </div>
        <div class="scan-plan" id="scan-plan" aria-live="polite"></div>
        <div class="heap-page-strip" id="scan-pages" aria-label="Heap pages read"></div>
        <div class="metric-grid compact"><div class="metric"><span>Index pages</span><strong id="scan-index-pages">—</strong><small>B-tree lookup work</small></div><div class="metric"><span>Heap pages</span><strong id="scan-heap-pages">—</strong><small>table blocks fetched</small></div><div class="metric"><span>Illustrative latency</span><strong id="scan-time">—</strong><small>lower is better</small></div></div>
        <div class="diagnosis" id="scan-diagnosis"><span class="diagnosis-label">Planner question</span><p>Which path minimizes total page work for this query—not merely index work?</p></div>
      </section>

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Design drill</span><strong>Separate indexes, composite index, or scan?</strong><span class="severity">AND / OR</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Lab 05B</span><h2>Combine predicates without guessing</h2><p class="lab-copy">PostgreSQL can combine separate indexes into in-memory bitmaps. That flexibility costs extra scans and loses index ordering.</p></div><span class="lab-badge">BitmapAnd · BitmapOr</span></div>
        <div class="query-box"><code id="combine-query">WHERE status = 'paid' AND region = 'EU' ORDER BY created_at</code></div>
        <div class="controls"><div class="control"><label for="combine-operator">Predicate</label><select id="combine-operator"><option value="and">status AND region</option><option value="or">status OR region</option></select></div><div class="control grow"><label for="combine-design">Available design</label><select id="combine-design"><option value="separate">Two indexes: (status), (region)</option><option value="composite">Composite: (status, region, created_at)</option></select></div><button class="button primary" id="run-combination">Build plan</button></div>
        <div class="bitmap-flow" id="bitmap-flow" aria-live="polite"></div>
        <div class="metric-grid compact"><div class="metric"><span>Index scans</span><strong id="combine-scans">—</strong><small>structures traversed</small></div><div class="metric"><span>Heap pages</span><strong id="combine-pages">—</strong><small>after combining matches</small></div><div class="metric"><span>Extra sort</span><strong id="combine-sort">—</strong><small>bitmap loses index order</small></div></div>
        <div class="diagnosis" id="combine-diagnosis"><span class="diagnosis-label">Trade-off</span><p>Test the common query shapes before deciding whether flexibility or a purpose-built composite index matters more.</p></div>
      </section>
      <section class="concept-grid">
        <div class="concept-card"><span class="concept-number">key</span><h3>Key columns navigate</h3><p>Key columns participate in search ordering, range bounds, and—where applicable—uniqueness.</p></div>
        <div class="concept-card"><span class="concept-number">include</span><h3>Payload columns cover</h3><p><code>INCLUDE</code> stores extra values at the leaf so a query can return them, but they do not guide the index search.</p></div>
        <div class="concept-card"><span class="concept-number">cost</span><h3>Coverage is not free</h3><p>Wider indexes occupy more pages, increase write work, and can make each lookup traverse more data.</p></div>
      </section>
      <div class="insight"><span class="insight-mark">!</span><p><strong>Index-only does not mean “never touches the heap.”</strong> In PostgreSQL, recently modified heap pages may still require visibility checks until the visibility map marks them all-visible.</p></div>
      ${DSL.lessonFooter("access-paths")}
    </article>`;
    setupScanPlanner();
    setupCombinationLab();
  }

  function setupScanPlanner() {
    const pageStrip = document.getElementById("scan-pages");
    const drawPages = () => { pageStrip.innerHTML = Array.from({ length: 12 }, (_, index) => `<span class="heap-block" data-scan-page="${index + 1}">P${index + 1}</span>`).join(""); };
    drawPages();

    document.getElementById("run-scan-plan").addEventListener("click", () => {
      DSL.clearTimers();
      drawPages();
      const scan = SCANS[chooseScan()];
      const plan = document.getElementById("scan-plan");
      plan.innerHTML = `<div class="plan-node selected"><small>Planner chose</small><strong>${scan.label}</strong></div><span>→</span>${scan.indexPages ? `<div class="plan-node"><small>Index work</small><strong>${scan.indexPages} page${scan.indexPages > 1 ? "s" : ""}</strong></div><span>→</span>` : ""}<div class="plan-node"><small>Heap fetch</small><strong>${scan.heapPages.length ? `${scan.heapPages.length} pages` : "skipped"}</strong></div>`;
      document.getElementById("scan-index-pages").textContent = String(scan.indexPages);
      document.getElementById("scan-heap-pages").textContent = "0";
      document.getElementById("scan-time").textContent = "…";
      const diagnosis = document.getElementById("scan-diagnosis");
      diagnosis.className = "diagnosis investigating";
      diagnosis.innerHTML = `<span class="diagnosis-label">${scan.label}</span><p>Executing the chosen path…</p>`;
      if (!scan.heapPages.length) {
        DSL.setTimer(() => finishScan(scan), 320);
        return;
      }
      scan.heapPages.forEach((page, index) => DSL.setTimer(() => {
        document.querySelector(`[data-scan-page="${page}"]`).classList.add("read");
        document.getElementById("scan-heap-pages").textContent = String(index + 1);
        if (index === scan.heapPages.length - 1) finishScan(scan);
      }, 100 + index * 90));
    });

    function finishScan(scan) {
      document.getElementById("scan-time").textContent = scan.time;
      const diagnosis = document.getElementById("scan-diagnosis");
      diagnosis.className = "diagnosis resolved";
      diagnosis.innerHTML = `<span class="diagnosis-label">Why this won</span><p>${scan.note}</p>`;
    }
  }

  function setupCombinationLab() {
    const operator = document.getElementById("combine-operator");
    const design = document.getElementById("combine-design");
    const query = document.getElementById("combine-query");
    operator.addEventListener("change", () => { query.textContent = `WHERE status = 'paid' ${operator.value.toUpperCase()} region = 'EU' ORDER BY created_at`; });

    document.getElementById("run-combination").addEventListener("click", () => {
      const op = operator.value;
      const choice = design.value;
      let result;
      if (choice === "separate") {
        result = { flow: [`Index(status)`, `Index(region)`, `Bitmap${op === "and" ? "And" : "Or"}`, "Bitmap Heap Scan", "Sort"], scans: 2, pages: op === "and" ? 3 : 7, sort: "Yes", good: true, note: `Separate indexes support this ${op.toUpperCase()} through bitmap combination. Heap rows are visited in physical order, so ORDER BY needs another sort.` };
      } else if (op === "and") {
        result = { flow: ["Composite seek", "Bounded leaf range", "Index Scan"], scans: 1, pages: 2, sort: "No", good: true, note: "The composite leading keys satisfy both predicates, and created_at preserves the requested order. This is faster but specialized." };
      } else {
        result = { flow: ["Composite prefix mismatch", "Seq Scan", "Sort"], scans: 0, pages: 12, sort: "Yes", good: false, note: "One composite scan cannot directly satisfy status = value OR region = value when region is not a leading key. Separate indexes are more flexible here." };
      }
      document.getElementById("bitmap-flow").innerHTML = result.flow.map((step, index) => `${index ? "<span>→</span>" : ""}<div class="bitmap-step">${step}</div>`).join("");
      document.getElementById("combine-scans").textContent = String(result.scans);
      document.getElementById("combine-pages").textContent = String(result.pages);
      document.getElementById("combine-sort").textContent = result.sort;
      const diagnosis = document.getElementById("combine-diagnosis");
      diagnosis.className = `diagnosis ${result.good ? "resolved" : "warning"}`;
      diagnosis.innerHTML = `<span class="diagnosis-label">Plan reading</span><p>${result.note}</p>`;
    });
  }

  DSL.registerRenderer("access-paths", renderAccessPaths);
})(window.DataSystemsLab);
