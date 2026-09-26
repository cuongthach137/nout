(function registerLatencyGuided(DSL) {
  "use strict";

  // Guided mode for latency, throughput and percentiles: a request flow, a histogram of the 200
  // requests with mean and percentile markers, tail amplification over 100 page loads, and a
  // queueing curve. Shared with Narrated mode (DSL.LatencyScenes).

  const { retrigger } = DSL.LabKit;
  const { predictBeat, challengeBeat, teach, slice } = DSL.SqlScenes;
  const M = () => DSL.LatencyModel;

  // ---------- Request flow: latency vs throughput ----------

  function flowStory() {
    return {
      build(stage) {
        stage.innerHTML = `<div class="lt-flow">
          <div class="lt-lane"><span class="lt-end">customers</span><div class="lt-track"><div class="lt-queue"></div>${Array.from({ length: 8 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div><span class="lt-server">server</span></div>
          <div class="lt-readouts"><div data-r="latency"><small>latency</small><b>—</b></div><div data-r="throughput"><small>throughput</small><b>—</b></div></div>
        </div>`;
        const root = stage.firstElementChild;
        return { root, set(key, value) { const b = root.querySelector(`[data-r="${key}"] b`); b.textContent = value; root.querySelector(`[data-r="${key}"]`).classList.add("on"); retrigger(b, "gd-pop"); } };
      },
      frames: [
        { caption: "Each dot is one request to the bakery's site, travelling to the server and back.", async enter(f, a) { f.root.classList.remove("busy"); await a.wait(600); } },
        { caption: "How long <b>one</b> request takes, start to finish, is its <b>latency</b>: here about 100 ms.", async enter(f, a) { f.root.classList.add("watch"); f.set("latency", "≈100 ms"); await a.wait(400); } },
        { caption: "How many requests finish <b>each second</b> is <b>throughput</b>: here 10 per second.", async enter(f, a) { f.set("latency", "≈100 ms"); f.set("throughput", "10 req/s"); await a.wait(400); } },
        {
          caption: "They're not the same. Busy, the server still finishes about 19 per second, but each request now waits in line first: latency climbs to a second.",
          async enter(f, a) { f.root.classList.add("busy"); f.root.querySelector(".lt-queue").innerHTML = Array.from({ length: 9 }, (_, i) => `<i style="--i:${i}"></i>`).join(""); f.set("latency", "≈1,000 ms"); f.set("throughput", "19 req/s"); await a.wait(500); },
        },
      ],
    };
  }

  // ---------- Histogram of the 200 requests ----------

  const BIN = 50;
  const MAX_MS = 2300;

  function histBoard(stage) {
    const { REQUESTS, ALL } = M();
    const bins = Array.from({ length: MAX_MS / BIN }, () => 0);
    REQUESTS.forEach(([, , ms]) => { bins[Math.min(bins.length - 1, Math.floor(ms / BIN))] += 1; });
    const top = Math.max(...bins);
    const x = (ms) => `${(ms / MAX_MS) * 100}%`;
    stage.innerHTML = `<div class="lt-hist">
      <div class="lt-bars">${bins.map((count, i) => `<i data-ms="${i * BIN}" class="${i * BIN >= 400 ? "tail" : ""}" style="--h:${count ? Math.max(4, (count / top) * 100) : 0}%;--i:${i}" title="${i * BIN}–${(i + 1) * BIN} ms: ${count}"></i>`).join("")}
        ${[["mean", ALL.mean, "mean"], ["p50", ALL.p50, "p50"], ["p95", ALL.p95, "p95"], ["p99", ALL.p99, "p99"]].map(([key, ms, label]) => `<span class="lt-mark" data-mark="${key}" style="left:${x(ms)}"><b>${label}</b><small>${Math.round(ms)} ms</small></span>`).join("")}
      </div>
      <div class="lt-axis">${[[0, "0"], [500, "500 ms"], [1000, "1 s"], [1500, "1.5 s"], [2000, "2 s"]].map(([ms, label]) => `<span style="left:${x(ms)}">${label}</span>`).join("")}</div>
    </div>`;
    const root = stage.firstElementChild;
    return {
      root,
      show(keys) { root.querySelectorAll(".lt-mark").forEach((m) => { const on = keys.includes(m.dataset.mark); if (on && !m.classList.contains("on")) retrigger(m, "gd-pop"); m.classList.toggle("on", on); }); },
      tail(on) { root.classList.toggle("show-tail", on); },
    };
  }

  function histStory() {
    return {
      build: (stage) => histBoard(stage),
      frames: [
        { caption: "200 requests to the bakery's site, grouped by how long they took.", async enter(h, a) { h.show([]); h.tail(false); await a.wait(600); } },
        { caption: "Most are quick, under about 120 ms. But a few take seconds: that long stretch on the right is the <b>tail</b>.", async enter(h, a) { h.show([]); h.tail(true); await a.wait(500); } },
        { caption: "The <b>average</b> is 170 ms. Hardly any request actually takes that long: the few slow ones drag it up.", async enter(h, a) { h.tail(true); h.show(["mean"]); await a.wait(400); } },
        { caption: "The middle value is the <b>median</b>, or p50: 101 ms. It's a <b>percentile</b>: half the requests are at or below it.", async enter(h, a) { h.tail(true); h.show(["mean", "p50"]); await a.wait(400); } },
        { caption: "The slow end: <b>p95</b> is 327 ms. 95 in 100 requests take that long or less.", async enter(h, a) { h.tail(true); h.show(["p50", "p95"]); await a.wait(400); } },
        { caption: "And <b>p99</b> is over 2 seconds: one request in a hundred. That's <b>tail latency</b>, and it's often your best customers, with the biggest baskets.", async enter(h, a) { h.tail(true); h.show(["p50", "p95", "p99"]); await a.wait(400); } },
      ],
    };
  }

  // ---------- Tail amplification over 100 page loads ----------

  function ampBoard(stage) {
    stage.innerHTML = `<div class="lt-amp"><div class="lt-grid big"></div><div class="lt-amp-out"><b>—</b><small></small></div></div>`;
    const root = stage.firstElementChild;
    root.querySelector(".lt-grid").innerHTML = Array.from({ length: 100 }, (_, i) => `<i style="--i:${i}"></i>`).join("");
    return {
      root,
      async set(n, a) {
        const slow = M().slowLoads(n);
        root.querySelectorAll(".lt-grid i").forEach((cell, i) => cell.classList.toggle("slow", slow[i]));
        root.querySelector(".lt-amp-out b").textContent = `${(M().slowPage(n) * 100).toFixed(1)}%`;
        root.querySelector(".lt-amp-out small").textContent = `of page loads are slow, with ${n} call${n === 1 ? "" : "s"} per page`;
        retrigger(root.querySelector(".lt-amp-out b"), "gd-pop");
        await a.wait(500);
      },
    };
  }

  function ampStory() {
    return {
      build: (stage) => ampBoard(stage),
      frames: [
        { caption: "100 page loads. With one backend call each, slow 1% of the time, about one page in a hundred is slow.", async enter(g, a) { await g.set(1, a); } },
        { caption: "The page can't finish until its slowest call does. With <b>10 calls</b>, any one can be the slow one: nearly 10% of pages.", async enter(g, a) { await g.set(10, a); } },
        { caption: "With <b>100 calls</b>, nearly two pages in three are slow. That's <b>tail amplification</b>: why big systems obsess over p99.", async enter(g, a) { await g.set(100, a); } },
      ],
    };
  }

  // ---------- Queueing curve ----------

  function queueBoard(stage) {
    stage.innerHTML = `<div class="lt-queueing">${M().panel("queue")}</div>`;
    const root = stage.firstElementChild;
    const input = root.querySelector('[data-in="rho"]');
    input.disabled = true;
    M().wirePlaygrounds(root, null);
    return {
      root,
      async set(rho, a) {
        const from = Number(input.value);
        const to = Math.round(rho * 100);
        for (let v = from; v !== to; v += Math.sign(to - v)) { input.value = String(v); input.dispatchEvent(new Event("input")); await a.wait(25); }
        input.value = String(to);
        input.dispatchEvent(new Event("input"));
        retrigger(root.querySelector('[data-out="resp"]'), "gd-pop");
      },
    };
  }

  function queueStory() {
    return {
      build: (stage) => queueBoard(stage),
      frames: [
        { caption: "Waiting in line: a request can't start until the server is free. At <b>50%</b> busy, response time is 100 ms: double the 50 ms of work.", async enter(q, a) { await q.set(0.5, a); } },
        { caption: "At <b>80%</b> busy, waits build: 250 ms.", async enter(q, a) { await q.set(0.8, a); } },
        { caption: "At <b>95%</b> busy, a full second: four times worse than at 80%, for barely more throughput. That wait is <b>queueing delay</b>.", async enter(q, a) { await q.set(0.95, a); } },
      ],
    };
  }

  // ---------- Beats ----------

  const medianPredict = () => predictBeat({
    id: "median",
    prompt: "Half the requests are faster than what?",
    why: "The average is 170 ms, but a handful of requests took over a second.",
    question: `<p class="wn-q">200 requests. Average: <b>170 ms</b>. A handful took over 1 s.</p>`,
    options: [["170", "170 ms"], ["101", "101 ms"], ["50", "50 ms"]],
    answer: "101",
    explain: { right: "101 ms: the middle request. The slow few drag the average up, not the median.", wrong: "101 ms. The average is pulled up by the slow few; the middle request is faster." },
  });

  const ampPredict = () => predictBeat({
    id: "amp",
    prompt: "10 calls, each slow 1% of the time. How often is the page slow?",
    why: "The page waits for all 10 calls, so it's slow if any one of them is.",
    question: `<p class="wn-q">The checkout page calls <b>10 services</b> and waits for all of them.</p>`,
    options: [["1", "About 1%"], ["10", "About 10%"], ["50", "About 50%"]],
    answer: "10",
    explain: { right: "About 10%: 1 − 0.99¹⁰ ≈ 9.6%.", wrong: "About 10%: ten chances to be unlucky, 1 − 0.99¹⁰ ≈ 9.6%." },
  });

  // Slider beats: the learner pushes the playground into the danger zone.
  function sliderBeat({ id, prompt, why, kind, goal, done }) {
    return {
      id,
      prompt,
      why,
      mount(scene, api) {
        scene.innerHTML = `<div class="lt-queueing">${M().panel(kind)}</div>`;
        M().wirePlaygrounds(scene, () => { DSL.Sfx.play("correct"); api.done(done); }, kind === "amp" ? { ampGoal: goal } : { queueGoal: goal });
      },
    };
  }

  const ampSlider = () => sliderBeat({ id: "amp-slider", prompt: "Drag to 50 calls per page.", why: "Each call is slow 1% of the time; a page waits for all of them. Red squares are slow page loads.", kind: "amp", goal: 50, done: "Two in five pages are slow at 50 calls. <b>Tail amplification</b>." });
  const queueSlider = () => sliderBeat({ id: "queue-slider", prompt: "Push the server past 90% busy.", why: "Each request needs 50 ms of work. In the simplest queueing model, response time = 50 ms ÷ (1 − busy).", kind: "queue", goal: 0.9, done: "Past 90%, response time explodes while throughput barely moves. That's <b>queueing delay</b>." });

  const p99Challenge = () => challengeBeat({
    id: "p99",
    prompt: "Your turn: the p99.",
    why: "Nearest rank: position ⌈0.99 × 200⌉ = 198. OFFSET skips 197 rows.",
    task: "The table <b>requests</b> has one row per request (<b>ms</b> is its time). Find the <b>p99</b>: the 198th fastest of 200.",
    starter: "SELECT ms\nFROM requests\nORDER BY ms\n",
    solution: "SELECT ms FROM requests ORDER BY ms LIMIT 1 OFFSET 197",
    dataset: "requests",
  });

  const checkoutChallenge = () => challengeBeat({
    id: "checkout",
    prompt: "Your turn: check the promise.",
    why: "50 checkout requests: ⌈0.95 × 50⌉ = 48, so skip 47.",
    task: "The team promises 95% of checkouts in under 1 s. Find the <b>p95 of /checkout</b>: the 48th fastest of 50.",
    starter: "SELECT ms\nFROM requests\nWHERE endpoint = '/checkout'\nORDER BY ms\n",
    solution: "SELECT ms FROM requests WHERE endpoint = '/checkout' ORDER BY ms LIMIT 1 OFFSET 47",
    dataset: "requests",
  });

  function makeBeats() {
    const LM = DSL.LatencyModel;
    return [
      teach("teach-flow", "Latency vs throughput.", flowStory(), "Response time is what the user sees: waiting in queues plus network plus the actual work. Latency is sometimes used for just the waiting part."),
      teach("teach-hist", "A distribution, not a number.", slice(histStory(), 0, 3)),
      medianPredict(),
      teach("teach-median", "The median.", slice(histStory(), 3, 4), "Nearest rank: sort, then take position ⌈p% × n⌉. Databases also offer interpolated percentiles (percentile_cont)."),
      teach("teach-tail", "The tail.", slice(histStory(), 4, 6), "Amazon tracked p99.9: the slowest requests came from customers with the most purchases."),
      p99Challenge(),
      ampPredict(),
      ampSlider(),
      queueSlider(),
      checkoutChallenge(),
      DSL.Guided.quizBeat({ questions: LM.QUIZ, passScore: 3, onPass: () => LM.progress.complete("quiz") }),
      DSL.Guided.finishBeat({
        lessonId: "latency",
        badges: [["📊", "Percentiles", "not averages"], ["🐢", "The tail", "p99 is a person"], ["🚦", "Headroom", "queues explode near 100%"]],
      }),
    ];
  }

  DSL.LatencyScenes = Object.freeze({ flowStory, histStory, ampStory, queueStory, p99Challenge, checkoutChallenge, beats: makeBeats });

  DSL.registerGuided("latency", () => DSL.Guided.run({
    lessonId: "latency",
    title: `${DSL.lessonNumber("latency")} · Latency and percentiles`,
    beats: makeBeats(),
  }));
})(window.DataSystemsLab);
