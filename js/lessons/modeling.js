(function registerModelingLesson(DSL) {
  "use strict";

  const PHONE_OLD = "555-0101";
  const PHONE_NEW = "555-0199";

  const ORDERS = [
    { id: "#101", customer: "Maya", phone: PHONE_OLD, item: "Lemon cake", price: "$24" },
    { id: "#102", customer: "Omar", phone: "555-0202", item: "Carrot cake", price: "$22" },
    { id: "#103", customer: "Maya", phone: PHONE_OLD, item: "Sourdough", price: "$9" },
    { id: "#104", customer: "Ana", phone: "555-0303", item: "Croissant", price: "$4" },
  ];

  const CUSTOMERS = [
    { id: "C1", name: "Maya", phone: PHONE_OLD },
    { id: "C2", name: "Omar", phone: "555-0202" },
    { id: "C3", name: "Ana", phone: "555-0303" },
  ];

  const ITEMS = [
    { id: "I1", name: "Lemon cake", price: "$24" },
    { id: "I2", name: "Carrot cake", price: "$22" },
    { id: "I3", name: "Sourdough", price: "$9" },
    { id: "I4", name: "Croissant", price: "$4" },
  ];

  const CUST_ID = { Maya: "C1", Omar: "C2", Ana: "C3" };
  const ITEM_ID = { "Lemon cake": "I1", "Carrot cake": "I2", Sourdough: "I3", Croissant: "I4" };

  // Lab 01A hunt: notebook size → how many of those orders are Maya's.
  const HUNT_COPIES = { 4: 2, 24: 5, 120: 14 };
  const HUNT_SECONDS = 10;
  const SCAN_MS = 45;
  const HUNT_NAMES = ["Omar", "Ana", "Lena", "Raj", "Kofi", "Yuki", "Ines", "Theo", "Priya", "Sam"];
  const HUNT_MENU = [["Lemon cake", "$24"], ["Carrot cake", "$22"], ["Sourdough", "$9"], ["Croissant", "$4"], ["Rye loaf", "$8"], ["Eclair", "$5"], ["Babka", "$14"], ["Scone", "$3"]];

  // Lab 01B motion.
  const MOVE_MS = 720;
  const EASE = "cubic-bezier(.65,0,.35,1)";

  const DISH = { "Lemon cake": "🍋", "Carrot cake": "🥕", Sourdough: "🍞", Croissant: "🥐", "Rye loaf": "🥖", Eclair: "🍫", Babka: "🍰", Scone: "🧁" };
  const dish = (name) => `${DISH[name] || ""} ${name}`.trim();

  const LAB_IDS = ["copies", "split", "join", "drill", "quiz"];
  const LAB_NAMES = { copies: "01A Copies", split: "01B Split", join: "01C Join", drill: "Drill", quiz: "Quiz" };
  const LAB_KEY = "dsl-modeling-labs";

  // Lab 01C: the screen row both lanes assemble for order #103.
  const SLOTS = [["id", "order"], ["name", "name"], ["phone", "phone"], ["item", "item"], ["price", "price"]];

  // Production drill: a month of customer changes, and what each response does with them.
  const RESPONSES = {
    repair: { tag: "keep the design", title: "Give the joins fast paths", sub: "keys + indexes", time: "4 min", owner: "not needed" },
    refresh: { tag: "keep the design", title: "Refreshed report copy", sub: "a nightly job owns it", time: "90 s", owner: "nightly refresh job" },
    wide: { tag: "the shortcut", title: "One wide table", sub: "copy everything · no owner", time: "3 min", owner: "none" },
  };
  const DRILL_EVENTS = [
    { day: 4, fact: "Maya’s phone changed", rows: 3 },
    { day: 9, fact: "Omar moved house", rows: 2 },
    { day: 15, fact: "Carrot cake went up to $24", rows: 4 },
    { day: 22, fact: "Ana changed her email", rows: 1 },
    { day: 27, fact: "Maya’s phone changed again", rows: 3 },
  ];
  const DRILL_DAYS = 30;

  const QUIZ = [
    { prompt: "Maya’s phone number is copied onto every one of her order rows. What breaks first?", options: ["The table runs out of rows", "Copies drift apart when someone forgets one", "The database refuses duplicated text"], answer: 1, why: "Redundant copies turn every edit into a search-and-replace across unknown rows. Miss one and the rows disagree — the update anomaly from Lab 01A." },
    { prompt: "A cell holds “Maya · 555-0101”. Splitting it into separate cells is the move databases call…", options: ["1NF — one value per cell", "Denormalization", "VACUUM"], answer: 0, why: "First normal form: each cell holds exactly one value, so the engine can filter, validate, and index it directly." },
    { prompt: "Cancelling a customer’s only order also erases her phone number. The cheapest structural fix?", options: ["Forbid deleting orders", "Move the phone to a Customers list and let orders point to it", "Copy the phone into a backup table"], answer: 1, why: "The phone was a fact about the person, stored on the wrong list. Moving it to where it belongs makes orders deletable without losing the customer." },
    { prompt: "A nightly report joins six lists and takes 40 minutes. The safest first move?", options: ["Copy all tables into one wide table with no sync owner", "Make the joins cheap with keys and indexes; consider an owned, refreshed copy only if it is still slow", "Split every table further"], answer: 1, why: "Slow joins are usually missing fast paths, not a shape problem. Copies without an owner are the drift bug from Lab 01A, back on purpose." },
  ];

  function setStatus(el, message, tone) {
    el.textContent = message;
    el.classList.remove("warn", "ok");
    if (tone) el.classList.add(tone);
  }

  function wonder(question, answer) {
    return `<details class="wonder"><summary><span>Wait, what?</span>${question}</summary><p>${answer}</p></details>`;
  }

  function labSide(badge) {
    return `<div class="lab-side"><span class="lab-badge">${badge}</span><span class="lab-stamp" aria-hidden="true">✓ lab done</span></div>`;
  }

  function slotsMarkup(prefix) {
    return `<div class="assembled" id="${prefix}-result" aria-live="polite">${SLOTS.map(([key, label]) => `<span class="slot" data-slot="${key}">${label}</span>`).join("")}</div>`;
  }

  function renderModeling() {
    const lesson = DSL.getLesson("modeling");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "One fact, <em>one place</em>.", "Before indexes, joins, or tuning: the shape of your data decides whether a one-line change stays a one-line change. This lesson needs nothing but a bakery order notebook.")}
      <nav class="lab-checklist" aria-label="Lesson labs">
        <strong id="lab-count">0 / ${LAB_IDS.length} labs</strong>
        ${LAB_IDS.map((id) => `<button type="button" class="lc-item" data-goto="${id}"><i aria-hidden="true"></i>${LAB_NAMES[id]}</button>`).join("")}
        <button type="button" class="lc-reset" id="lab-reset">reset</button>
      </nav>
      <section class="concept-grid">
        <div class="concept-card">
          <span class="concept-number">01 / copies</span>
          <div class="mini mini-drift" aria-hidden="true">
            <span class="mini-card"><b>#101</b><span class="mini-window"><i>555-0101</i><i class="fresh">555-0199</i></span></span>
            <span class="mini-neq">≠</span>
            <span class="mini-card lagging"><b>#103</b><span class="mini-window"><i>555-0101</i></span></span>
          </div>
          <h3>Copied facts drift apart</h3>
          <p>Write a fact on several rows and every change must find every copy. Miss one, and the rows disagree.</p>
          ${wonder("Who types the fact twice?", "Nobody, on purpose. A notebook grows by copying what is already there. Drift is what happens when only some copies get the news.")}
        </div>
        <div class="concept-card">
          <span class="concept-number">02 / lists</span>
          <div class="mini mini-pointer" aria-hidden="true">
            <span class="mini-card"><b>#103</b><span class="ref-chip">→ C1</span></span>
            <span class="mini-wire"><i></i></span>
            <span class="mini-card home"><b>C1</b>Maya · 555-0199</span>
          </div>
          <h3>One list per kind of thing</h3>
          <p>People, products and orders each get their own list. Orders point at a person by ID instead of copying them.</p>
          ${wonder("What if you need Maya’s name right now?", "Follow the pointer: look up C1 on the Customers list. One lookup, always current. Databases call the IDs <em>primary keys</em> and the stored references <em>foreign keys</em>.")}
        </div>
        <div class="concept-card">
          <span class="concept-number">03 / the trade</span>
          <div class="mini mini-stitch" aria-hidden="true">
            <span class="mini-piece a">#103</span><span class="mini-piece b">Maya</span><span class="mini-piece c">🍞 Sourdough</span>
          </div>
          <h3>Splitting costs reads</h3>
          <p>Showing one order now means visiting a few lists and stitching the pieces together. That re-stitch is a <em>join</em>.</p>
          ${wonder("So splitting just made reads slower?", "Sometimes. Writes became safe by default; read speed is bought back with indexes (Lesson 03), or with deliberate copies that have a named owner.")}
        </div>
      </section>

      <section class="lab" id="lab-copies">
        <div class="lab-top"><div><span class="lab-kicker">Lab 01A · copies</span><h2>Maya changed her phone number</h2><p class="lab-copy">Maya’s phone is written on every order she placed. Update it by hand: click each of her old numbers before the clock runs out. Then try a bigger notebook.</p></div>${labSide("update anomaly")}</div>
        <div class="controls">
          <div class="control"><span class="control-label">Notebook size</span><div class="segmented" id="copy-size" role="group" aria-label="Notebook size">
            <button type="button" data-size="4" aria-pressed="true">4 orders</button><button type="button" data-size="24" aria-pressed="false">24</button><button type="button" data-size="120" aria-pressed="false">120</button>
          </div></div>
          <button class="button primary" id="copy-change" type="button">Maya’s phone → 555-0199 · start</button>
          <button class="button" id="copy-fixall" type="button">Scan every row for stragglers</button>
          <button class="button ghost" id="copy-reset" type="button">Reset notebook</button>
        </div>
        <div class="hunt-timer" id="copy-timer" aria-hidden="true"><i id="copy-bar"></i></div>
        <div class="viz-stage model-scroll">
          <div class="model-board paper" id="copy-board">
            <small id="copy-caption">Order notebook · one big table</small>
            <div class="hunt-scroll" id="copy-scroll">
              <table class="model-table" aria-label="Bakery order notebook">
                <thead><tr><th>Order</th><th>Customer</th><th>Phone</th><th>Item</th><th>Price</th></tr></thead>
                <tbody id="copy-rows"></tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="metric-grid four">
          <div class="metric"><span>Copies of Maya’s phone</span><strong id="copy-count">2</strong><small>the notebook never tells you</small></div>
          <div class="metric"><span>Cell edits performed</span><strong id="copy-edits">0</strong><small>for one changed fact</small></div>
          <div class="metric"><span>Copies still wrong</span><strong id="copy-disagree">0</strong><small>old number still visible</small></div>
          <div class="metric"><span>Rows read to be sure</span><strong id="copy-read">0</strong><small>the price of checking</small></div>
        </div>
        <div class="viz-caption"><span class="live-status"><i class="pulse" id="copy-pulse"></i><span id="copy-status" aria-live="polite">Four orders. Press start, then click every one of Maya’s old numbers.</span></span><span class="hunt-clock"><strong id="copy-clock">10.0</strong>s left</span></div>
        ${wonder("Why does the phone appear twice at all?", "Because whoever wrote order #103 needed to call Maya, so they copied what was on #101. Nobody “duplicated data” on purpose; the notebook’s shape did.")}
      </section>

      <section class="lab" id="lab-split">
        <div class="lab-top"><div><span class="lab-kicker">Lab 01B · split</span><h2>Reshape the notebook, three steps</h2><p class="lab-copy">Same orders. Each step moves facts to where they belong; after each step, re-run the same phone change and the same cancellation to see what the new shape buys you.</p></div>${labSide("1NF → 2NF → 3NF")}</div>
        <div class="controls">
          <button class="button primary" id="split-step1" type="button">Step 1 · One value per cell</button>
          <button class="button primary" id="split-step2" type="button" disabled>Step 2 · People get their own list</button>
          <button class="button primary" id="split-step3" type="button" disabled>Step 3 · Products get their own list</button>
        </div>
        <div class="viz-stage model-scroll" id="split-stage" aria-live="polite"></div>
        <ol class="form-track" id="split-track" aria-label="Reshaping progress"><li>Notebook</li><li>1NF · one value per cell</li><li>2NF · people</li><li>3NF · products</li></ol>
        <div class="form-badge" id="split-badge">Current shape: everything in one notebook</div>
        <div class="controls">
          <button class="button" id="split-phone" type="button">Re-run: Maya’s phone changed</button>
          <button class="button" id="split-cancel" type="button">Re-run: cancel order #104</button>
          <button class="button ghost" id="split-reset" type="button">Reset notebook</button>
        </div>
        <div class="viz-caption"><span class="live-status"><i class="pulse" id="split-pulse"></i><span id="split-status" aria-live="polite">Press Step 1 to begin reshaping.</span></span></div>
        ${wonder("Why three steps instead of one “fix it” button?", "Each step answers a different question: is every cell one value? Whose fact is this? What does this row describe? Database classes name the answers 1NF, 2NF, and 3NF. The rule underneath all three is the same: every fact lives on the list of the thing it describes.")}
      </section>

      <section class="lab" id="lab-join">
        <div class="lab-top"><div><span class="lab-kicker">Lab 01C · join</span><h2>Race: stitch one order back together</h2><p class="lab-copy">Both shapes assemble order #103 for the screen at the same time. Count the lookups, then check whether what each one printed is true.</p></div>${labSide("read cost")}</div>
        <div class="controls">
          <button class="button primary" id="join-run" type="button">Race both shapes · assemble #103</button>
          <span class="control-hint">Each dot is one list lookup.</span>
        </div>
        <div class="race">
          <div class="lane" id="lane-messy">
            <div class="lane-head"><strong>One big notebook</strong><span class="hops" id="messy-hops"><i></i><i></i><i></i></span></div>
            <div class="lane-stage model-scroll" id="join-messy"></div>
            ${slotsMarkup("messy")}
            <div class="lane-flag" id="messy-flag"></div>
          </div>
          <div class="lane" id="lane-split">
            <div class="lane-head"><strong>Split lists + pointers</strong><span class="hops" id="split-hops"><i></i><i></i><i></i></span></div>
            <div class="lane-stage model-scroll" id="join-split"></div>
            ${slotsMarkup("split")}
            <div class="lane-flag" id="split-flag"></div>
          </div>
        </div>
        <div class="viz-caption"><span class="live-status"><i class="pulse" id="join-pulse"></i><span id="join-status" aria-live="polite">Press race. Both shapes start at the same moment.</span></span></div>
        ${wonder("Three lookups for one order: did the split make everything worse?", "Only this read. The messy notebook buys cheap reads with unsafe writes; the split buys safe writes with a few extra lookups. At millions of rows, Lesson 04’s B-tree keeps each pointer hop at a few page reads, so the split’s cost stays small and bounded.")}
      </section>

      <section class="lab incident-lab" id="lab-drill">
        <div class="incident-strip"><span>Production drill</span><strong>Nightly revenue report: 40 minutes across 6 joined tables</strong><span class="severity">SEV-3</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Symptom → shape</span><h2>The report got slow. What do you change?</h2><p class="lab-copy">Pick a response, then play a month in production. Customers keep changing their details; watch whether the report keeps telling the truth.</p></div>${labSide("denormalize, but on purpose")}</div>
        <div class="response-cards" role="radiogroup" aria-label="Response">
          ${Object.entries(RESPONSES).map(([key, r]) => `<button type="button" class="response-card ${key}" role="radio" aria-checked="false" data-response="${key}"><span class="rc-tag">${r.tag}</span><strong>${r.title}</strong><small>${r.sub}</small></button>`).join("")}
        </div>
        <div class="metric-grid" aria-label="Response outcome">
          <div class="metric"><span>Report time</span><strong id="drill-time">—</strong><small>was 40 min</small></div>
          <div class="metric"><span>Wrong facts in the report</span><strong id="drill-drift">—</strong><small>on the day shown</small></div>
          <div class="metric"><span>Sync owner</span><strong id="drill-owner">—</strong><small>who keeps copies truthful</small></div>
        </div>
        <div class="timeline-wrap">
          <div class="timeline-head"><span class="control-label">30 days in production</span><strong id="drill-day">Day 0</strong></div>
          <div class="timeline" id="drill-timeline" aria-hidden="true"></div>
          <div class="timeline-legend"><span class="ok">report correct</span><span class="lag">stale until tonight’s refresh</span><span class="bad">wrong, and nobody will fix it</span><span class="ev">a customer changed something</span></div>
          <div class="controls">
            <button class="button primary" id="drill-play" type="button" disabled>▶ Play 30 days</button>
            <div class="control grow"><label for="drill-scrub">Scrub the month</label><input type="range" id="drill-scrub" min="0" max="30" value="0" disabled></div>
          </div>
          <ol class="event-log" id="drill-log" aria-live="polite"></ol>
        </div>
        <div class="diagnosis" id="drill-diagnosis"><span class="diagnosis-label">Diagnosis</span><p>Pick a response to see its outcome.</p></div>
      </section>

      <section class="lab" id="lab-quiz">
        <div class="lab-top"><div><span class="lab-kicker">Check yourself</span><h2>Four calls, no jargon required</h2><p class="lab-copy">Answer with the plain-language rules from the labs; the database vocabulary is only their formal name.</p></div><div class="lab-side"><button class="button" type="button" data-quiz-reset>Reset answers</button><span class="lab-stamp" aria-hidden="true">✓ lab done</span></div></div>
        <div id="modeling-quiz">${DSL.Quiz.render(QUIZ, "Modeling review")}</div>
      </section>

      <div class="insight"><span class="insight-mark">!</span><p><strong>Transferable idea:</strong> shape decides cost before any tuning does. One fact, one place; pointers instead of copies; copies only with a named owner.</p></div>
      ${DSL.lessonFooter("modeling")}
    </article>`;
    setupLabProgress();
    setupCopyLab();
    setupSplitLab();
    setupJoinLab();
    setupDrillLab();
    DSL.Quiz.mount(document.getElementById("modeling-quiz"), QUIZ, {
      noun: "decision",
      passScore: 3,
      successTitle: "Modeling review passed",
      successCopy: "You can explain normalization without the vocabulary.",
      onComplete: ({ passed }) => { if (passed) completeLab("quiz"); },
    });
  }

  // Per-lab progress: a checklist under the header, a stamp on each lab, saved per browser.
  let labsDone = new Set();

  function readLabs() {
    try {
      const stored = JSON.parse(localStorage.getItem(LAB_KEY) || "[]");
      return new Set(Array.isArray(stored) ? stored.filter((id) => LAB_IDS.includes(id)) : []);
    } catch (error) {
      return new Set();
    }
  }

  function saveLabs() {
    try {
      localStorage.setItem(LAB_KEY, JSON.stringify([...labsDone]));
    } catch (error) {
      // Progress is a convenience; the lesson works without storage.
    }
  }

  function paintLabs() {
    document.getElementById("lab-count").textContent = `${labsDone.size} / ${LAB_IDS.length} labs`;
    LAB_IDS.forEach((id) => {
      const done = labsDone.has(id);
      document.querySelector(`.lc-item[data-goto="${id}"]`).classList.toggle("done", done);
      document.getElementById(`lab-${id}`).classList.toggle("is-done", done);
    });
  }

  function setupLabProgress() {
    labsDone = readLabs();
    document.querySelector(".lab-checklist").addEventListener("click", (event) => {
      const item = event.target.closest("[data-goto]");
      if (item) document.getElementById(`lab-${item.dataset.goto}`).scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    });
    document.getElementById("lab-reset").addEventListener("click", () => {
      labsDone.clear();
      saveLabs();
      paintLabs();
      const button = document.querySelector('[data-complete="modeling"]');
      if (button) button.classList.remove("nudge");
    });
    paintLabs();
  }

  function completeLab(id) {
    const section = document.getElementById(`lab-${id}`);
    retrigger(section, "ding");
    if (labsDone.has(id)) return;
    labsDone.add(id);
    saveLabs();
    paintLabs();
    retrigger(document.querySelector(`.lc-item[data-goto="${id}"]`), "ping");
    if (labsDone.size === LAB_IDS.length) {
      const button = document.querySelector('[data-complete="modeling"]');
      if (button && !button.classList.contains("done")) button.classList.add("nudge");
      DSL.showToast("All five labs done. Mark the lesson complete to save it to your course progress.");
    } else {
      DSL.showToast(`${LAB_NAMES[id]} done · ${labsDone.size} of ${LAB_IDS.length} labs`);
    }
  }

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // Restart a one-shot CSS animation class on an element.
  function retrigger(el, className) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
  }

  function phoneFor(name) {
    return `555-${String(202 + HUNT_NAMES.indexOf(name) * 101).padStart(4, "0")}`;
  }

  // Deterministic notebook so every learner hunts the same layout.
  function buildNotebook(size) {
    if (size === ORDERS.length) return ORDERS.map((row) => ({ ...row }));
    let seed = size * 7919;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const mayaAt = new Set();
    while (mayaAt.size < HUNT_COPIES[size]) mayaAt.add(Math.floor(rand() * size));
    return Array.from({ length: size }, (_, i) => {
      const maya = mayaAt.has(i);
      const name = maya ? "Maya" : HUNT_NAMES[Math.floor(rand() * HUNT_NAMES.length)];
      const [item, price] = HUNT_MENU[Math.floor(rand() * HUNT_MENU.length)];
      return { id: `#${101 + i}`, customer: name, phone: maya ? PHONE_OLD : phoneFor(name), item, price };
    });
  }

  function setupCopyLab() {
    let size = ORDERS.length;
    let rows = [];
    let phase = "idle"; // idle → hunt → over; scanning can follow idle or over
    let edits = 0;
    let rowsRead = 0;
    let deadline = 0;
    let startedAt = 0;
    let run = 0; // bumps on reset so stale timers from an old run do nothing
    const $ = (id) => document.getElementById(id);
    const status = $("copy-status");
    const tbody = $("copy-rows");
    const scroll = $("copy-scroll");
    const board = $("copy-board");
    const timer = $("copy-timer");
    const bar = $("copy-bar");
    const clock = $("copy-clock");
    const pulse = $("copy-pulse");

    const mayaRows = () => rows.filter((row) => row.customer === "Maya");
    const staleRows = () => mayaRows().filter((row) => row.phone === PHONE_OLD);
    const rowEl = (id) => tbody.querySelector(`tr[data-id="${id}"]`);

    function build() {
      rows = buildNotebook(size);
      tbody.innerHTML = rows.map((row) => `<tr data-id="${row.id}"><td class="mono">${row.id}</td><td>${row.customer}</td><td class="mono"><button type="button" class="phone-cell" data-id="${row.id}" aria-label="${row.customer}’s phone on order ${row.id}: ${row.phone}">${row.phone}</button></td><td>${dish(row.item)}</td><td class="mono">${row.price}</td></tr>`).join("");
      $("copy-caption").textContent = `Order notebook · one big table · ${size} orders`;
      scroll.scrollTop = 0;
      scroll.classList.toggle("tall", size > ORDERS.length);
    }

    function setPhone(row, phone) {
      row.phone = phone;
      const tr = rowEl(row.id);
      const button = tr.querySelector(".phone-cell");
      button.textContent = phone;
      button.setAttribute("aria-label", `${row.customer}’s phone on order ${row.id}: ${phone}`);
      button.classList.add("fixed");
      tr.classList.remove("stale");
      tr.children[2].classList.remove("stale-cell");
      retrigger(tr, "hot");
    }

    function setBar(fraction) {
      const f = Math.max(0, Math.min(1, fraction));
      bar.style.width = `${f * 100}%`;
      timer.classList.toggle("low", f < 0.3);
      clock.textContent = (f * HUNT_SECONDS).toFixed(1);
    }

    function paintMetrics() {
      const wrong = phase === "idle" ? 0 : staleRows().length;
      $("copy-count").textContent = phase === "hunt" ? "?" : String(mayaRows().length);
      $("copy-edits").textContent = String(edits);
      $("copy-disagree").textContent = phase === "hunt" ? "?" : String(wrong);
      $("copy-disagree").classList.toggle("bad", wrong > 0 && phase !== "hunt");
      $("copy-read").textContent = String(rowsRead);
      pulse.classList.toggle("active", phase === "hunt" || phase === "scanning");
    }

    function markStale() {
      rows.forEach((row) => {
        const isStale = row.customer === "Maya" && row.phone === PHONE_OLD;
        const tr = rowEl(row.id);
        tr.classList.toggle("stale", isStale);
        tr.children[2].classList.toggle("stale-cell", isStale);
        if (isStale) retrigger(tr, "hot-bad");
      });
    }

    function reset(message) {
      run += 1;
      phase = "idle";
      edits = 0;
      rowsRead = 0;
      board.classList.remove("hunting");
      build();
      setBar(1);
      setStatus(status, message || `${size} orders. Press start, then click every one of Maya’s old numbers.`);
      paintMetrics();
    }

    function tick(id) {
      if (id !== run || phase !== "hunt") return;
      const left = (deadline - Date.now()) / (HUNT_SECONDS * 1000);
      setBar(left);
      if (left <= 0) {
        endHunt();
        return;
      }
      DSL.setTimer(() => tick(id), 100);
    }

    function start() {
      if (phase === "hunt" || phase === "scanning") return;
      if (phase !== "idle") reset();
      phase = "hunt";
      startedAt = Date.now();
      deadline = startedAt + HUNT_SECONDS * 1000;
      board.classList.add("hunting");
      setStatus(status, `Maya’s number changed. Click every ${PHONE_OLD} on her orders before the clock runs out. The notebook won’t say how many there are.`);
      paintMetrics();
      tick(run);
    }

    function endHunt() {
      phase = "over";
      board.classList.remove("hunting");
      const missed = staleRows().length;
      const total = mayaRows().length;
      if (!missed) {
        const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
        const nudge = size < 120 ? "Try a bigger notebook." : "Impressive. Now do it for every customer who ever moves, forever.";
        setStatus(status, `All ${total} copies fixed in ${seconds}s. That was this time. ${nudge}`, "ok");
        completeLab("copies");
      } else {
        markStale();
        setStatus(status, `Time’s up. ${missed} of ${total} copies still say ${PHONE_OLD}. Maya now has two phone numbers, depending on which order you open. Scan for stragglers to fix them the slow way.`, "warn");
      }
      paintMetrics();
    }

    function clickCell(event) {
      const button = event.target.closest(".phone-cell");
      if (!button) return;
      const row = rows.find((candidate) => candidate.id === button.dataset.id);
      if (phase !== "hunt") {
        setStatus(status, phase === "scanning" ? "The scanner is reading every row…" : "Press start first. Maya hasn’t changed her number yet.");
        return;
      }
      if (row.customer !== "Maya") {
        retrigger(button, "miss");
        setStatus(status, `That’s ${row.customer}’s number. Only Maya’s copies need the change. Keep looking.`, "warn");
        return;
      }
      if (row.phone === PHONE_NEW) return;
      setPhone(row, PHONE_NEW);
      edits += 1;
      if (!staleRows().length) {
        endHunt();
        return;
      }
      setStatus(status, `Fixed ${row.id}. Are there more? The notebook won’t tell you.`);
      paintMetrics();
    }

    function follow(tr) {
      const top = tr.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
      scroll.scrollTop = top - scroll.clientHeight / 2;
    }

    function scan() {
      if (phase === "hunt" || phase === "scanning") return;
      const changed = phase !== "idle";
      const id = run;
      let fixed = 0;
      phase = "scanning";
      rowsRead = 0;
      paintMetrics();
      setStatus(status, `Reading all ${rows.length} rows, one at a time…`);
      rows.forEach((row, i) => DSL.setTimer(() => {
        if (id !== run) return;
        const previous = tbody.querySelector("tr.scan");
        if (previous) previous.classList.remove("scan");
        const tr = rowEl(row.id);
        tr.classList.add("scan");
        follow(tr);
        rowsRead = i + 1;
        if (changed && row.customer === "Maya" && row.phone === PHONE_OLD) {
          setPhone(row, PHONE_NEW);
          edits += 1;
          fixed += 1;
        }
        paintMetrics();
      }, i * SCAN_MS));
      DSL.setTimer(() => {
        if (id !== run) return;
        const last = tbody.querySelector("tr.scan");
        if (last) last.classList.remove("scan");
        phase = changed ? "over" : "idle";
        const n = rows.length;
        if (!changed) setStatus(status, `Read all ${n} rows. Nothing was stale because nothing has changed yet, but the scan still cost ${n} reads.`, "warn");
        else if (fixed) setStatus(status, `Fixed ${fixed} straggler${fixed === 1 ? "" : "s"}, after reading all ${n} rows. At a million orders, that is a million reads for one phone number.`, "ok");
        if (changed && !staleRows().length) completeLab("copies");
        else setStatus(status, `Read all ${n} rows to confirm nothing was missed. With copies, “are we sure?” always costs a full scan.`, "warn");
        paintMetrics();
      }, rows.length * SCAN_MS + 150);
    }

    $("copy-size").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-size]");
      if (!button) return;
      size = Number(button.dataset.size);
      $("copy-size").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      reset();
    });
    tbody.addEventListener("click", clickCell);
    $("copy-change").addEventListener("click", start);
    $("copy-fixall").addEventListener("click", scan);
    $("copy-reset").addEventListener("click", () => reset());
    reset("Four orders. Press start, then click every one of Maya’s old numbers.");
  }

  function freshSplitState() {
    return { stage: 0, mayaPhone: PHONE_OLD, applied: [], anaCancelled: false, anaGone: false };
  }

  // A keyed value. data-from names the keys it absorbs when the notebook is reshaped.
  function flip(key, text, options = {}) {
    const from = options.from && options.from.length ? ` data-from="${options.from.join(" ")}"` : "";
    return `<span class="flip${options.cls ? ` ${options.cls}` : ""}" data-flip="${key}"${from}>${text}</span>`;
  }

  function captureFlip(root) {
    const snapshot = new Map();
    root.querySelectorAll("[data-flip]").forEach((el) => {
      snapshot.set(el.dataset.flip, { rect: el.getBoundingClientRect(), text: el.textContent, mono: Boolean(el.closest(".mono")) });
    });
    root.querySelectorAll("[data-board]").forEach((el) => snapshot.set(`board:${el.dataset.board}`, {}));
    return snapshot;
  }

  function ghostAt(root, source, rootRect) {
    const ghost = document.createElement("span");
    ghost.className = `flip-ghost${source.mono ? " mono" : ""}`;
    ghost.textContent = source.text;
    ghost.style.left = `${source.rect.left - rootRect.left + root.scrollLeft}px`;
    ghost.style.top = `${source.rect.top - rootRect.top + root.scrollTop}px`;
    root.appendChild(ghost);
    return ghost;
  }

  // FLIP: each keyed value slides from where it was to where it now lives.
  // Several old copies landing in one cell merge into it; values with no new home fade out.
  function playFlip(root, before) {
    if (reducedMotion() || !before.size) return;
    const rootRect = root.getBoundingClientRect();
    const consumed = new Set();
    root.querySelectorAll("[data-board]").forEach((el) => {
      if (!before.has(`board:${el.dataset.board}`)) el.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], { duration: 360, easing: "ease-out" });
    });
    root.querySelectorAll("[data-flip]").forEach((el, i) => {
      const own = el.dataset.flip;
      const keys = before.has(own) ? [own] : (el.dataset.from || "").split(" ").filter((key) => before.has(key));
      if (!keys.length) {
        el.animate([{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: MOVE_MS * 0.7, easing: "cubic-bezier(.2,.8,.2,1.3)", fill: "backwards" });
        return;
      }
      keys.forEach((key) => consumed.add(key));
      const to = el.getBoundingClientRect();
      const [first, ...extras] = keys.map((key) => before.get(key));
      const delay = Math.min(i * 12, 240);
      const dx = first.rect.left - to.left;
      const dy = first.rect.top - to.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: MOVE_MS, delay, easing: EASE, fill: "backwards" });
      }
      extras.forEach((source) => {
        const ghost = ghostAt(root, source, rootRect);
        const gx = to.left - source.rect.left;
        const gy = to.top - source.rect.top;
        ghost.animate([
          { transform: "none", opacity: 1 },
          { transform: `translate(${gx}px, ${gy}px)`, opacity: 1, offset: 0.85 },
          { transform: `translate(${gx}px, ${gy}px) scale(.6)`, opacity: 0 },
        ], { duration: MOVE_MS + 120, delay, easing: EASE, fill: "backwards" }).onfinish = () => ghost.remove();
      });
      if (extras.length) {
        el.animate([{ transform: "scale(1)" }, { transform: "scale(1.3)", backgroundColor: "var(--lime)" }, { transform: "scale(1)" }], { duration: 420, delay: delay + MOVE_MS, easing: "ease-out" });
      }
    });
    before.forEach((source, key) => {
      if (consumed.has(key) || !source.rect || root.querySelector(`[data-flip="${key}"]`)) return;
      const ghost = ghostAt(root, source, rootRect);
      ghost.classList.add("leaving");
      ghost.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(10px) scale(.85)" }], { duration: 480, easing: "ease-in", fill: "forwards" }).onfinish = () => ghost.remove();
    });
  }

  function setupSplitLab() {
    let state = freshSplitState();
    const stage = document.getElementById("split-stage");
    const badge = document.getElementById("split-badge");
    const track = document.getElementById("split-track");
    const status = document.getElementById("split-status");
    const step1 = document.getElementById("split-step1");
    const step2 = document.getElementById("split-step2");
    const step3 = document.getElementById("split-step3");

    const BADGES = [
      "Current shape: everything in one notebook",
      "Databases call this 1NF: every cell holds exactly one value",
      "2NF: facts about a person live on the Customers list",
      "3NF: facts about a product live on the Items list",
    ];

    function splitMarkup(b) {
      const orders = ORDERS.filter((o) => o.id !== "#104" || !(b.anaCancelled && b.stage >= 2));
      const phoneOf = (o) => (o.customer === "Maya" ? (b.applied.includes(o.id) ? PHONE_NEW : PHONE_OLD) : o.phone);
      const goneCls = (o) => (b.anaCancelled && o.id === "#104" ? "gone" : "");
      const staleCls = (o) => (o.customer === "Maya" && b.applied.length && !b.applied.includes(o.id) ? "stale-cell" : "");
      const idCell = (o) => `<td class="mono">${flip(`id-${o.id}`, o.id)}</td>`;

      if (b.stage === 0) {
        const rows = orders.map((o) => `<tr class="${goneCls(o)}">${idCell(o)}<td class="${staleCls(o)}">${flip(`name-${o.id}`, o.customer)} · <span class="mono">${flip(`phone-${o.id}`, phoneOf(o))}</span></td><td>${flip(`item-${o.id}`, dish(o.item))} · <span class="mono">${flip(`price-${o.id}`, o.price)}</span></td></tr>`).join("");
        return boardMarkup("Order notebook · one big table", ["Order", "Who", "What"], rows, "orders");
      }

      if (b.stage === 1) {
        const rows = orders.map((o) => `<tr class="${goneCls(o)}">${idCell(o)}<td>${flip(`name-${o.id}`, o.customer)}</td><td class="mono ${staleCls(o)}">${flip(`phone-${o.id}`, phoneOf(o))}</td><td>${flip(`item-${o.id}`, dish(o.item))}</td><td class="mono">${flip(`price-${o.id}`, o.price)}</td></tr>`).join("");
        return boardMarkup("Order notebook · one value per cell", ["Order", "Customer", "Phone", "Item", "Price"], rows, "orders");
      }

      const sourcesFor = (field, test) => ORDERS.filter(test).map((o) => `${field}-${o.id}`);
      const customerRows = CUSTOMERS.filter((c) => c.id !== "C3" || !b.anaGone).map((c) => {
        const lit = c.id === "C3" && b.anaCancelled;
        const mine = (o) => o.customer === c.name;
        return `<tr class="${lit ? "lit" : ""}"><td class="mono">${flip(`cid-${c.id}`, c.id, { cls: "key-chip" })}</td><td>${flip(`cname-${c.id}`, c.name, { from: sourcesFor("name", mine) })}</td><td class="mono">${flip(`cphone-${c.id}`, c.id === "C1" ? b.mayaPhone : c.phone, { from: sourcesFor("phone", mine) })}</td></tr>`;
      }).join("");
      const refCell = (o) => `<td class="mono">${flip(`ref-${o.id}`, `→ ${CUST_ID[o.customer]}`, { cls: "ref-chip" })}</td>`;

      if (b.stage === 2) {
        const rows = orders.map((o) => `<tr>${idCell(o)}${refCell(o)}<td>${flip(`item-${o.id}`, dish(o.item))}</td><td class="mono">${flip(`price-${o.id}`, o.price)}</td></tr>`).join("");
        return `${boardMarkup("Customers list", ["ID", "Name", "Phone"], customerRows, "customers")}${boardMarkup("Order notebook · people extracted", ["Order", "Customer", "Item", "Price"], rows, "orders")}`;
      }

      const itemRows = ITEMS.map((item) => {
        const mine = (o) => o.item === item.name;
        return `<tr><td class="mono">${flip(`iid-${item.id}`, item.id, { cls: "key-chip" })}</td><td>${flip(`iname-${item.id}`, dish(item.name), { from: sourcesFor("item", mine) })}</td><td class="mono">${flip(`iprice-${item.id}`, item.price, { from: sourcesFor("price", mine) })}</td></tr>`;
      }).join("");
      const rows = orders.map((o) => `<tr>${idCell(o)}${refCell(o)}<td class="mono">${flip(`iref-${o.id}`, `→ ${ITEM_ID[o.item]}`, { cls: "ref-chip" })}</td></tr>`).join("");
      return `<div class="split-boards">${boardMarkup("Customers", ["ID", "Name", "Phone"], customerRows, "customers")}${boardMarkup("Items", ["ID", "Item", "Price"], itemRows, "items")}</div>${boardMarkup("Order notebook · pure references", ["Order", "Customer", "Item"], rows, "orders")}`;
    }

    function paint(animate = true) {
      const before = animate ? captureFlip(stage) : new Map();
      stage.querySelectorAll(".flip-ghost").forEach((ghost) => ghost.remove());
      stage.innerHTML = splitMarkup(state);
      playFlip(stage, before);
      badge.textContent = BADGES[state.stage];
      [...track.children].forEach((li, i) => {
        li.classList.toggle("done", i < state.stage);
        li.classList.toggle("current", i === state.stage);
      });
    }

    const byKey = (key) => stage.querySelector(`[data-flip="${key}"]`);

    // After the split, one edit ripples out to every order that points at C1.
    function ripple() {
      retrigger(byKey("cphone-C1"), "ping");
      ORDERS.filter((o) => o.customer === "Maya").forEach((o, i) => {
        DSL.setTimer(() => retrigger(byKey(`ref-${o.id}`), "ping"), 380 + i * 200);
      });
    }

    function applyStep(nextStage, message) {
      state.stage = nextStage;
      if (nextStage >= 2) {
        const healed = state.applied.length === 1;
        state.applied = ["#101", "#103"];
        setStatus(status, healed ? `${message} Watch the two phone copies merge: the fresh value won, and future edits have one place to land.` : message);
      } else {
        setStatus(status, message);
      }
      paint();
    }

    step1.addEventListener("click", () => {
      step1.disabled = true;
      step2.disabled = false;
      applyStep(1, "Packed cells are split. Nothing else changed: Maya’s phone still appears on two order rows.");
    });

    step2.addEventListener("click", () => {
      step2.disabled = true;
      step3.disabled = false;
      applyStep(2, "Customer facts moved to a Customers list. Orders now point at “C1” instead of copying “Maya · 555-0101”. Those IDs are the database’s primary keys and foreign keys.");
    });

    step3.addEventListener("click", () => {
      step3.disabled = true;
      applyStep(3, "Product facts moved to an Items list. Orders are now pure references, the smallest and safest rows in the notebook.");
      DSL.setTimer(() => completeLab("split"), MOVE_MS + 300);
    });

    document.getElementById("split-phone").addEventListener("click", () => {
      if (state.stage >= 2) {
        if (state.mayaPhone === PHONE_NEW) {
          setStatus(status, "Maya’s number is already current, and it lives in exactly one cell. Re-running this test can never find a forgotten copy, because none can exist.", "ok");
          ripple();
          return;
        }
        state.mayaPhone = PHONE_NEW;
        setStatus(status, "One cell edited on the Customers list, and every order that points at C1 sees it. The fact has one home; copies cannot disagree anymore.", "ok");
        paint();
        ripple();
        return;
      }
      const remaining = ["#101", "#103"].filter((id) => !state.applied.includes(id));
      if (!remaining.length) {
        setStatus(status, "Both copies fixed, this time. Nothing in this shape reminds you where the copies are; at 40,000 orders, one will be missed.", "warn");
        return;
      }
      const target = remaining[0];
      state.mayaPhone = PHONE_NEW;
      state.applied.push(target);
      setStatus(status, target === "#101"
        ? "Edited order #101. Maya’s phone still shows the old number on #103, and nobody marked where the copies live."
        : "Edited order #103. Finding that copy was your job, and nobody lists where the copies live.", "warn");
      paint();
      retrigger(byKey(`phone-${target}`), "ping");
    });

    document.getElementById("split-cancel").addEventListener("click", () => {
      if (state.anaCancelled) {
        setStatus(status, "Order #104 is already cancelled. Reset the notebook to try the same cancellation in the other shape.", "warn");
        return;
      }
      state.anaCancelled = true;
      if (state.stage < 2) {
        state.anaGone = true;
        setStatus(status, "Order #104 is gone, and Ana vanished with it. Her phone number was only ever a passenger on the order row. One deletion erased another fact, and splitting later can’t bring her back.", "warn");
      } else {
        setStatus(status, "Order #104 is gone. Ana is still on the Customers list; her facts outlive the order. Deleting one thing no longer erases another.", "ok");
      }
      paint();
    });

    document.getElementById("split-reset").addEventListener("click", () => {
      state = freshSplitState();
      step1.disabled = false;
      step2.disabled = true;
      step3.disabled = true;
      setStatus(status, "Press Step 1 to begin reshaping.");
      paint();
    });

    paint(false);
  }

  function boardMarkup(title, headers, rows, key) {
    return `<div class="model-board${key === "orders" ? " paper" : ""}"${key ? ` data-board="${key}"` : ""}><small>${title}</small><table class="model-table" aria-label="${title}"><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function setupJoinLab() {
    const status = document.getElementById("join-status");
    const pulse = document.getElementById("join-pulse");
    const runButton = document.getElementById("join-run");
    const messy = document.getElementById("join-messy");
    const split = document.getElementById("join-split");
    let running = false;

    function renderLanes() {
      // Lab 01A's leftover: #101 got Maya's new number, #103's copy did not.
      const phoneOf = (o) => (o.id === "#101" ? PHONE_NEW : o.phone);
      const messyRows = ORDERS.map((o) => `<tr data-row="${o.id}"><td class="mono">${o.id}</td><td>${o.customer}</td><td class="mono${o.id === "#103" ? " stale-cell" : ""}">${phoneOf(o)}</td><td>${dish(o.item)}</td><td class="mono">${o.price}</td></tr>`).join("");
      messy.innerHTML = boardMarkup("Order notebook · one big table", ["Order", "Customer", "Phone", "Item", "Price"], messyRows, "orders");

      const orderRows = ORDERS.map((o) => `<tr data-row="${o.id}"><td class="mono">${o.id}</td><td class="mono"><span class="ref-chip" data-ref="${o.id}-c">→ ${CUST_ID[o.customer]}</span></td><td class="mono"><span class="ref-chip" data-ref="${o.id}-i">→ ${ITEM_ID[o.item]}</span></td></tr>`).join("");
      const customerRows = CUSTOMERS.map((c) => `<tr data-row="${c.id}"><td class="mono"><span class="key-chip">${c.id}</span></td><td>${c.name}</td><td class="mono">${c.id === "C1" ? PHONE_NEW : c.phone}</td></tr>`).join("");
      const itemRows = ITEMS.map((item) => `<tr data-row="${item.id}"><td class="mono"><span class="key-chip">${item.id}</span></td><td>${dish(item.name)}</td><td class="mono">${item.price}</td></tr>`).join("");
      split.innerHTML = `${boardMarkup("Orders", ["Order", "Customer", "Item"], orderRows, "orders")}${boardMarkup("Customers", ["ID", "Name", "Phone"], customerRows)}${boardMarkup("Items", ["ID", "Item", "Price"], itemRows)}<svg class="join-arrows" aria-hidden="true"><defs><marker id="join-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"></path></marker></defs></svg>`;

      document.querySelectorAll("#lab-join .slot").forEach((slot) => {
        slot.className = "slot";
        slot.textContent = SLOTS.find(([key]) => key === slot.dataset.slot)[1];
      });
      document.querySelectorAll("#lab-join .hops i").forEach((dot) => dot.classList.remove("on"));
      ["messy", "split"].forEach((lane) => {
        const flag = document.getElementById(`${lane}-flag`);
        flag.textContent = "";
        flag.className = "lane-flag";
      });
    }

    function light(stage, id) {
      const row = stage.querySelector(`tr[data-row="${id}"]`);
      if (row) row.classList.add("lit");
    }

    function hop(lane, n) {
      const dot = document.querySelectorAll(`#${lane}-hops i`)[n - 1];
      dot.classList.add("on");
      retrigger(dot, "ping");
    }

    function fill(lane, key, text, extra) {
      const slot = document.querySelector(`#${lane}-result [data-slot="${key}"]`);
      slot.textContent = text;
      slot.className = `slot filled${extra ? ` ${extra}` : ""}`;
      retrigger(slot, "ping");
    }

    function flag(lane, text, tone) {
      const el = document.getElementById(`${lane}-flag`);
      el.textContent = text;
      el.className = `lane-flag show ${tone}`;
    }

    // Draw a pointer from an order's reference chip to the row it names.
    function arrow(from, to) {
      const svg = split.querySelector(".join-arrows");
      svg.style.width = `${split.scrollWidth}px`;
      svg.style.height = `${split.scrollHeight}px`;
      const base = split.getBoundingClientRect();
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      const x1 = a.left + a.width / 2 - base.left + split.scrollLeft;
      const y1 = a.bottom - base.top + split.scrollTop;
      const x2 = b.right - base.left + split.scrollLeft + 6;
      const y2 = b.top + b.height / 2 - base.top + split.scrollTop;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${x1} ${y1} C ${x1} ${y1 + (y2 - y1) * 0.6}, ${x2 + 70} ${y2}, ${x2} ${y2}`);
      svg.appendChild(path);
      if (reducedMotion()) {
        path.setAttribute("marker-end", "url(#join-head)");
        return;
      }
      const length = path.getTotalLength();
      path.style.strokeDasharray = String(length);
      path.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], { duration: 420, easing: "ease-out" }).onfinish = () => {
        path.style.strokeDasharray = "";
        path.setAttribute("marker-end", "url(#join-head)");
      };
    }

    function race() {
      if (running) return;
      running = true;
      runButton.disabled = true;
      renderLanes();
      pulse.classList.add("active");
      setStatus(status, "Go! Both shapes look up order #103 at the same moment.");
      const at = (ms, fn) => DSL.setTimer(fn, reducedMotion() ? ms / 4 : ms);

      // Messy lane: one lookup and every field is already in the row.
      at(500, () => {
        light(messy, "#103");
        hop("messy", 1);
        fill("messy", "id", "#103");
        fill("messy", "name", "Maya");
        fill("messy", "phone", PHONE_OLD, "wrong");
        fill("messy", "item", dish("Sourdough"));
        fill("messy", "price", "$9");
      });
      at(850, () => flag("messy", "🏁 Finished in 1 lookup, but it printed a stale phone", "warn"));

      // Split lane: find the order, then follow each pointer to its list.
      at(500, () => {
        light(split, "#103");
        hop("split", 1);
        fill("split", "id", "#103");
      });
      at(1100, () => {
        setStatus(status, "The split lane follows → C1 to the Customers list…");
        arrow(split.querySelector('[data-ref="#103-c"]'), split.querySelector('tr[data-row="C1"] .key-chip'));
      });
      at(1550, () => {
        light(split, "C1");
        hop("split", 2);
        fill("split", "name", "Maya");
        fill("split", "phone", PHONE_NEW);
      });
      at(1950, () => {
        setStatus(status, "…then → I3 to the Items list.");
        arrow(split.querySelector('[data-ref="#103-i"]'), split.querySelector('tr[data-row="I3"] .key-chip'));
      });
      at(2400, () => {
        light(split, "I3");
        hop("split", 3);
        fill("split", "item", dish("Sourdough"));
        fill("split", "price", "$9");
      });
      at(2750, () => {
        flag("split", "🏁 Finished in 3 lookups, every field current", "ok");
        setStatus(status, `The notebook won on speed and printed ${PHONE_OLD}, because #103’s copy missed Maya’s update. The split took three lookups and every field is true. That re-stitch is a join.`);
        pulse.classList.remove("active");
        runButton.disabled = false;
        runButton.textContent = "Race again";
        running = false;
        completeLab("join");
      });
    }

    runButton.addEventListener("click", race);
    renderLanes();
  }

  function setupDrillLab() {
    const DIAGNOSIS = {
      repair: "The joins were slow because the pointers had no fast path. Keys and indexes make each lookup cheap while every fact keeps exactly one home. Try this before any copying: it fixes speed without creating a second source of truth.",
      refresh: "A materialized copy with a named owner: the report reads one flat table, and drift is bounded by the refresh schedule. This is denormalization as a deliberate, owned trade, acceptable when staleness up to the refresh interval is tolerable.",
      wide: "The wide copy is fast and wrong-in-waiting. Every fact now lives in two designs and nothing owns keeping the copy current. This is denormalization without an owner: the drift bug from Lab 01A, back on purpose.",
    };
    const totalRows = DRILL_EVENTS.reduce((sum, e) => sum + e.rows, 0);
    const AFTER_MONTH = {
      repair: "A month of changes and zero wrong facts: the report reads the source, and every fact still has one home. Fast enough, and nothing to keep in sync.",
      refresh: "Every change was stale for at most one day, then the nightly refresh caught it. Bounded drift with a named owner is a trade you chose, not a bug you found.",
      wide: `Now you pay twice: ${totalRows} facts in the report are wrong and the count only climbs, because nobody’s job is to fix them. You still have to hunt the drifted copies, then add the sync owner you skipped. The refresh copy reached similar speed the honest way.`,
    };
    const CONSEQUENCE = {
      repair: () => "the report reads the source, so it is already correct",
      refresh: () => "stale until tonight, then the refresh fixes it",
      wide: (e) => `${e.rows} more report row${e.rows === 1 ? "" : "s"} wrong, and nobody’s job to fix them`,
    };

    const cards = document.querySelectorAll(".response-card");
    const timeline = document.getElementById("drill-timeline");
    const playButton = document.getElementById("drill-play");
    const scrub = document.getElementById("drill-scrub");
    const log = document.getElementById("drill-log");
    const diagnosis = document.getElementById("drill-diagnosis");
    const time = document.getElementById("drill-time");
    const drift = document.getElementById("drill-drift");
    const owner = document.getElementById("drill-owner");
    const finished = new Set();
    let response = null;
    let day = 0;
    let playing = false;
    let run = 0;

    timeline.innerHTML = Array.from({ length: DRILL_DAYS }, (_, i) => {
      const event = DRILL_EVENTS.find((e) => e.day === i + 1);
      return `<span class="tl-day" data-day="${i + 1}">${event ? `<i class="tl-event" title="Day ${event.day}: ${event.fact}"></i>` : ""}</span>`;
    }).join("");

    const wrongOn = (r, d) => {
      if (r === "repair" || d === 0) return 0;
      const hits = DRILL_EVENTS.filter((e) => (r === "refresh" ? e.day === d : e.day <= d));
      return hits.reduce((sum, e) => sum + e.rows, 0);
    };
    const toneOn = (r, d) => (!wrongOn(r, d) ? "ok" : r === "refresh" ? "lag" : "bad");

    function paint() {
      document.getElementById("drill-day").textContent = `Day ${day}`;
      scrub.value = String(day);
      timeline.querySelectorAll(".tl-day").forEach((cell) => {
        const d = Number(cell.dataset.day);
        cell.className = `tl-day${response && d <= day ? ` ${toneOn(response, d)}` : ""}${d === day ? " today" : ""}`;
      });
      playButton.textContent = playing ? "❚❚ Pause" : day >= DRILL_DAYS ? "↺ Replay the month" : "▶ Play 30 days";
      if (!response) return;

      const r = RESPONSES[response];
      const wrong = wrongOn(response, day);
      time.textContent = r.time;
      drift.textContent = String(wrong);
      drift.classList.toggle("bad", toneOn(response, day) === "bad");
      drift.classList.toggle("warn", toneOn(response, day) === "lag");
      owner.textContent = r.owner;
      owner.classList.toggle("bad", response === "wide");
      owner.classList.toggle("good", response === "repair");

      log.innerHTML = DRILL_EVENTS.filter((e) => e.day <= day).map((e) => `<li class="${response === "repair" ? "ok" : response === "refresh" ? "lag" : "bad"}"><b>Day ${e.day}</b> ${e.fact} → ${CONSEQUENCE[response](e)}</li>`).join("");

      const month = day >= DRILL_DAYS;
      const nudge = month && finished.size === 1 ? " <em>Now pick another response and compare the month.</em>" : "";
      diagnosis.classList.toggle("investigating", month && response === "wide");
      diagnosis.innerHTML = `<span class="diagnosis-label">${month ? "After a month" : "Diagnosis"}</span><p>${month ? AFTER_MONTH[response] : DIAGNOSIS[response]}${nudge}</p>`;
    }

    function reachDay(next) {
      day = Math.max(0, Math.min(DRILL_DAYS, next));
      if (day >= DRILL_DAYS && response) {
        finished.add(response);
        if (finished.size >= 2) completeLab("drill");
      }
      paint();
    }

    function stop() {
      playing = false;
      run += 1;
    }

    function step(id) {
      if (id !== run || !playing) return;
      reachDay(day + 1);
      if (day >= DRILL_DAYS) {
        playing = false;
        paint();
        return;
      }
      DSL.setTimer(() => step(id), reducedMotion() ? 40 : 170);
    }

    cards.forEach((card) => card.addEventListener("click", () => {
      response = card.dataset.response;
      cards.forEach((other) => other.setAttribute("aria-checked", String(other === card)));
      playButton.disabled = false;
      scrub.disabled = false;
      reachDay(day);
    }));

    playButton.addEventListener("click", () => {
      if (playing) {
        stop();
        paint();
        return;
      }
      if (day >= DRILL_DAYS) day = 0;
      stop();
      playing = true;
      step(run);
    });

    scrub.addEventListener("input", () => {
      stop();
      reachDay(Number(scrub.value));
    });

    paint();
  }

  DSL.registerRenderer("modeling", renderModeling);
})(window.DataSystemsLab);
