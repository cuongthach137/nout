(function registerStorageLesson(DSL) {
  "use strict";

  function renderPages() {
    const lesson = DSL.getLesson("pages");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "A database reads <em>pages</em>, not rows.", "Rows are the logical unit you ask for. Pages are the physical unit the storage engine moves. That mismatch explains much of database performance.")}
      <section class="concept-grid">
        <div class="concept-card"><span class="concept-number">01 / page</span><h3>Fixed-size block</h3><p>A page commonly holds many nearby records. Engines fetch the whole block even when one row matches.</p></div>
        <div class="concept-card"><span class="concept-number">02 / buffer</span><h3>Memory cache</h3><p>Recently used pages stay in RAM. A buffer hit is far cheaper than another storage read.</p></div>
        <div class="concept-card"><span class="concept-number">03 / locality</span><h3>Neighbors matter</h3><p>Organizing related rows together turns future lookups into cheap reads from an already loaded page.</p></div>
      </section>
      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Lab 02</span><h2>Fetch a customer</h2><p class="lab-copy">Choose an ID and watch which page enters the buffer pool. Repeat the query to see the difference between a disk read and a buffer hit.</p></div><span class="lab-badge">storage → memory</span></div>
        <div class="controls">
          <div class="control grow"><label for="customer-id">Customer ID (1–16)</label><input id="customer-id" type="number" min="1" max="16" value="11"></div>
          <button class="button primary" id="fetch-row">Fetch row</button>
          <button class="button" id="clear-buffer">Clear buffer</button>
        </div>
        <div class="viz-stage">
          <div class="page-layout">
            <div><div class="control-label">Disk pages</div><div class="disk-stack" id="disk-stack">${[0, 1, 2, 3].map((page) => `<div class="disk-page" data-page="${page}">${[1, 2, 3, 4].map((offset) => { const id = page * 4 + offset; return `<span class="record" data-id="${id}">#${String(id).padStart(2, "0")}</span>`; }).join("")}</div>`).join("")}</div></div>
            <div class="buffer-panel"><div class="buffer-title">BUFFER POOL · 2 SLOTS</div><div class="buffer-slots"><div class="buffer-slot" data-slot="0">empty</div><div class="buffer-slot" data-slot="1">empty</div></div></div>
          </div>
        </div>
        <div class="viz-caption"><span class="live-status"><i class="pulse" id="page-pulse"></i><span id="page-status" aria-live="polite">Ready to fetch customer #11</span></span><span><strong id="page-reads">0</strong> disk reads · <strong id="buffer-hits">0</strong> buffer hits</span></div>
      </section>

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Production drill</span><strong>Order history p95: 1.8s</strong><span class="severity">SEV-2</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Symptom → page locality</span><h2>The query returns 12 rows. Why does it read 10 pages?</h2><p class="lab-copy">The orders table grew for two years. A customer’s recent orders are now scattered through the heap, so one small response triggers many random reads. Replay the request, then change the physical access path.</p></div><span class="lab-badge">GET /orders</span></div>
        <div class="controls">
          <div class="control grow"><label for="order-layout">Storage access path</label><select id="order-layout"><option value="scattered">Heap rows scattered by insertion</option><option value="clustered">Composite index with nearby leaf entries</option></select></div>
          <button class="button primary" id="replay-orders">Replay production request</button>
        </div>
        <div class="metric-grid" aria-label="Request performance">
          <div class="metric"><span>Pages touched</span><strong id="locality-pages-count">—</strong><small id="locality-pages-detail">Run the request</small></div>
          <div class="metric"><span>Storage wait</span><strong id="locality-latency">—</strong><small>simplified at 8 ms / miss</small></div>
          <div class="metric"><span>Rows returned</span><strong>12</strong><small>the API payload is unchanged</small></div>
        </div>
        <div class="page-trace" id="locality-trace" aria-label="Pages visited by the order query" aria-live="polite"></div>
        <div class="diagnosis" id="locality-diagnosis"><span class="diagnosis-label">Investigation</span><p>Replay the request to connect logical rows with physical page work.</p></div>
      </section>
      <div class="insight"><span class="insight-mark">!</span><p><strong>Transferable idea:</strong> “One lookup” does not mean “one byte of work.” Page layout, caching, and access order determine the real I/O.</p></div>
      ${DSL.lessonFooter("pages")}
    </article>`;
    setupBufferPoolLab();
    setupLocalityLab();
  }

  function setupBufferPoolLab() {
    let buffer = [];
    let reads = 0;
    let hits = 0;
    const status = document.getElementById("page-status");
    const pulse = document.getElementById("page-pulse");

    function paint() {
      document.querySelectorAll(".buffer-slot").forEach((slot, index) => {
        const page = buffer[index];
        slot.className = `buffer-slot ${page !== undefined ? "loaded" : ""}`;
        slot.textContent = page !== undefined ? `page ${page + 1} · rows ${page * 4 + 1}–${page * 4 + 4}` : "empty";
      });
      document.getElementById("page-reads").textContent = reads;
      document.getElementById("buffer-hits").textContent = hits;
    }

    document.getElementById("fetch-row").addEventListener("click", () => {
      const input = document.getElementById("customer-id");
      const id = Math.max(1, Math.min(16, Number(input.value) || 1));
      const page = Math.floor((id - 1) / 4);
      input.value = id;
      document.querySelectorAll(".disk-page").forEach((element) => element.classList.remove("active"));
      document.querySelectorAll(".record").forEach((element) => element.classList.remove("match"));
      document.querySelector(`[data-page="${page}"]`).classList.add("active");
      document.querySelector(`[data-id="${id}"]`).classList.add("match");
      pulse.classList.add("active");

      if (buffer.includes(page)) {
        hits += 1;
        status.textContent = `Buffer hit — page ${page + 1} was already in memory`;
        paint();
        DSL.setTimer(() => pulse.classList.remove("active"), 500);
        return;
      }

      reads += 1;
      status.textContent = `Reading page ${page + 1} from disk…`;
      DSL.setTimer(() => {
        if (buffer.length >= 2) buffer.shift();
        buffer.push(page);
        status.textContent = `Loaded page ${page + 1}; found customer #${id}`;
        pulse.classList.remove("active");
        paint();
      }, 650);
    });

    document.getElementById("clear-buffer").addEventListener("click", () => {
      buffer = [];
      status.textContent = "Buffer cleared";
      paint();
    });
  }

  function setupLocalityLab() {
    const layouts = {
      scattered: {
        pages: [2, 11, 4, 18, 7, 13, 1, 16, 9, 20],
        label: "10 random heap pages",
        diagnosis: "The response is small, but its rows are physically far apart. A composite index on (customer_id, created_at DESC) narrows the range; including displayed columns can avoid heap fetches entirely.",
      },
      clustered: {
        pages: [6, 7, 8],
        label: "3 neighboring leaf pages",
        diagnosis: "The access path follows one short, ordered index range. The same 12 orders now arrive from three nearby pages—fewer misses and predictable latency.",
      },
    };
    const trace = document.getElementById("locality-trace");

    function drawEmptyTrace() {
      trace.innerHTML = Array.from({ length: 20 }, (_, index) => `<span class="trace-page" data-trace-page="${index + 1}">p${String(index + 1).padStart(2, "0")}</span>`).join("");
    }

    drawEmptyTrace();
    document.getElementById("replay-orders").addEventListener("click", () => {
      DSL.clearTimers();
      drawEmptyTrace();
      const layout = document.getElementById("order-layout").value;
      const result = layouts[layout];
      const button = document.getElementById("replay-orders");
      const diagnosis = document.getElementById("locality-diagnosis");
      button.disabled = true;
      document.getElementById("locality-pages-count").textContent = "0";
      document.getElementById("locality-latency").textContent = "0 ms";
      document.getElementById("locality-pages-detail").textContent = "reading…";
      diagnosis.className = "diagnosis investigating";
      diagnosis.innerHTML = `<span class="diagnosis-label">Trace</span><p>Following row pointers from the index…</p>`;

      result.pages.forEach((page, index) => DSL.setTimer(() => {
        document.querySelector(`[data-trace-page="${page}"]`).classList.add(layout === "clustered" ? "optimized" : "hot");
        document.getElementById("locality-pages-count").textContent = String(index + 1);
        document.getElementById("locality-latency").textContent = `${(index + 1) * 8} ms`;
        if (index === result.pages.length - 1) {
          button.disabled = false;
          document.getElementById("locality-pages-detail").textContent = result.label;
          diagnosis.className = `diagnosis ${layout === "clustered" ? "resolved" : "warning"}`;
          diagnosis.innerHTML = `<span class="diagnosis-label">${layout === "clustered" ? "Observable fix" : "Diagnosis"}</span><p>${result.diagnosis}</p>`;
        }
      }, 110 + index * 105));
    });
  }

  DSL.registerRenderer("pages", renderPages);
})(window.DataSystemsLab);
