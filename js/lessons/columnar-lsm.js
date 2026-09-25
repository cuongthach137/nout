(function registerColumnarLsmLesson(DSL) {
  "use strict";

  const SALES = [
    { day: "Mon", item: "Sourdough", qty: 6, price: 9 },
    { day: "Tue", item: "Sourdough", qty: 4, price: 9 },
    { day: "Wed", item: "Croissant", qty: 12, price: 4 },
    { day: "Thu", item: "Sourdough", qty: 8, price: 9 },
    { day: "Fri", item: "Carrot cake", qty: 3, price: 22 },
  ];

  const QUERY_INFO = {
    qty: { label: "How many croissants did we sell?", cols: ["Item", "Qty"] },
    price: { label: "What was this week’s revenue?", cols: ["Qty", "Price"] },
    receipt: { label: "Print every receipt in full", cols: ["Day", "Item", "Qty", "Price"] },
  };

  const STREAM = [
    { customer: "Omar", item: "Croissant", day: "Fri" },
    { customer: "Maya", item: "Sourdough", day: "Sat" },
    { customer: "Ana", item: "Lemon cake", day: "Sat" },
    { customer: "Omar", item: "Sourdough", day: "Sun" },
    { customer: "Tegan", item: "Carrot cake", day: "Sun" },
  ];

  const QUIZ = [
    { prompt: "An analytics query reads 3 columns of a 40-column, 10-million-row table. Why does a column layout win?", options: ["It reads faster per cell", "The 37 unread columns are never touched, and each column compresses better", "It avoids transactions"], answer: 1, why: "Columns together mean a query touches only the strips it names — and one repeated value per strip compresses to a fraction of its row-store size." },
    { prompt: "Why does an LSM engine absorb a write storm without falling over?", options: ["It appends to a memtable and defers sorting and rewriting to flushes and compaction", "It writes directly into sorted tables", "It skips the log to save time"], answer: 0, why: "Appends are the cheapest write there is. Sorting happens later, in bulk, when a full memtable becomes one sorted chunk." },
    { prompt: "What cost grows between compactions?", options: ["Write throughput", "Reads: one more sorted chunk is one more place to check", "Index size"], answer: 1, why: "Each chunk is cheap alone; the accumulation is not. Background compaction caps how many places a read must look." },
    { prompt: "Why does keeping each chunk sorted help a lookup that misses?", options: ["Sorted data cannot contain errors", "The search can stop early — once past where the key would be", "Sorted chunks stay in memory"], answer: 1, why: "A sorted column lets the search bail out the moment it passes the target — and Lesson 09’s bloom filters skip whole chunks before that search starts." },
  ];

  function setStatus(el, message, tone) {
    el.textContent = message;
    el.classList.remove("warn", "ok");
    if (tone) el.classList.add(tone);
  }

  function renderColumnarLsm() {
    const lesson = DSL.getLesson("columnar-lsm");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "Store by <em>question</em>, not by row.", "Row stores keep each receipt together. Column stores keep each field together. LSM stores append first and sort later. Same bakery records, three different notebooks — run the same work under each and watch where the cost moves.")}
      <section class="concept-grid">
        <div class="concept-card"><span class="concept-number">01 / columnar</span><h3>Read three cells, not forty</h3><p>A row layout stores whole receipts together. A column layout stores each field together — a question about one field never touches the others.</p><div class="wait-what"><strong>Wait, what?</strong><p>Where did the receipts go? Still there — stitched back from four strips whenever the whole row is needed. Whole-receipt reads pay extra; one-question reads stop paying for everything else.</p></div></div>
        <div class="concept-card"><span class="concept-number">02 / append</span><h3>Write now, sort later</h3><p>When writes arrive too fast to rewrite pages, the store appends to a small in-memory list and turns it into a sorted chunk later. Writes never wait for reorganization.</p><div class="wait-what"><strong>Wait, what?</strong><p>Appends without sorting — isn’t that chaos? Only briefly. The list is sorted the moment it leaves memory, and every older chunk stays sorted forever. The mess never reaches storage.</p></div></div>
        <div class="concept-card"><span class="concept-number">03 / compaction</span><h3>Pay in the background, not on every read</h3><p>Every extra sorted chunk is one more place a read must look. In the background, small chunks merge into fewer big ones and superseded rows are dropped.</p><div class="wait-what"><strong>Wait, what?</strong><p>Who pays during the merge? The engine does — background CPU and extra copies while it runs. Compaction trades spread-out background work for reads that never degrade without limit.</p></div></div>
      </section>

      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Lab 10A · columnar</span><h2>Ask one question of a tiny notebook</h2><p class="lab-copy">One week of sales, five receipts, twenty cells. Ask the notebook a question in both layouts and count exactly what had to be read.</p></div><span class="lab-badge">rows ↔ columns</span></div>
        <div class="controls">
          <div class="control grow"><label for="col-query">Question</label><select id="col-query">
            <option value="qty">How many croissants did we sell?</option>
            <option value="price">What was this week’s revenue?</option>
            <option value="receipt">Print every receipt in full</option>
          </select></div>
          <div class="control"><label for="col-mode">Notebook layout</label><select id="col-mode"><option value="rows">Row notebook · whole receipts together</option><option value="columns">Column strips · each field together</option></select></div>
          <button class="button primary" id="col-run" type="button">Run the question</button>
        </div>
        <div class="viz-stage model-scroll" id="col-stage" aria-live="polite"></div>
        <div class="metric-grid compact">
          <div class="metric"><span>Cells read</span><strong id="col-cells">—</strong><small>of 20 stored</small></div>
          <div class="metric"><span>Cells the answer used</span><strong id="col-used">—</strong><small>what the question needed</small></div>
        </div>
        <div class="viz-caption"><span class="live-status"><i class="pulse" id="col-pulse"></i><span id="col-status" aria-live="polite">Pick a question, choose a layout, and run it.</span></span></div>
        <div class="wait-what"><strong>Wait, what?</strong><p>Why not store columns apart from the very start? Because the order screen reads all four fields of one receipt — and strips must be stitched back together for that, the join problem from Lesson 01 again. Rows win whole-receipt work; columns win when queries keep asking one question of millions of receipts.</p></div>
      </section>

      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Lab 10B · chunks</span><h2>Run a write storm, then go looking</h2><p class="lab-copy">Orders arrive one at a time — append, append, append. Flush turns the memtable into a sorted chunk. Then find Omar and watch the cost of every chunk you have accumulated.</p></div><span class="lab-badge">memtable → chunks</span></div>
        <div class="controls">
          <button class="button primary" id="lsm-add" type="button">Append an order</button>
          <button class="button primary" id="lsm-flush" type="button" disabled>Flush memtable → sorted chunk</button>
          <button class="button primary" id="lsm-compact" type="button" disabled>Compact chunks</button>
          <div class="control"><label for="lsm-target">Look up</label><select id="lsm-target"><option value="Omar">Omar · a regular</option><option value="Zoe">Zoe · never ordered</option></select></div>
          <button class="button" id="lsm-read" type="button">Look them up</button>
          <button class="button ghost" id="lsm-reset" type="button">Reset</button>
        </div>
        <div class="viz-stage model-scroll" id="lsm-stage" aria-live="polite"></div>
        <div class="metric-grid compact">
          <div class="metric"><span>Cells written</span><strong id="lsm-writes">0</strong><small>appends + background rewrites</small></div>
          <div class="metric"><span>Sorted chunks</span><strong id="lsm-chunks">0</strong><small>places a read must look</small></div>
          <div class="metric"><span>Entries examined, last read</span><strong id="lsm-lastread">—</strong><small>run a read to measure</small></div>
        </div>
        <div class="viz-caption"><span class="live-status"><i class="pulse" id="lsm-pulse"></i><span id="lsm-status" aria-live="polite">Append a few orders, flush, then go looking for Omar.</span></span></div>
        <div class="wait-what"><strong>Wait, what?</strong><p>Didn’t Lesson 02 say the database rewrites pages in place? Row stores can. But when writes arrive faster than pages can be rewritten, the trick inverts: never rewrite — append, and sort in bulk later. That is the LSM design behind RocksDB, Cassandra, and many cloud stores.</p></div>
      </section>

      <div class="insight"><span class="insight-mark">!</span><p><strong>Transferable idea:</strong> no layout wins everywhere. Columns serve questions that read few fields of many rows; append-and-sort serves stores that write constantly and read by key. Read amplification and write amplification are the same dial turned in opposite directions — Lesson 04’s B-tree is the in-place compromise between them.</p></div>

      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Check yourself</span><h2>Four calls on the two layouts</h2><p class="lab-copy">Answer with the plain-language rules from the labs; the storage-engine vocabulary is only their formal name.</p></div><button class="button" type="button" data-quiz-reset>Reset answers</button></div>
        <div id="columnar-quiz">${DSL.Quiz.render(QUIZ, "Storage layout review")}</div>
      </section>
      ${DSL.lessonFooter("columnar-lsm")}
    </article>`;
    setupColumnLab();
    setupLsmLab();
    DSL.Quiz.mount(document.getElementById("columnar-quiz"), QUIZ, { noun: "decision", passScore: 3, successTitle: "Storage review passed", successCopy: "You can say where each design puts the cost." });
  }

  function setupColumnLab() {
    const stage = document.getElementById("col-stage");
    const status = document.getElementById("col-status");
    const cellsOut = document.getElementById("col-cells");
    const usedOut = document.getElementById("col-used");

    function paint(highlight) {
      if (document.getElementById("col-mode").value === "rows") {
        const rows = SALES.map((sale) => `<tr class="${highlight && highlight.rows ? "lit" : ""}"><td class="mono">${sale.day}</td><td>${sale.item}</td><td class="mono">${sale.qty}</td><td class="mono">$${sale.price}</td></tr>`).join("");
        stage.innerHTML = `<div class="model-board"><small>Row notebook · each line is one receipt</small><table class="model-table" aria-label="Sales stored by receipt"><thead><tr><th>Day</th><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        return;
      }
      const cols = [
        { name: "Day", vals: SALES.map((sale) => sale.day) },
        { name: "Item", vals: SALES.map((sale) => sale.item) },
        { name: "Qty", vals: SALES.map((sale) => String(sale.qty)) },
        { name: "Price", vals: SALES.map((sale) => `$${sale.price}`) },
      ];
      stage.innerHTML = `<div class="column-board">${cols.map((col) => `<div class="col-strip ${highlight && highlight.cols && highlight.cols.includes(col.name) ? "lit" : ""}"><b>${col.name}</b>${col.vals.map((value) => `<span class="mono">${value}</span>`).join("")}</div>`).join("")}</div>`;
    }

    document.getElementById("col-run").addEventListener("click", () => {
      const info = QUERY_INFO[document.getElementById("col-query").value];
      const layout = document.getElementById("col-mode").value;
      const fullRow = layout === "rows" || info.cols.length === 4;
      paint({ rows: fullRow, cols: fullRow ? null : info.cols });

      if (layout === "rows") {
        cellsOut.textContent = String(SALES.length * 4);
        usedOut.textContent = String(info.cols.length * SALES.length);
        setStatus(status, info.cols.length === 4
          ? `Printed all receipts: every cell was needed, so the row notebook is a perfect fit — 20 of 20 cells read.`
          : `To answer one question, the row notebook handed over every receipt — ${SALES.length * 4} cells — and the answer used only ${info.cols.length * SALES.length}. The other cells came along for the ride.`);
        return;
      }

      cellsOut.textContent = String(info.cols.length * SALES.length);
      usedOut.textContent = String(info.cols.length * SALES.length);
      setStatus(status, fullRow
        ? `Whole receipts required all ${SALES.length * 4} cells, so the strips had to be stitched back row by row — same total reading, extra assembly. Row layout wins this question.`
        : `The strips for ${info.cols.join(" and ")} held everything needed — ${info.cols.length * SALES.length} of 20 cells. The other strips were never opened. Multiply this table to millions of receipts and the gap becomes the whole story.`);
    });

    document.getElementById("col-mode").addEventListener("change", () => paint(null));
    paint(null);
  }

  function setupLsmLab() {
    let state = freshLsmState();
    const stage = document.getElementById("lsm-stage");
    const status = document.getElementById("lsm-status");
    const writesOut = document.getElementById("lsm-writes");
    const chunksOut = document.getElementById("lsm-chunks");
    const lastOut = document.getElementById("lsm-lastread");

    function freshLsmState() {
      return { memtable: [], tables: [], flushCount: 0, rewrites: 0, added: 0, lastRead: null };
    }

    function storedCells() {
      return state.tables.reduce((total, table) => total + table.length, 0);
    }

    function sortedCustomers(table) {
      return table.map((row) => row.customer).sort();
    }

    function paint() {
      const seqBase = state.added - state.memtable.length;
      const memRows = state.memtable.length
        ? state.memtable.map((row, index) => `<tr><td class="mono">#${String(seqBase + index + 1).padStart(3, "0")}</td><td class="mono">${row.customer}</td><td>${row.item}</td><td class="mono">${row.day}</td></tr>`).join("")
        : `<tr><td colspan="4" class="empty">empty — appended orders land here first</td></tr>`;
      const memBoard = `<div class="model-board"><small>Memtable · in memory, arrival order</small><table class="model-table" aria-label="Memtable in arrival order"><thead><tr><th>Order</th><th>Customer</th><th>Item</th><th>Day</th></tr></thead><tbody>${memRows}</tbody></table></div>`;
      const chunks = state.tables.length
        ? `<div class="lsm-arrows">↓ flush sorts it into ↓</div><div class="column-board">${state.tables.map((table, index) => {
            const label = state.flushCount - index;
            const newest = index === 0;
            const read = state.lastRead && state.lastRead.chunkIndex === index;
            const cells = sortedCustomers(table).map((customer, cellIndex) => {
              const examined = read && cellIndex < state.lastRead.examined;
              const hit = examined && state.lastRead.found && cellIndex === state.lastRead.examined - 1;
              return `<span class="mono ${hit ? "lit" : examined ? "touched" : ""}">${customer}</span>`;
            }).join("");
            return `<div class="sstable ${newest ? "newest" : ""}"><b>Chunk ${label}${newest ? " · newest" : ""}</b>${cells}</div>`;
          }).join("")}</div>`
        : `<div class="lsm-arrows">↓ flush sorts it into ↓</div><div class="lsm-arrows">no chunks yet</div>`;
      stage.innerHTML = `${memBoard}${chunks}`;
      writesOut.textContent = String(state.added + state.rewrites);
      chunksOut.textContent = String(state.tables.length);
      lastOut.textContent = state.lastRead ? String(state.lastRead.cells) : "—";
      document.getElementById("lsm-flush").disabled = state.memtable.length === 0;
      document.getElementById("lsm-compact").disabled = state.tables.length < 3;
    }

    document.getElementById("lsm-add").addEventListener("click", () => {
      const next = STREAM[state.added % STREAM.length];
      state.memtable.push({ ...next, seq: state.added + 1 });
      state.added += 1;
      state.lastRead = null;
      setStatus(status, state.memtable.length >= 6
        ? "Appended — one sequential write, no seeking, no rewriting. The memtable holds 6 orders; real engines flush at a size threshold. Press flush."
        : "Appended — one sequential write, no seeking, no rewriting. Append a few more, or flush.");
      paint();
    });

    document.getElementById("lsm-flush").addEventListener("click", () => {
      if (!state.memtable.length) {
        setStatus(status, "The memtable is empty — append an order first.", "warn");
        return;
      }
      state.flushCount += 1;
      state.tables.unshift(state.memtable.slice().sort((a, b) => a.customer.localeCompare(b.customer)));
      state.memtable = [];
      state.lastRead = null;
      setStatus(status, `Froze the memtable into sorted chunk ${state.flushCount}. Only the new orders were touched — older chunks were not rewritten. Writes stay cheap forever; the bill arrives at read time, one place to look per chunk.`);
      paint();
    });

    document.getElementById("lsm-compact").addEventListener("click", () => {
      const before = state.tables.length;
      state.rewrites += storedCells();
      const merged = state.tables.flatMap((table) => table.slice().sort((a, b) => a.customer.localeCompare(b.customer))).sort((a, b) => a.customer.localeCompare(b.customer));
      const half = Math.ceil(merged.length / 2);
      state.tables = [merged.slice(half), merged.slice(0, half)];
      state.lastRead = null;
      setStatus(status, `Merged ${before} chunks into 2 — but "free" is the trap: every stable cell was read and rewritten (${state.rewrites} extra cell-writes so far). That background cost is the write tax of append-only storage, paid in bulk here instead of on every insert.`);
      paint();
    });

    document.getElementById("lsm-read").addEventListener("click", () => {
      const target = document.getElementById("lsm-target").value;
      let examined = 0;
      const memCustomers = state.memtable.map((row) => row.customer);
      examined += memCustomers.length;
      if (memCustomers.includes(target)) {
        state.lastRead = { cells: examined, found: true, chunkIndex: -1 };
        setStatus(status, `Found ${target} in the memtable after checking ${examined} waiting order(s) — newest data is searched first, so the answer beats any older copy.`, "ok");
        paint();
        return;
      }
      for (let index = 0; index < state.tables.length; index += 1) {
        const column = sortedCustomers(state.tables[index]);
        let inChunk = 0;
        let found = false;
        for (const customer of column) {
          inChunk += 1;
          if (customer === target) { found = true; break; }
          if (customer > target) break;
        }
        examined += inChunk;
        state.lastRead = { cells: examined, found, chunkIndex: index, examined };
        if (found) {
          setStatus(status, `Found ${target} in chunk ${state.flushCount - index} after ${inChunk} sorted entr${inChunk === 1 ? "y" : "ies"} — ${examined} entries in total. Sorted columns let the search stop early; Lesson 09’s bloom filters skip whole chunks before it starts.`, "ok");
          paint();
          return;
        }
        if (index === state.tables.length - 1) {
          setStatus(status, `Checked the memtable and ${state.tables.length} sorted chunk${state.tables.length === 1 ? "" : "s"} — ${examined} entries — and ${target} never ordered. A miss must visit every chunk to be sure: misses are the expensive case, and every chunk you accumulate makes them worse until compaction trims the stack.`, "warn");
          paint();
          return;
        }
      }
      setStatus(status, "Nothing to search yet — append and flush first.", "warn");
    });

    document.getElementById("lsm-reset").addEventListener("click", () => {
      state = freshLsmState();
      setStatus(status, "Append a few orders, flush, then go looking for Omar.");
      paint();
    });

    paint();
  }

  DSL.registerRenderer("columnar-lsm", renderColumnarLsm);
})(window.DataSystemsLab);
