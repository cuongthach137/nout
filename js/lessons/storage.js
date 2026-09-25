(function registerStorageLesson(DSL) {
  "use strict";

  const { retrigger, wonder, labSide, fly, burst, floater, countTo } = DSL.LabKit;
  const progress = DSL.LabKit.createProgress({
    lessonId: "pages",
    labs: [{ id: "anatomy", name: "02A Page" }, { id: "buffer", name: "02B Buffer pool" }, { id: "drill", name: "Drill" }, { id: "quiz", name: "Quiz" }],
  });

  const PAGE_BYTES = 8192;
  const HEADER_BYTES = 24;
  const POINTER_BYTES = 4;
  const ROWS_PER_PAGE = 4;
  const PAGE_COUNT = 8;
  const MISS_MS = 8;
  const HIT_MS = 0.1;

  const NAMES = ["Maya", "Omar", "Ana", "Lena", "Raj", "Kofi", "Yuki", "Ines", "Theo", "Priya", "Sam", "Noor", "Ivan", "Zara", "Leo", "Mei", "Tariq", "Elif", "Bruno", "Aiko", "Dara", "Femi", "Hugo", "Iris", "Jonas", "Kira", "Luca", "Mira", "Nils", "Olga", "Pavel", "Rosa"];
  const CITIES = ["Lisbon", "Osaka", "Lagos", "Oslo", "Pune", "Accra", "Quito", "Hanoi", "Lyon", "Tunis", "Perth"];

  const customer = (id) => {
    const name = NAMES[id - 1];
    const city = CITIES[(id * 7) % CITIES.length];
    return { id, name, city, bytes: 36 + name.length * 3 + city.length * 2 };
  };
  const pageOf = (id) => Math.floor((id - 1) / ROWS_PER_PAGE);
  const idsOn = (page) => Array.from({ length: ROWS_PER_PAGE }, (_, i) => page * ROWS_PER_PAGE + i + 1);
  const pad = (id) => `#${String(id).padStart(2, "0")}`;
  const range = (page) => `${pad(page * ROWS_PER_PAGE + 1)}–${pad(page * ROWS_PER_PAGE + ROWS_PER_PAGE)}`;
  const bytes = (n) => `${Math.round(n).toLocaleString("en-US")} B`;
  const ms = (n) => `${n.toFixed(1)} ms`;
  const wait = (duration) => new Promise((resolve) => DSL.setTimer(resolve, duration));

  const QUIZ = [
    { prompt: "You ask for customer #11, a 70-byte row. What does the engine read from storage?", options: ["Exactly those 70 bytes", "The whole 8 KB page that holds #11", "Every page in the table"], answer: 1, why: "Storage moves whole pages. The row you wanted arrives together with every neighbour on its page: Lab 02A’s read amplification." },
    { prompt: "#12 sits on the same page as #11, which you fetched a moment ago. Fetching #12 next is most likely…", options: ["Another storage read", "A buffer hit: the page is already in memory", "Blocked until #11 is released"], answer: 1, why: "The page came into the buffer pool with #11, so #12 is served from RAM. Neighbours ride along for free." },
    { prompt: "A buffer pool has 2 slots. One page is needed by every other query. Which eviction rule keeps it in memory?", options: ["First in, first out", "Least recently used", "Whichever page is biggest"], answer: 1, why: "LRU refreshes a page every time it is used, so a hot page never becomes the oldest. FIFO evicts by arrival time, even if the page was used a moment ago." },
    { prompt: "GET /orders returns 12 rows but reads 10 scattered pages on a cold cache. Best first fix?", options: ["Return fewer JSON fields", "An index in the query’s order (customer_id, created_at) that also holds the shown columns", "Retry the request when it is slow"], answer: 1, why: "The rows are few but physically scattered. An index that matches the query’s order and covers its columns turns 10 random pages into a few neighbouring ones." },
  ];

  function setStatus(el, message, tone) {
    el.textContent = message;
    el.classList.remove("warn", "ok");
    if (tone) el.classList.add(tone);
  }

  function segmented(id, label, options, selected) {
    return `<div class="control"><span class="control-label">${label}</span><div class="segmented" id="${id}" role="group" aria-label="${label}">${options.map(([value, text]) => `<button type="button" data-value="${value}" aria-pressed="${value === selected}">${text}</button>`).join("")}</div></div>`;
  }

  function onSegment(id, handler) {
    const group = document.getElementById(id);
    group.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-value]");
      if (!button) return;
      group.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      handler(button.dataset.value);
    });
  }

  function renderPages() {
    const lesson = DSL.getLesson("pages");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "A database reads <em>pages</em>, not rows.", "Rows are the logical unit you ask for. Pages are the physical unit the storage engine moves. That mismatch explains much of database performance.")}
      ${progress.markup()}
      <section class="concept-grid">
        <div class="concept-card">
          <span class="concept-number">01 / page</span>
          <div class="mini st-mini-page" aria-hidden="true"><div class="st-mini-block"><span>8 KB</span><i></i><i class="want"></i><i></i><i></i></div><span class="st-mini-note">you wanted one line</span></div>
          <h3>Fixed-size block</h3>
          <p>A page holds many nearby rows. The engine fetches the whole block even when only one row matches.</p>
          ${wonder("Why not read just the one row?", "Disks, SSDs, and the operating system all move data in blocks. Asking for 70 bytes costs about the same as asking for the whole 8 KB block around them, so databases organise everything in pages.")}
        </div>
        <div class="concept-card">
          <span class="concept-number">02 / buffer</span>
          <div class="mini st-mini-buffer" aria-hidden="true"><span class="st-mini-disk">disk</span><span class="st-mini-track"><b>P3</b></span><span class="st-mini-ram">RAM<em>hit!</em></span></div>
          <h3>Memory cache</h3>
          <p>Recently used pages stay in RAM, in the buffer pool. A buffer hit is far cheaper than another storage read.</p>
          ${wonder("How much cheaper?", "In this lesson’s simplified model a storage read costs 8 ms and a buffer hit 0.1 ms: an 80× gap. Real numbers vary by hardware, but the gap is always large.")}
        </div>
        <div class="concept-card">
          <span class="concept-number">03 / locality</span>
          <div class="mini st-mini-local" aria-hidden="true"><span class="st-mini-pair"><i class="a">#11</i><i class="b">#12</i></span><span class="st-mini-costs"><em class="a">8 ms</em><em class="b">0.1 ms</em></span></div>
          <h3>Neighbours matter</h3>
          <p>Keep rows that are read together on the same pages, and the second lookup is served from a page you already loaded.</p>
          ${wonder("Who decides which rows are neighbours?", "The table’s physical order and your indexes. Rows land wherever there was room when they were inserted, unless an index or clustering keeps related rows together. Lesson 03 explores this.")}
        </div>
      </section>

      <section class="lab" id="lab-anatomy">
        <div class="lab-top"><div><span class="lab-kicker">Lab 02A · page</span><h2>You asked for one row</h2><p class="lab-copy">Click any customer on the disk shelf. The engine can’t hand you just that row: it reads the whole 8 KB page the row lives on. Then click one of its neighbours.</p></div>${labSide("1 row → 1 page")}</div>
        <div class="viz-stage st-anatomy">
          <div><div class="control-label">Disk · ${PAGE_COUNT} pages</div><div class="st-shelf" id="anat-shelf">${Array.from({ length: PAGE_COUNT }, (_, page) => `<div class="st-shelf-page" data-page="${page}"><b>P${page + 1}</b><div class="st-rows">${idsOn(page).map((id) => `<button type="button" class="st-row" data-id="${id}" aria-label="Fetch customer ${id}">${pad(id)}</button>`).join("")}</div></div>`).join("")}</div></div>
          <div><div class="control-label">In memory · the page you got</div><div class="st-page empty" id="anat-page"><p>Pick a customer on the left.</p></div></div>
        </div>
        <div class="metric-grid">
          <div class="metric"><span>Bytes you asked for</span><strong id="anat-asked">0 B</strong><small>the rows you clicked</small></div>
          <div class="metric"><span>Bytes read from disk</span><strong id="anat-read">0 B</strong><small>whole pages, 8,192 B each</small></div>
          <div class="metric"><span>Read amplification</span><strong id="anat-amp">—</strong><small>bytes read ÷ bytes asked</small></div>
        </div>
        <div class="viz-caption"><span class="live-status"><i class="pulse" id="anat-pulse"></i><span id="anat-status" aria-live="polite">Click a customer to fetch it.</span></span><button class="button ghost" id="anat-reset" type="button">Put the pages back</button></div>
        ${wonder("A real page would hold far more than four rows, right?", "Yes. An 8 KB page fits roughly a hundred rows this size. We draw four so you can see each one; the huge free-space band is where the other ninety-odd would live.")}
      </section>

      <section class="lab" id="lab-buffer">
        <div class="lab-top"><div><span class="lab-kicker">Lab 02B · buffer pool</span><h2>Keep the right pages in RAM</h2><p class="lab-copy">Fetch customers and watch pages travel from disk into a tiny buffer pool. Misses are slow; hits are nearly free. Then run the hot-page mix under both eviction rules.</p></div>${labSide("storage → memory")}</div>
        <div class="controls">
          ${segmented("bp-capacity", "Buffer slots", [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]], "2")}
          ${segmented("bp-policy", "When full, evict", [["fifo", "Oldest first · FIFO"], ["lru", "Least recent · LRU"]], "fifo")}
          ${segmented("bp-guess", "Guess first", [["off", "Off"], ["on", "On"]], "off")}
        </div>
        <div class="controls">
          <div class="control"><label for="bp-id">Customer (1–32)</label><input id="bp-id" type="number" min="1" max="32" value="11"></div>
          <button class="button primary" id="bp-fetch" type="button">Fetch</button>
          <button class="button primary" id="bp-bet-hit" type="button" hidden>Fetch · I bet hit</button>
          <button class="button primary" id="bp-bet-miss" type="button" hidden>Fetch · I bet miss</button>
          <span class="st-divider" aria-hidden="true"></span>
          <button class="button" type="button" data-workload="same">Same twice</button>
          <button class="button" type="button" data-workload="neighbour">Neighbour</button>
          <button class="button" type="button" data-workload="scan">Scan all 32</button>
          <button class="button" type="button" data-workload="hot">Hot-page mix</button>
          <button class="button ghost" id="bp-reset" type="button">Reset</button>
        </div>
        <div class="viz-stage bp-stage">
          <div class="bp-side"><div class="control-label">Disk · slow · 8 ms per read</div><div class="bp-shelf" id="bp-shelf"></div></div>
          <div class="bp-side bp-ram"><div class="control-label">Buffer pool · RAM · 0.1 ms per hit</div><div class="bp-slots" id="bp-slots"></div><div class="bp-queue" id="bp-queue" aria-label="Upcoming lookups"></div></div>
        </div>
        <div class="metric-grid four">
          <div class="metric"><span>Disk reads</span><strong id="bp-reads">0</strong><small>8 ms each</small></div>
          <div class="metric"><span>Buffer hits</span><strong id="bp-hits">0</strong><small>0.1 ms each</small></div>
          <div class="metric bp-rate-metric"><span>Hit rate</span><div class="bp-rate"><svg viewBox="0 0 36 36" aria-hidden="true"><circle class="bg" cx="18" cy="18" r="15.9"></circle><circle class="fg" id="bp-ring" cx="18" cy="18" r="15.9" pathLength="100"></circle></svg><strong id="bp-rate">—</strong></div></div>
          <div class="metric"><span>Time spent waiting</span><strong id="bp-wait">0.0 ms</strong><small>storage + memory</small></div>
        </div>
        <div class="bp-ledger-wrap"><span class="control-label">Where the time went</span><div class="bp-ledger" id="bp-ledger"></div></div>
        <div class="viz-caption"><span class="live-status"><i class="pulse" id="bp-pulse"></i><span id="bp-status" aria-live="polite">Fetch customer #11 to start.</span></span><span id="bp-score"></span></div>
        ${wonder("Why would anyone evict the oldest page instead of the least used one?", "FIFO is simpler: no bookkeeping on every hit. But it evicts a page just for being old, even if it was used a moment ago. Real engines use LRU-like schemes (PostgreSQL’s clock sweep, InnoDB’s midpoint LRU) that approximate “keep what’s used” cheaply.")}
      </section>

      <section class="lab incident-lab" id="lab-drill">
        <div class="incident-strip"><span>Production drill</span><strong>Order history p95: 1.8s</strong><span class="severity">SEV-2</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Symptom → page locality</span><h2>The query returns 12 rows. Why does it read 10 pages?</h2><p class="lab-copy">The orders table grew for two years, and a customer’s recent orders are scattered through the heap. Race the current access path against a covering index, and watch the read head.</p></div>${labSide("GET /orders")}</div>
        <div class="controls">
          ${segmented("drill-cache", "Cache", [["cold", "Cold (after a restart)"], ["warm", "Warm"]], "cold")}
          <button class="button primary" id="drill-run" type="button">Replay GET /orders on both paths</button>
        </div>
        <div class="race">
          ${laneMarkup("heap", "Index on customer_id → heap rows")}
          ${laneMarkup("covering", "Covering index (customer_id, created_at)")}
        </div>
        <div class="diagnosis" id="drill-diagnosis"><span class="diagnosis-label">Investigation</span><p>Replay the request to connect 12 logical rows with physical page work.</p></div>
        ${wonder("What does “covering” mean?", "The index stores every column the page displays, in the order the query wants. The engine reads a short, ordered run of index pages and never visits the heap. That’s PostgreSQL’s index-only scan; InnoDB gets similar locality from its clustered primary key.")}
      </section>

      <section class="lab" id="lab-quiz">
        <div class="lab-top"><div><span class="lab-kicker">Check yourself</span><h2>Four calls about pages</h2><p class="lab-copy">Use what you watched in the labs: whole pages, buffer hits, eviction, and locality.</p></div><div class="lab-side"><button class="button" type="button" data-quiz-reset>Reset answers</button>${DSL.LabKit.stamp()}</div></div>
        <div id="pages-quiz">${DSL.Quiz.render(QUIZ, "Pages review")}</div>
      </section>

      <div class="insight"><span class="insight-mark">!</span><p><strong>Transferable idea:</strong> “One lookup” does not mean “one byte of work.” Page layout, caching, and access order determine the real I/O.</p></div>
      ${DSL.lessonFooter("pages")}
    </article>`;
    progress.mount();
    setupAnatomyLab();
    setupBufferLab();
    setupDrillLab();
    DSL.Quiz.mount(document.getElementById("pages-quiz"), QUIZ, {
      noun: "call",
      passScore: 3,
      successTitle: "Pages review passed",
      successCopy: "You can explain why a small query can still do a lot of I/O.",
      onComplete: ({ passed }) => { if (passed) progress.complete("quiz"); },
    });
  }

  // Lab 02A: one row requested, one whole page read.
  function setupAnatomyLab() {
    const shelf = document.getElementById("anat-shelf");
    const pageEl = document.getElementById("anat-page");
    const status = document.getElementById("anat-status");
    const pulse = document.getElementById("anat-pulse");
    const askedEl = document.getElementById("anat-asked");
    const readEl = document.getElementById("anat-read");
    const ampEl = document.getElementById("anat-amp");
    let openPage = null;
    let wanted = new Set();
    let asked = 0;
    let read = 0;
    let busy = false;

    function pageMarkup(page) {
      const rows = idsOn(page).map(customer);
      const used = HEADER_BYTES + rows.length * POINTER_BYTES + rows.reduce((sum, row) => sum + row.bytes, 0);
      return `<div class="st-page-head"><b>Page ${page + 1}</b><span>header · ${HEADER_BYTES} B</span></div>
        <div class="st-pointers">${rows.map((row, i) => `<span data-id="${row.id}" class="${wanted.has(row.id) ? "want" : ""}">→${i + 1}</span>`).join("")}<small>line pointers · ${POINTER_BYTES} B each</small></div>
        <div class="st-free"><span>free space · ${bytes(PAGE_BYTES - used)}</span></div>
        <div class="st-tuples">${rows.slice().reverse().map((row, i) => `<div class="st-tuple ${wanted.has(row.id) ? "want" : "along"}" data-id="${row.id}" style="--i:${i}"><b>${pad(row.id)}</b><span>${row.name} · ${row.city}</span><em>${row.bytes} B</em></div>`).join("")}</div>`;
    }

    function paintMetrics() {
      countTo(askedEl, asked, { format: bytes });
      countTo(readEl, read, { format: bytes });
      if (asked) countTo(ampEl, read / asked, { format: (n) => `×${Math.round(n)}` });
      else ampEl.textContent = "—";
      shelf.querySelectorAll(".st-row").forEach((row) => row.classList.toggle("fetched", wanted.has(Number(row.dataset.id))));
      shelf.querySelectorAll(".st-shelf-page").forEach((card) => card.classList.toggle("open", Number(card.dataset.page) === openPage));
    }

    async function fetchRow(id) {
      if (busy) return;
      const row = customer(id);
      const page = pageOf(id);

      if (page === openPage) {
        if (wanted.has(id)) {
          setStatus(status, `${pad(id)} is already on the open page. Try a neighbour you haven’t clicked yet.`);
          return;
        }
        wanted.add(id);
        asked += row.bytes;
        const tuple = pageEl.querySelector(`.st-tuple[data-id="${id}"]`);
        tuple.classList.replace("along", "want");
        pageEl.querySelector(`.st-pointers [data-id="${id}"]`).classList.add("want");
        retrigger(tuple, "ping");
        burst(tuple, { count: 12 });
        floater(readEl, "+0 B", "");
        setStatus(status, `Free ride: ${pad(id)} came along with the page you already read. ${row.bytes} more bytes answered, zero bytes read from disk.`, "ok");
        paintMetrics();
        progress.complete("anatomy");
        return;
      }

      busy = true;
      pulse.classList.add("active");
      const card = shelf.querySelector(`.st-shelf-page[data-page="${page}"]`);
      retrigger(card, "st-lift");
      setStatus(status, `Reading page ${page + 1} from disk for ${pad(id)}…`);
      await fly(card, pageEl, { duration: 620, lift: 60, className: "st-flying" });
      openPage = page;
      wanted = new Set([id]);
      asked += row.bytes;
      read += PAGE_BYTES;
      pageEl.className = "st-page";
      pageEl.innerHTML = pageMarkup(page);
      retrigger(pageEl, "st-arrive");
      floater(readEl, `+${bytes(PAGE_BYTES)}`, "warn");
      paintMetrics();
      pulse.classList.remove("active");
      setStatus(status, `You asked for ${row.bytes} B. The engine read all ${bytes(PAGE_BYTES)} of page ${page + 1}, and ${ROWS_PER_PAGE - 1} neighbours came along. Now click one of them.`, "warn");
      busy = false;
    }

    shelf.addEventListener("click", (event) => {
      const button = event.target.closest(".st-row");
      if (button) fetchRow(Number(button.dataset.id));
    });

    document.getElementById("anat-reset").addEventListener("click", () => {
      if (busy) return;
      openPage = null;
      wanted = new Set();
      asked = 0;
      read = 0;
      pageEl.className = "st-page empty";
      pageEl.innerHTML = "<p>Pick a customer on the left.</p>";
      setStatus(status, "Click a customer to fetch it.");
      paintMetrics();
    });
  }

  // Lab 02B: a tiny buffer pool with visible travel, eviction, and time accounting.
  function setupBufferLab() {
    const $ = (id) => document.getElementById(id);
    const shelf = $("bp-shelf");
    const slotsEl = $("bp-slots");
    const queue = $("bp-queue");
    const ledger = $("bp-ledger");
    const status = $("bp-status");
    const pulse = $("bp-pulse");
    const score = $("bp-score");
    const input = $("bp-id");
    const POLICY = { fifo: "FIFO", lru: "LRU" };
    const WORKLOADS = {
      same: [11, 11],
      neighbour: [11, 12],
      scan: Array.from({ length: PAGE_COUNT * ROWS_PER_PAGE }, (_, i) => i + 1),
      hot: [0, 1, 0, 2, 0, 3, 0, 1, 0, 2, 0, 3].map((page, i) => page * ROWS_PER_PAGE + 1 + (i % ROWS_PER_PAGE)),
    };
    const hotReads = {};
    let capacity = 2;
    let policy = "fifo";
    let guessing = false;
    let slots = [];
    let incoming = -1;
    let clock = 0;
    let reads = 0;
    let hits = 0;
    let waited = 0;
    let guesses = 0;
    let correct = 0;
    let streak = 0;
    let busy = false;
    let run = 0;

    const card = (page, extra = "") => `<div class="bp-card ${extra}" data-page="${page}"><b>P${page + 1}</b><small>${range(page)}</small></div>`;

    function victim() {
      if (slots.length < capacity) return -1;
      const key = policy === "lru" ? "usedAt" : "loadedAt";
      return slots.reduce((best, slot, i) => (slot[key] < slots[best][key] ? i : best), 0);
    }

    function paintSlots() {
      const next = victim();
      slotsEl.innerHTML = Array.from({ length: capacity }, (_, i) => {
        const slot = slots[i];
        if (i === incoming) return `<div class="bp-slot incoming" data-slot="${i}"><span>incoming…</span></div>`;
        if (!slot) return `<div class="bp-slot" data-slot="${i}"><span>empty</span></div>`;
        return `<div class="bp-slot" data-slot="${i}">${card(slot.page, i === next ? "next-out" : "")}${i === next ? `<em class="bp-next">next out</em>` : ""}</div>`;
      }).join("");
      const cached = new Set(slots.map((slot) => slot.page));
      shelf.innerHTML = Array.from({ length: PAGE_COUNT }, (_, page) => card(page, cached.has(page) ? "cached" : "")).join("");
    }

    function paintMetrics() {
      countTo($("bp-reads"), reads);
      countTo($("bp-hits"), hits);
      countTo($("bp-wait"), waited, { format: ms });
      const total = reads + hits;
      $("bp-rate").textContent = total ? `${Math.round((hits / total) * 100)}%` : "—";
      $("bp-ring").style.strokeDashoffset = String(100 - (total ? (hits / total) * 100 : 0));
      score.textContent = guessing ? `Guesses ${correct}/${guesses}${streak > 1 ? ` · 🔥${streak}` : ""}` : "";
    }

    function ledgerAdd(kind, page) {
      const segment = document.createElement("i");
      segment.className = kind;
      segment.style.flexGrow = String(kind === "miss" ? MISS_MS : HIT_MS);
      segment.title = `${kind === "miss" ? "Disk read" : "Buffer hit"} · page ${page + 1} · ${kind === "miss" ? "8 ms" : "0.1 ms"}`;
      ledger.appendChild(segment);
    }

    function clearAll(message) {
      run += 1;
      busy = false;
      slots = [];
      incoming = -1;
      clock = 0;
      reads = 0;
      hits = 0;
      waited = 0;
      ledger.innerHTML = "";
      queue.innerHTML = "";
      pulse.classList.remove("active");
      paintSlots();
      paintMetrics();
      if (message) setStatus(status, message);
    }

    function judge(guess, outcome) {
      if (!guess) return;
      guesses += 1;
      if (guess === outcome) {
        correct += 1;
        streak += 1;
        floater(score, streak > 2 ? `🔥 ${streak} in a row` : "✓ called it", "");
      } else {
        streak = 0;
        retrigger(slotsEl, "bp-shake");
        floater(score, "✗ not this time", "bad");
      }
    }

    async function fetchRow(id, { guess = null, fast = false, token = run } = {}) {
      const page = pageOf(id);
      const index = slots.findIndex((slot) => slot.page === page);
      clock += 1;

      if (index >= 0) {
        slots[index].usedAt = clock;
        hits += 1;
        waited += HIT_MS;
        paintSlots();
        const hitCard = slotsEl.querySelector(`[data-slot="${index}"] .bp-card`);
        retrigger(hitCard, "bp-hit");
        burst(hitCard, { count: 10 });
        floater(hitCard, "+0.1 ms", "");
        ledgerAdd("hit", page);
        judge(guess, "hit");
        paintMetrics();
        setStatus(status, `Buffer hit: page ${page + 1} was already in RAM, so ${pad(id)} cost 0.1 ms.${policy === "lru" ? " LRU marks it freshly used." : " FIFO doesn’t care that it was just used."}`, "ok");
        await wait(fast ? 260 : 420);
        return "hit";
      }

      reads += 1;
      waited += MISS_MS;
      const diskCard = shelf.querySelector(`[data-page="${page}"]`);
      retrigger(diskCard, "bp-reading");
      let target = slots.length;
      let evicted = null;
      const next = victim();
      if (next >= 0) {
        target = next;
        evicted = slots[next].page;
        const outCard = slotsEl.querySelector(`[data-slot="${next}"] .bp-card`);
        outCard.classList.add("bp-evicting");
        floater(outCard, `P${evicted + 1} evicted`, "warn");
        await wait(fast ? 240 : 340);
        if (token !== run) return null;
      }
      incoming = target;
      paintSlots();
      await fly(diskCard, slotsEl.querySelector(`[data-slot="${target}"]`), { duration: fast ? 520 : 720, lift: 90, className: "bp-flying" });
      if (token !== run) return null;
      incoming = -1;
      slots[target] = { page, loadedAt: clock, usedAt: clock };
      paintSlots();
      const landed = slotsEl.querySelector(`[data-slot="${target}"] .bp-card`);
      retrigger(landed, "bp-land");
      burst(landed, { count: 7, spread: 34, colors: ["var(--line-strong)", "var(--muted)", "var(--coral)"] });
      floater(landed, "+8 ms", "bad");
      ledgerAdd("miss", page);
      judge(guess, "miss");
      paintMetrics();
      setStatus(status, `Disk read: page ${page + 1} (${range(page)}) loaded for ${pad(id)}, 8 ms.${evicted !== null ? ` ${POLICY[policy]} evicted page ${evicted + 1} to make room.` : ""}`, "warn");
      await wait(fast ? 160 : 260);
      return "miss";
    }

    async function manualFetch(guess) {
      if (busy) return;
      const id = Math.max(1, Math.min(32, Math.round(Number(input.value)) || 1));
      input.value = String(id);
      busy = true;
      pulse.classList.add("active");
      const token = run;
      await fetchRow(id, { guess, token });
      if (token !== run) return;
      pulse.classList.remove("active");
      busy = false;
    }

    function hotSummary() {
      const mine = hotReads[`${policy}-${capacity}`];
      const otherPolicy = policy === "lru" ? "fifo" : "lru";
      const theirs = hotReads[`${otherPolicy}-${capacity}`];
      let text = `Hot-page mix, ${POLICY[policy]}, ${capacity} slot${capacity === 1 ? "" : "s"}: ${mine} disk reads for 12 lookups.`;
      if (theirs === undefined) return `${text} Now switch the eviction rule and run it again.`;
      if (capacity >= 4) return `${text} ${POLICY[otherPolicy]}: ${theirs}. Every page fits in 4 slots, so the rule never matters. Shrink the pool.`;
      if (capacity === 1) return `${text} ${POLICY[otherPolicy]}: ${theirs}. One slot can only hold one page, so both rules thrash. Try 2 slots.`;
      const lru = hotReads[`lru-${capacity}`];
      const fifo = hotReads[`fifo-${capacity}`];
      progress.complete("buffer");
      return `${text} ${POLICY[otherPolicy]}: ${theirs}. LRU needed ${fifo - lru} fewer reads: every use refreshes the hot page, while FIFO evicts it just for being old.`;
    }

    async function runWorkload(name) {
      clearAll();
      const ids = WORKLOADS[name];
      const token = run;
      busy = true;
      pulse.classList.add("active");
      queue.innerHTML = ids.map((id, i) => `<span class="bp-chip" data-i="${i}">${pad(id)}</span>`).join("");
      setStatus(status, `Running ${ids.length} lookups…`);
      for (let i = 0; i < ids.length; i += 1) {
        if (token !== run) return;
        const chip = queue.querySelector(`[data-i="${i}"]`);
        chip.classList.add("now");
        chip.scrollIntoView({ block: "nearest", inline: "center" });
        const outcome = await fetchRow(ids[i], { fast: true, token });
        if (token !== run) return;
        chip.classList.replace("now", outcome);
      }
      busy = false;
      pulse.classList.remove("active");
      const summaries = {
        same: `Second fetch of #11: a hit. Page 3 was still in RAM, so the repeat cost 0.1 ms instead of 8.`,
        neighbour: `#12 was a hit although you had never asked for it: it arrived with #11’s page.`,
        scan: `32 rows, only ${reads} disk reads: each page read served ${ROWS_PER_PAGE} rows in a row.`,
      };
      if (name === "hot") hotReads[`${policy}-${capacity}`] = reads;
      setStatus(status, name === "hot" ? hotSummary() : summaries[name], "ok");
    }

    onSegment("bp-capacity", (value) => {
      capacity = Number(value);
      run += 1;
      busy = false;
      incoming = -1;
      pulse.classList.remove("active");
      while (slots.length > capacity) slots.splice(victim(), 1);
      paintSlots();
      setStatus(status, `Buffer pool resized to ${capacity} slot${capacity === 1 ? "" : "s"}.`);
    });
    onSegment("bp-policy", (value) => {
      policy = value;
      run += 1;
      busy = false;
      incoming = -1;
      pulse.classList.remove("active");
      paintSlots();
      setStatus(status, value === "lru" ? "LRU: the page used longest ago leaves first. Watch the “next out” tag move on every hit." : "FIFO: the page that arrived first leaves first, however recently it was used.");
    });
    onSegment("bp-guess", (value) => {
      guessing = value === "on";
      $("bp-fetch").hidden = guessing;
      $("bp-bet-hit").hidden = !guessing;
      $("bp-bet-miss").hidden = !guessing;
      paintMetrics();
      if (guessing) setStatus(status, "Before each fetch, bet: is the customer’s page already in RAM?");
    });

    $("bp-fetch").addEventListener("click", () => manualFetch(null));
    $("bp-bet-hit").addEventListener("click", () => manualFetch("hit"));
    $("bp-bet-miss").addEventListener("click", () => manualFetch("miss"));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") manualFetch(null);
    });
    document.querySelectorAll("[data-workload]").forEach((button) => button.addEventListener("click", () => runWorkload(button.dataset.workload)));
    $("bp-reset").addEventListener("click", () => clearAll("Buffer pool emptied. Fetch a customer to start."));
    clearAll();
  }

  function laneMarkup(name, title) {
    const cells = (kind, count, prefix) => Array.from({ length: count }, (_, i) => `<span class="st-cell" data-key="${kind}-${i + 1}">${prefix}${String(i + 1).padStart(2, "0")}</span>`).join("");
    return `<div class="lane st-lane" id="lane-${name}">
      <div class="lane-head"><strong>${title}</strong><span class="st-watch"><b id="${name}-ms">0.0 ms</b> · <span id="${name}-pages">0</span> pages</span></div>
      <div class="st-strips" id="${name}-strips">
        <span class="st-strip-label">index leaf pages</span>
        <div class="st-strip index">${cells("index", 8, "i")}</div>
        <span class="st-strip-label">heap pages · the table</span>
        <div class="st-strip heap">${cells("heap", 20, "p")}</div>
        <span class="st-skip">not needed: the index already holds every shown column</span>
        <svg class="st-arcs" aria-hidden="true"></svg>
        <span class="st-head" aria-hidden="true"></span>
      </div>
      <div class="lane-flag" id="${name}-flag"></div>
    </div>`;
  }

  // Production drill: the same 12 rows along two access paths, with a read head that shows the jumps.
  function setupDrillLab() {
    const STEPS = {
      heap: ["index-3", "heap-2", "heap-11", "heap-4", "heap-18", "heap-7", "heap-13", "heap-1", "heap-16", "heap-9"],
      covering: ["index-3", "index-4", "index-5"],
    };
    const cached = { heap: new Set(), covering: new Set() };
    const diagnosis = document.getElementById("drill-diagnosis");
    const runButton = document.getElementById("drill-run");
    let cache = "cold";
    let run = 0;

    function reset(name) {
      const strips = document.getElementById(`${name}-strips`);
      strips.querySelectorAll(".st-cell").forEach((cell) => { cell.className = "st-cell"; });
      strips.querySelector(".st-arcs").innerHTML = "";
      strips.querySelector(".st-head").classList.remove("on");
      strips.classList.toggle("skip-heap", name === "covering");
      document.getElementById(`${name}-ms`).textContent = "0.0 ms";
      document.getElementById(`${name}-ms`).dataset.value = "0";
      document.getElementById(`${name}-pages`).textContent = "0";
      const flag = document.getElementById(`${name}-flag`);
      flag.className = "lane-flag";
      flag.textContent = "";
    }

    function point(strips, cell) {
      const base = strips.getBoundingClientRect();
      const rect = cell.getBoundingClientRect();
      return { x: rect.left + rect.width / 2 - base.left, y: rect.top - base.top };
    }

    function arc(strips, from, to, tone) {
      const svg = strips.querySelector(".st-arcs");
      const lift = 12 + Math.abs(to.x - from.x) * 0.22 + Math.abs(to.y - from.y) * 0.3;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${Math.min(from.y, to.y) - lift} ${to.x} ${to.y}`);
      path.setAttribute("class", tone);
      svg.appendChild(path);
      if (DSL.LabKit.reducedMotion()) return;
      const length = path.getTotalLength();
      path.style.strokeDasharray = String(length);
      path.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], { duration: 260, easing: "ease-out" }).onfinish = () => { path.style.strokeDasharray = ""; };
    }

    async function runLane(name, token) {
      const strips = document.getElementById(`${name}-strips`);
      const head = strips.querySelector(".st-head");
      const msEl = document.getElementById(`${name}-ms`);
      const pagesEl = document.getElementById(`${name}-pages`);
      let total = 0;
      let previous = null;
      for (let i = 0; i < STEPS[name].length; i += 1) {
        const key = STEPS[name][i];
        const cell = strips.querySelector(`[data-key="${key}"]`);
        const hit = cache === "warm" && cached[name].has(key);
        const to = point(strips, cell);
        head.style.transform = `translate(${to.x - 7}px, ${to.y - 15}px)`;
        head.classList.add("on");
        if (previous) arc(strips, previous, to, hit ? "hit" : name);
        await wait(hit ? 150 : 330);
        if (token !== run) return null;
        cell.classList.add(hit ? "hit" : name === "heap" ? "miss" : "good");
        retrigger(cell, "st-pop");
        total += hit ? HIT_MS : MISS_MS;
        countTo(msEl, total, { format: ms, duration: 250 });
        pagesEl.textContent = String(i + 1);
        floater(cell, hit ? "+0.1" : "+8 ms", hit ? "" : name === "heap" ? "bad" : "");
        cached[name].add(key);
        previous = to;
        await wait(hit ? 40 : 110);
        if (token !== run) return null;
      }
      head.classList.remove("on");
      return { total, pages: STEPS[name].length };
    }

    async function race() {
      run += 1;
      const token = run;
      runButton.disabled = true;
      if (cache === "cold") {
        cached.heap.clear();
        cached.covering.clear();
      } else if (!cached.heap.size) {
        STEPS.heap.forEach((key) => cached.heap.add(key));
        STEPS.covering.forEach((key) => cached.covering.add(key));
      }
      reset("heap");
      reset("covering");
      diagnosis.className = "diagnosis investigating";
      diagnosis.innerHTML = `<span class="diagnosis-label">Trace</span><p>Both paths fetch the same 12 orders. Watch where each read head has to go.</p>`;
      const [heap, covering] = await Promise.all([runLane("heap", token), runLane("covering", token)]);
      if (token !== run || !heap || !covering) return;
      const heapFlag = document.getElementById("heap-flag");
      const coveringFlag = document.getElementById("covering-flag");
      heapFlag.textContent = `🏁 ${heap.pages} pages, ${ms(heap.total)}`;
      heapFlag.className = `lane-flag show ${cache === "cold" ? "warn" : "ok"}`;
      coveringFlag.textContent = `🏁 ${covering.pages} neighbouring pages, ${ms(covering.total)}`;
      coveringFlag.className = "lane-flag show ok";
      burst(coveringFlag, { count: 12 });
      runButton.disabled = false;
      runButton.textContent = "Replay again";
      if (cache === "cold") {
        diagnosis.className = "diagnosis warning";
        diagnosis.innerHTML = `<span class="diagnosis-label">Diagnosis</span><p>Same 12 rows, ${heap.pages} scattered pages versus ${covering.pages} neighbouring ones: ${ms(heap.total)} against ${ms(covering.total)}. The index on customer_id finds the rows, but each row pointer lands on a different heap page. A covering index on (customer_id, created_at DESC) returns them from one short, ordered range, with no heap visits. Now try the warm cache.</p>`;
        progress.complete("drill");
      } else {
        diagnosis.className = "diagnosis resolved";
        diagnosis.innerHTML = `<span class="diagnosis-label">Warm cache</span><p>Everything was already in RAM, so both paths look fast (${ms(heap.total)} vs ${ms(covering.total)}). That’s why this bug hides in staging: the scattered path only hurts on a cold cache, after a restart, a failover, or once the table outgrows memory. Fix the layout, not the cache.</p>`;
      }
    }

    onSegment("drill-cache", (value) => { cache = value; });
    runButton.addEventListener("click", race);
    reset("heap");
    reset("covering");
  }

  DSL.registerRenderer("pages", renderPages);
})(window.DataSystemsLab);
