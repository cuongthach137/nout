(function registerLatencyLesson(DSL) {
  "use strict";

  // Latency, throughput and percentiles. A seeded generator makes 200 requests to the bakery's
  // site (the same numbers in every browser): most fast, a few very slow. Explore computes
  // percentiles in SQL and has two playgrounds: tail amplification and queueing. Narrated
  // (latency-narrated.js) is the focused version; Guided (latency-guided.js) sits in between.

  const { wonder, labSide, retrigger } = DSL.LabKit;
  const code = (sql) => `<code>${DSL.Sql.highlight(sql)}</code>`;

  // ---------- Data ----------

  function mulberry32(seed) {
    let a = seed;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 200 requests: every 4th is /checkout (slower, heavier tail), the rest /menu.
  const REQUESTS = (() => {
    const rand = mulberry32(20260926);
    const rows = [];
    for (let id = 1; id <= 200; id += 1) {
      const endpoint = id % 4 === 0 ? "/checkout" : "/menu";
      const [fast, medium] = endpoint === "/checkout" ? [0.8, 0.94] : [0.92, 0.985];
      const r = rand();
      let ms = r < fast ? 45 + Math.floor(rand() * 70) : r < medium ? 160 + Math.floor(rand() * 240) : 900 + Math.floor(rand() * 1500);
      if (endpoint === "/checkout") ms += 60;
      rows.push([id, endpoint, ms]);
    }
    return rows;
  })();

  DSL.Sql.datasets.requests = `CREATE TABLE requests (\n  id INTEGER PRIMARY KEY,\n  endpoint TEXT NOT NULL,\n  ms INTEGER NOT NULL\n);\nINSERT INTO requests VALUES\n${REQUESTS.map(([id, endpoint, ms]) => `  (${id}, '${endpoint}', ${ms})`).join(",\n")};`;

  // Nearest-rank percentile: the value at position ceil(p/100 × n) in sorted order.
  function stats(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const pct = (p) => sorted[Math.ceil((p / 100) * n) - 1];
    return { n, mean: sorted.reduce((a, b) => a + b, 0) / n, p50: pct(50), p95: pct(95), p99: pct(99), max: sorted[n - 1], sorted };
  }
  const ALL = stats(REQUESTS.map((r) => r[2]));

  // P(page slow) when it waits for n calls, each slow with probability p.
  const slowPage = (n, p = 0.01) => 1 - Math.pow(1 - p, n);
  // Simple queue (M/M/1): response time = service / (1 - utilization).
  const SERVICE_MS = 50;
  const response = (rho) => SERVICE_MS / (1 - rho);

  // ---------- Explore ----------

  const progress = DSL.LabKit.createProgress({
    lessonId: "latency",
    labs: [{ id: "pct", name: `${DSL.labLabel("latency", "A")} Percentiles` }, { id: "tail", name: `${DSL.labLabel("latency", "B")} The tail` }, { id: "load", name: `${DSL.labLabel("latency", "C")} Load` }, { id: "quiz", name: "Practice" }],
  });
  const R = "requests";
  const RANKED = "WITH ranked AS (\n  SELECT endpoint, ms,\n         ROW_NUMBER() OVER (PARTITION BY endpoint ORDER BY ms) AS rn,\n         COUNT(*) OVER (PARTITION BY endpoint) AS n\n  FROM requests\n)\n";

  const CHALLENGES = {
    pct: [
      { id: "mean", dataset: R, prompt: "The dashboard's number: the <b>average</b> request time. One value.", starter: "SELECT \nFROM requests;", solution: "SELECT AVG(ms) FROM requests", hint: "<code>AVG(ms)</code>" },
      { id: "median", dataset: R, prompt: "The <b>median</b> (p50): with 200 requests, the 100th fastest. One value.", starter: "SELECT ms\nFROM requests\nORDER BY ms\n", solution: "SELECT ms FROM requests ORDER BY ms LIMIT 1 OFFSET 99", hint: "Nearest rank: position ⌈0.5 × 200⌉ = 100, so skip 99: <code>LIMIT 1 OFFSET 99</code>." },
      { id: "p99", dataset: R, prompt: "The <b>p99</b>: the 198th fastest of 200. One value.", starter: "SELECT ms\nFROM requests\nORDER BY ms\n", solution: "SELECT ms FROM requests ORDER BY ms LIMIT 1 OFFSET 197", hint: "⌈0.99 × 200⌉ = 198: <code>LIMIT 1 OFFSET 197</code>." },
      { id: "p95-each", dataset: R, prompt: "The <b>p95 for each endpoint</b>, without hard-coding counts: return <b>endpoint</b> and the value.", starter: `${RANKED}SELECT endpoint, ms\nFROM ranked\nWHERE `, solution: `${RANKED}SELECT endpoint, ms FROM ranked WHERE rn = (95 * n + 99) / 100`, hint: "Nearest rank is ⌈0.95 × n⌉. With integer division, <code>(95 * n + 99) / 100</code> rounds up: <code>WHERE rn = (95 * n + 99) / 100</code>." },
    ],
    tail: [
      { id: "over-1s", dataset: R, prompt: "How many requests took <b>a second or more</b>? One value.", starter: "SELECT COUNT(*)\nFROM requests\nWHERE ", solution: "SELECT COUNT(*) FROM requests WHERE ms >= 1000", hint: "<code>WHERE ms &gt;= 1000</code>. A handful out of 200, but each one is a customer staring at a spinner." },
      { id: "share", dataset: R, prompt: "What <b>percentage</b> of requests took over 300 ms? One value (e.g. 4.5 for 4.5%).", starter: "SELECT \nFROM requests;", solution: "SELECT 100.0 * SUM(ms > 300) / COUNT(*) FROM requests", hint: "In SQLite a comparison is 0 or 1, so <code>SUM(ms &gt; 300)</code> counts matches. Multiply by <code>100.0</code> first to avoid integer division." },
      { id: "mean-vs-max", dataset: R, prompt: "Per <b>endpoint</b>: the average and the slowest request. Return endpoint, <b>AVG(ms)</b> and <b>MAX(ms)</b>.", starter: "SELECT endpoint, \nFROM requests\n", solution: "SELECT endpoint, AVG(ms), MAX(ms) FROM requests GROUP BY endpoint", hint: "<code>GROUP BY endpoint</code>. The averages look calm; the maximums don't." },
    ],
  };

  // Goals, and the practice that checks them (js/components/practice.js). Every mode states the
  // goals at the start and ends with the recap, the checks and the interview round.
  const PRACTICE = {
    lessonId: "latency",
    goals: [
      {
        id: "terms", icon: "⏱️", title: "Name the numbers", snippet: "latency ≠ throughput\nmean 170 ms, median 101 ms",
        text: "Tell latency from throughput, and explain why the average hides what users feel.",
        recap: "<b>Latency</b> is how long one request takes; <b>throughput</b> is how many finish per second. A few multi-second requests drag the mean to 170 ms; the median is 101 ms.",
        example: {
          dataset: "requests",
          before: "SELECT id, ms FROM requests ORDER BY ms DESC",
          sql: "SELECT ROUND(AVG(ms)) AS mean,\n  (SELECT ms FROM requests ORDER BY ms LIMIT 1 OFFSET 99) AS median\nFROM requests",
          show: 4,
          mark: (row, phase) => (phase === "before" ? "bad" : ""),
          note: "The slowest few pull the mean far above the middle request.",
        },
      },
      {
        id: "tail", icon: "📊", title: "Measure the tail", snippet: "ORDER BY ms LIMIT 1 OFFSET 197",
        text: "Compute p50, p95 and p99 in SQL, and say what each one means for users.",
        recap: "A <b>percentile</b> says how many requests are at or below a value. p95 is 327 ms, and p99 is over 2 seconds: one request in a hundred waits longer than that.",
        example: {
          dataset: "requests",
          sql: "SELECT\n  (SELECT ms FROM requests ORDER BY ms LIMIT 1 OFFSET 99) AS p50,\n  (SELECT ms FROM requests ORDER BY ms LIMIT 1 OFFSET 189) AS p95,\n  (SELECT ms FROM requests ORDER BY ms LIMIT 1 OFFSET 197) AS p99",
          mark: () => "hot",
          note: "Nearest rank: the 100th, 190th and 198th of 200.",
        },
      },
      {
        id: "slowdowns", icon: "📈", title: "Predict the slowdowns", snippet: "1 − 0.99¹⁰ ≈ 10%",
        text: "Predict how the tail grows when a page fans out to many calls, and how latency explodes as a server nears full load.",
        recap: "A page waiting on 10 calls, each slow 1% of the time, is slow about 10% of the time: <b>tail amplification</b>. Near full load, <b>queueing delay</b> makes latency shoot up.",
        example: {
          after: [
            { label: "Tail amplification: each call slow 1%", columns: ["calls per page", "pages slow"], rows: [[1, "1%"], [10, "9.6%"], [100, "63%"]] },
            { label: "Queueing: 50 ms of work per request", columns: ["server busy", "response time"], rows: [["50%", "100 ms"], ["80%", "250 ms"], ["95%", "1,000 ms"]] },
          ],
          note: "From 80% to 95% busy, four times slower.",
        },
      },
    ],
    checks: [
      { id: "more-servers", goal: "terms", prompt: "The site handles 500 requests a second. The team doubles the servers, and it now handles 1,000 a second. What happened to each request's latency?", options: ["It halved", "Not necessarily anything: throughput and latency measure different things", "It doubled"], answer: 1, why: "Throughput counts requests finished per second; latency is how long each one takes. More servers raise capacity. Each request only gets faster if it was waiting in a queue.",
        visual: {
          before: { columns: ["", "before", "after"], rows: [["servers", "2", "4"], ["throughput", "500 / s", "1,000 / s"], ["latency", "120 ms", "?"]] },
          after: { columns: ["", "before", "after"], rows: [["servers", "2", "4"], ["throughput", "500 / s", "1,000 / s"], ["latency", "120 ms", "≈ 120 ms"]] },
          mark: (row, phase) => (phase === "after" && row[0] === "latency" ? "hot" : ""),
          note: "More capacity; each request still does the same work.",
        },
      },
      { id: "slo-met", goal: "tail", prompt: "The promise: 95% of checkouts in under one second. The checkout p95 is 984 ms, and a few checkouts take over 2 s. Is the promise kept?", options: ["Yes: it's about p95, and 984 ms is under a second", "No: some checkouts take over 2 seconds", "You can't tell without the average"], answer: 0, why: "An SLO is a promise stated as a percentile. The slowest 5% can be anything; if they matter too, promise a p99 as well.",
        visual: {
          dataset: "requests",
          before: { label: "The promise", columns: ["percentile", "limit"], rows: [["p95 of /checkout", "< 1,000 ms"]] },
          after: "SELECT ms AS checkout_p95 FROM requests\nWHERE endpoint = '/checkout'\nORDER BY ms LIMIT 1 OFFSET 47",
          mark: (row, phase) => (phase === "after" ? "good" : ""),
          note: "984 ms: kept, just.",
        },
      },
      { id: "fifty-calls", goal: "slowdowns", prompt: "Page A calls 1 service. Page B calls 50 services in parallel. Every service is slow 1% of the time. Which is right?", options: ["Both pages are slow about 1% of the time", "Page B is slow about 40% of the time: it waits for the slowest of 50 calls", "Page B is never slow, because the calls run in parallel"], answer: 1, why: "Parallel calls still finish only when the slowest one does. 1 − 0.99⁵⁰ ≈ 39.5%: fifty chances to hit a slow tail.",
        visual: {
          before: { label: "Each call slow 1% of the time", columns: ["page", "calls", "page slow"], rows: [["A", 1, "1%"], ["B", 50, "?"]] },
          after: { label: "Each call slow 1% of the time", columns: ["page", "calls", "page slow"], rows: [["A", 1, "1%"], ["B", 50, "39.5%"]] },
          mark: (row, phase) => (phase === "after" && row[0] === "B" ? "bad" : ""),
          note: "1 − 0.99⁵⁰: fifty chances to hit the tail.",
        },
      },
    ],
    warmups: [
      { id: "why-p99", goal: "tail", prompt: "Why would you report p99 latency rather than the average?", options: ["The average hides the slow tail some users actually hit; p99 shows it", "p99 is cheaper to compute", "Averages can't be computed on large datasets"], answer: 0, why: "Latency is skewed: a few very slow requests move the mean without describing anyone. p50 describes the typical user, p99 the unlucky one in a hundred." },
      { id: "busy", goal: "slowdowns", prompt: "A server goes from 80% to 95% busy. What happens to response time?", options: ["It rises by about 15%", "It roughly quadruples", "It stays the same until 100%"], answer: 1, why: "Queues grow steeply near full capacity. In the simple queueing model, response time goes from 5 times the work to 20 times: four times worse." },
    ],
    open: {
      id: "feels-slow",
      goal: "tail",
      prompt: "Users say the site feels slow, but the average response time looks fine. How would you investigate, and how would you report it?",
      points: [
        "The average hides the tail: look at the distribution and report p50, p95 and p99 (and the max).",
        "Break it down by endpoint and over time: the slow requests may be the valuable ones, like checkout.",
        "Measure where users feel it, on the client, including network and queueing time.",
        "Check fan-out: a page waiting on many calls hits someone's tail often (tail amplification); find the slowest dependency.",
        "Check load: near full utilization, queueing delay makes latency explode; leave headroom.",
        "Agree on an SLO stated as a percentile, and never average percentiles across servers: merge histograms instead.",
      ],
      answer: "An average can look fine while real users wait, because a few very slow requests are hidden in it. I'd look at the latency distribution and report percentiles: p50 for the typical user, p95 and p99 for the unlucky ones. Then I'd break it down by endpoint and over time, since checkout may have a much worse tail than the menu, and those are the requests that matter most. I'd make sure we measure on the client, including network and queueing. For causes, I'd check fan-out, since a page that waits on many services hits one of their slow tails often, and load, since near full utilization queueing makes latency climb steeply. Finally I'd agree an SLO as a percentile, like 95% of checkouts under a second, and compute it from merged histograms, not averaged percentiles.",
    },
  };
  DSL.Practice.registerCards(PRACTICE);

  // One playground panel's markup: "amp" (tail amplification) or "queue".
  function panel(kind) {
    return kind === "amp"
      ? `<div class="lt-panel" data-play="amp">
          <h3>Tail amplification</h3>
          <label>Calls per page: <b data-out="n">1</b><input type="range" min="1" max="100" value="1" data-in="n" /></label>
          <div class="lt-grid" data-grid></div>
          <p><b data-out="pct">1.0%</b> of page loads are slow, when each call is slow 1% of the time.</p>
        </div>`
      : `<div class="lt-panel" data-play="queue">
          <h3>Queueing</h3>
          <label>Server busy: <b data-out="rho">50%</b><input type="range" min="10" max="97" value="50" data-in="rho" /></label>
          <svg class="lt-curve" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path data-path /><circle r="1.8" data-dot /></svg>
          <p>Response time: <b data-out="resp">100 ms</b> (each request needs ${SERVICE_MS} ms of work). Throughput: <b data-out="tput">10</b> req/s of 20 possible.</p>
        </div>`;
  }

  function playgrounds() {
    return `<div class="lt-play">${panel("amp")}${panel("queue")}</div>`;
  }

  // Which of 100 page loads are slow with n calls each (the same draws everywhere).
  const DRAWS = (() => { const rand = mulberry32(7); return Array.from({ length: 100 }, () => Array.from({ length: 100 }, () => rand())); })();
  const slowLoads = (n) => DRAWS.map((calls) => calls.slice(0, n).some((x) => x < 0.01));

  // Wire whichever panels are in root. onGoal fires once each present panel has been pushed into
  // the danger zone (amp: at least ampGoal calls; queue: at least queueGoal busy).
  function wirePlaygrounds(root, onGoal, { ampGoal = 20, queueGoal = 0.9, onChange } = {}) {
    const amp = root.querySelector('[data-play="amp"]');
    const queue = root.querySelector('[data-play="queue"]');
    const needed = [amp && "amp", queue && "queue"].filter(Boolean);
    const reached = new Set();
    let fired = false;
    const check = () => { if (!fired && needed.every((k) => reached.has(k))) { fired = true; if (onGoal) onGoal(); } };
    if (amp) {
      amp.querySelector("[data-grid]").innerHTML = DRAWS.map(() => "<i></i>").join("");
      const paint = () => {
        const n = Number(amp.querySelector('[data-in="n"]').value);
        amp.querySelector('[data-out="n"]').textContent = String(n);
        amp.querySelector('[data-out="pct"]').textContent = `${(slowPage(n) * 100).toFixed(1)}%`;
        const slow = slowLoads(n);
        amp.querySelectorAll("[data-grid] i").forEach((cell, i) => cell.classList.toggle("slow", slow[i]));
        if (n >= ampGoal) reached.add("amp");
        if (onChange) onChange("amp", n);
        check();
      };
      amp.querySelector('[data-in="n"]').addEventListener("input", paint);
      paint();
    }
    if (queue) {
      const yOf = (ms) => 60 - Math.min(60, (ms / 1700) * 60);
      const path = Array.from({ length: 88 }, (_, i) => 0.1 + i * 0.01).map((rho, i) => `${i ? "L" : "M"}${(rho * 100).toFixed(2)} ${yOf(response(rho)).toFixed(2)}`).join(" ");
      queue.querySelector("[data-path]").setAttribute("d", path);
      const paint = () => {
        const rho = Number(queue.querySelector('[data-in="rho"]').value) / 100;
        queue.querySelector('[data-out="rho"]').textContent = `${Math.round(rho * 100)}%`;
        queue.querySelector('[data-out="resp"]').textContent = `${Math.round(response(rho))} ms`;
        queue.querySelector('[data-out="tput"]').textContent = String(Math.round(rho * (1000 / SERVICE_MS)));
        const dot = queue.querySelector("[data-dot]");
        dot.setAttribute("cx", String(rho * 100));
        dot.setAttribute("cy", String(yOf(response(rho))));
        dot.classList.toggle("hot", rho >= 0.85);
        if (rho >= queueGoal) reached.add("queue");
        if (onChange) onChange("queue", rho);
        check();
      };
      queue.querySelector('[data-in="rho"]').addEventListener("input", paint);
      paint();
    }
  }

  function labSection(id, letter, kicker, title, copy, body, set = true) {
    return `<section class="lab" id="lab-${id}">
      <div class="lab-top"><div><span class="lab-kicker">${kicker}</span><h2>${title}</h2><p class="lab-copy">${copy}</p></div>${labSide(DSL.labLabel("latency", letter))}</div>
      ${body}
      ${set ? `<div class="sel-set" data-set="${id}"></div>` : ""}
    </section>`;
  }

  function renderLatency() {
    const lesson = DSL.getLesson("latency");
    DSL.elements.root.innerHTML = `
      <article class="lesson sel">
        ${DSL.lessonHeader(lesson, "Measure the <em>tail</em>, not the average.", "Latency, throughput and percentiles: the vocabulary of every performance question, and of every system design interview that asks \"how fast does it need to be?\".")}
        <div class="pr-intro"><p class="pr-kicker">By the end, you'll be able to</p>${DSL.Practice.cardsMarkup(PRACTICE, { compact: true })}</div>
        ${progress.markup()}

        <div class="insight"><span class="insight-mark">//</span><p>The table <code>requests</code> holds 200 requests to the bakery's site: <code>id</code>, <code>endpoint</code> (<code>/menu</code> or <code>/checkout</code>) and <code>ms</code>. Average: <b>${ALL.mean.toFixed(0)} ms</b>. Median: <b>${ALL.p50} ms</b>. p99: <b>${ALL.p99} ms</b>. Same data.</p></div>

        ${labSection("pct", "A", "Percentiles", "Sort, then read off a position.", "A <b>percentile</b> is the value below which that share of requests falls. The simplest definition, nearest rank: sort, and take position ⌈p% × n⌉.", `
          <div class="sel-notes">
            <div><h3>Mean vs median</h3><p>Latency distributions are skewed: most requests are quick, a few are very slow. The few drag the mean up; the median (p50) doesn't move.</p></div>
            <div><h3>In real databases</h3><p>PostgreSQL: ${code("percentile_cont(0.99) WITHIN GROUP (ORDER BY ms)")} (interpolated) or <code>percentile_disc</code>. SQLite has no built-in, hence the window-function version.</p></div>
            <div><h3>In monitoring</h3><p>Systems don't keep every request: they keep histograms or sketches (HdrHistogram, t-digest) and read percentiles from those. Averages of percentiles are meaningless; merge the histograms instead.</p></div>
          </div>`)}

        ${labSection("tail", "B", "The tail", "The slowest requests are the ones that hurt.", "<b>Tail latency</b> (p99, p99.9) is what your least lucky, and often most valuable, users feel: the biggest baskets and the longest histories do the most work.", `
          ${wonder("Why do the best customers see the worst latency?", "Their requests touch the most data: long order histories, big baskets, many loyalty entries. Amazon famously tracked p99.9 for exactly this reason: the slowest requests came from the customers who bought the most.")}`)}

        ${labSection("load", "C", "Load", "Fan-out and queues make the tail worse.", "Move both sliders into the red: a page that makes 20 or more calls, and a server that's 90% busy or more.", `${playgrounds()}
          <div class="sel-notes">
            <div><h3>Tail amplification</h3><p>A page that waits for n calls is slow if any one is: 1 − (1 − p)ⁿ. At 100 calls and a 1% tail, 63% of pages are slow. Fixes: fewer sequential dependencies, hedged requests, tighter p99s downstream.</p></div>
            <div><h3>Queueing</h3><p>Response time = service time ÷ (1 − utilization) in the simplest model. 50% busy doubles it; 95% multiplies it by 20. Keep headroom, and add capacity before the knee.</p></div>
            <div><h3>SLOs</h3><p>State targets as percentiles: "95% of checkouts under 1 s, measured at the client, over 30 days." Averages can meet a target while one user in twenty suffers.</p></div>
          </div>`, false)}

        ${DSL.Practice.exploreMarkup(PRACTICE)}

        <div class="insight"><span class="insight-mark">!</span><p><strong>Transferable idea:</strong> ask "what's the p99, measured where, under what load?" before believing any speed claim, including your own.</p></div>
        ${DSL.lessonFooter("latency")}
      </article>`;

    progress.mount();
    Object.entries(CHALLENGES).forEach(([labId, list]) => {
      DSL.Sql.challenges(DSL.elements.root.querySelector(`[data-set="${labId}"]`), list, {
        storageKey: `latency-${labId}`,
        onAllDone: () => progress.complete(labId),
      });
    });
    wirePlaygrounds(document.getElementById("lab-load"), () => progress.complete("load"));
    DSL.Practice.mountExplore(document.getElementById("lab-quiz"), PRACTICE, { onPass: () => progress.complete("quiz") });
  }

  DSL.LatencyModel = Object.freeze({ PRACTICE, CHALLENGES, REQUESTS, ALL, stats, slowPage, response, SERVICE_MS, mulberry32, playgrounds, panel, slowLoads, wirePlaygrounds, progress });
  DSL.registerRenderer("latency", renderLatency);
})(window.DataSystemsLab);
