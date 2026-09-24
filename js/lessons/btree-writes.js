(function registerBtreeWritesLesson(DSL) {
  "use strict";

  const INSERT_PATTERNS = {
    uuid4: {
      label: "Random UUIDv4",
      targets: [6, 2, 5, 1, 4, 2, 7, 3, 1, 6, 4, 3],
      splitAt: new Set([3, 6, 9, 11]),
      latency: "185 ms",
      locality: "Low",
      note: "Random keys distribute writes across the tree. More leaf pages churn in cache, and inserting into full interior pages triggers splits in multiple locations.",
    },
    uuid7: {
      label: "Time-ordered UUIDv7",
      targets: [8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 9],
      splitAt: new Set([4]),
      latency: "62 ms",
      locality: "High",
      note: "Time-ordered keys concentrate inserts at the right edge. The hot leaf stays cached and splits happen predictably as the tree grows.",
    },
  };

  function renderBtreeWrites() {
    const lesson = DSL.getLesson("btree-writes");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "Your key shape changes the <em>write path</em>.", "A B-tree must place every new key in sorted order. Random identifiers and time-ordered identifiers create very different cache, fragmentation, and page-split behavior.", "Advanced")}
      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Lab 07</span><h2>Insert into a live B-tree</h2><p class="lab-copy">Run the same 12 inserts with random and time-ordered UUIDs. Each pulse is a leaf page touched; a split means the target page had no room.</p></div><span class="lab-badge">key → leaf → split</span></div>
        <div class="controls"><div class="control grow"><label for="id-pattern">Primary-key pattern</label><select id="id-pattern"><option value="uuid4">Random UUIDv4</option><option value="uuid7">Time-ordered UUIDv7</option></select></div><button class="button primary" id="run-inserts">Run 12 inserts</button></div>
        <div class="leaf-buffer" id="leaf-buffer" aria-label="B-tree leaf pages receiving inserts" aria-live="polite"></div>
        <div class="insert-stream" id="insert-stream"><span>Waiting for inserts</span></div>
        <div class="metric-grid compact"><div class="metric"><span>Leaf pages touched</span><strong id="insert-pages">—</strong><small>working-set pressure</small></div><div class="metric"><span>Page splits</span><strong id="insert-splits">—</strong><small>allocation + WAL work</small></div><div class="metric"><span>Illustrative batch time</span><strong id="insert-time">—</strong><small>same number of rows</small></div></div>
        <div class="diagnosis" id="insert-diagnosis"><span class="diagnosis-label">Prediction</span><p>Which identifier keeps writes concentrated on fewer leaf pages?</p></div>
      </section>
      <section class="concept-grid">
        <div class="concept-card"><span class="concept-number">split</span><h3>Full pages divide</h3><p>A split allocates another page, redistributes entries, updates parent pointers, and produces additional log traffic.</p></div>
        <div class="concept-card"><span class="concept-number">cache</span><h3>Randomness widens the hot set</h3><p>Random inserts touch leaves across the keyspace instead of repeatedly modifying the rightmost cached page.</p></div>
        <div class="concept-card"><span class="concept-number">trade-off</span><h3>Ordering can reveal time</h3><p>Time-ordered IDs improve locality, but identifier choice also affects predictability, privacy, and distributed generation.</p></div>
      </section>
      <div class="insight"><span class="insight-mark">!</span><p><strong>Do not optimize IDs in isolation:</strong> measure insert throughput, index size, cache hit rate, and page splits under your actual engine and concurrency.</p></div>
      ${DSL.lessonFooter("btree-writes")}
    </article>`;
    setupInsertLab();
  }

  function setupInsertLab() {
    const buffer = document.getElementById("leaf-buffer");
    const stream = document.getElementById("insert-stream");

    function resetLeaves() {
      buffer.innerHTML = Array.from({ length: 9 }, (_, index) => `<div class="leaf-bucket" data-leaf-bucket="${index + 1}"><small>leaf ${index + 1}</small><span class="leaf-fill"><i></i><i></i><i></i><i></i></span><strong></strong></div>`).join("");
      stream.innerHTML = `<span>Waiting for inserts</span>`;
    }
    resetLeaves();

    document.getElementById("run-inserts").addEventListener("click", () => {
      DSL.clearTimers();
      resetLeaves();
      const pattern = INSERT_PATTERNS[document.getElementById("id-pattern").value];
      const touched = new Set();
      let splits = 0;
      document.getElementById("insert-pages").textContent = "0";
      document.getElementById("insert-splits").textContent = "0";
      document.getElementById("insert-time").textContent = "…";
      const button = document.getElementById("run-inserts");
      button.disabled = true;
      const diagnosis = document.getElementById("insert-diagnosis");
      diagnosis.className = "diagnosis investigating";
      diagnosis.innerHTML = `<span class="diagnosis-label">Writing</span><p>${pattern.label}: locating a sorted position for each new key…</p>`;

      pattern.targets.forEach((page, index) => DSL.setTimer(() => {
        touched.add(page);
        const bucket = document.querySelector(`[data-leaf-bucket="${page}"]`);
        bucket.classList.add("leaf-write");
        const fill = bucket.querySelectorAll("i");
        const slot = [...fill].find((item) => !item.classList.contains("filled"));
        if (slot) slot.classList.add("filled");
        if (pattern.splitAt.has(index)) {
          splits += 1;
          bucket.classList.add("leaf-split");
          bucket.querySelector("strong").textContent = "split";
        }
        stream.innerHTML = `<span>insert ${index + 1}/12</span><strong>${pattern.label}</strong><span>→ leaf ${page}</span>`;
        document.getElementById("insert-pages").textContent = String(touched.size);
        document.getElementById("insert-splits").textContent = String(splits);
        DSL.setTimer(() => bucket.classList.remove("leaf-write"), 120);
        if (index === pattern.targets.length - 1) {
          button.disabled = false;
          document.getElementById("insert-time").textContent = pattern.latency;
          diagnosis.className = "diagnosis resolved";
          diagnosis.innerHTML = `<span class="diagnosis-label">${pattern.locality} locality</span><p>${pattern.note}</p>`;
        }
      }, 100 + index * 140));
    });
  }

  DSL.registerRenderer("btree-writes", renderBtreeWrites);
})(window.DataSystemsLab);
