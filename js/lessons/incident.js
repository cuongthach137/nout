(function registerIncidentLesson(DSL) {
  "use strict";

  function renderIncident() {
    const lesson = DSL.getLesson("incident");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "You are on call for <em>checkout</em>.", "A sale just started. Latency climbed, duplicate orders appeared, and some customers cannot see confirmations. Use database evidence—not guesses—to stabilize the system.", "Capstone")}
      <section class="incident-overview">
        <div class="incident-heading"><div><span class="lab-kicker">Live incident · 14:07 UTC</span><h2>Checkout reliability degraded</h2></div><span class="incident-clock">00:<strong>18</strong></span></div>
        <div class="metric-grid">
          <div class="metric alert"><span>Order API p95</span><strong id="cap-latency">2.8 s</strong><small>SLO: 400 ms</small></div>
          <div class="metric alert"><span>Duplicate orders</span><strong id="cap-duplicates">14</strong><small>last 10 minutes</small></div>
          <div class="metric alert"><span>Missing confirmations</span><strong id="cap-missing">8%</strong><small>immediate reads</small></div>
        </div>
        <div class="system-map" aria-label="Checkout system topology">
          <div class="system-node" id="system-client"><small>Clients</small><strong>retry on timeout</strong><span>idempotency key</span></div><span class="system-arrow">→</span>
          <div class="system-node" id="system-api"><small>Checkout API</small><strong>6 pods</strong><span>read/write traffic</span></div><span class="system-arrow">→</span>
          <div class="system-node hotspot" id="system-primary"><small>Primary DB</small><strong>orders</strong><span>query + constraint</span></div><span class="system-arrow">⇢</span>
          <div class="system-node hotspot" id="system-replica"><small>Read replica</small><strong>2.1s behind</strong><span>confirmation reads</span></div>
        </div>
        <div class="restore-progress"><div><span>Mitigations verified</span><strong id="incident-score">0 / 3</strong></div><div class="progress-track light"><div class="progress-fill" id="incident-progress"></div></div></div>
      </section>

      <section class="case-grid">
        <article class="case-card" data-case-card="latency">
          <div class="case-head"><span>01 · Performance</span><strong>Slow order lookup</strong></div>
          <pre class="evidence"><code>Index Scan on orders_customer_idx\n  estimated rows: 820\n  actual rows: 418,204\n  heap pages read: 5,870</code></pre>
          <label class="case-label" for="fix-latency">Choose a mitigation</label>
          <select id="fix-latency"><option value="pods">Double API pods</option><option value="stats-index">Refresh stats + align composite index</option><option value="cache">Cache every customer response</option></select>
          <button class="button primary" data-test-case="latency">Test mitigation</button>
          <div class="case-result" id="result-latency" aria-live="polite">Awaiting test</div>
        </article>

        <article class="case-card" data-case-card="duplicates">
          <div class="case-head"><span>02 · Integrity</span><strong>Retry created a second order</strong></div>
          <pre class="evidence"><code>14:06:03.118 key=pay_7F2 → order 9131\n14:06:03.159 key=pay_7F2 → order 9132\nno unique constraint on idempotency_key</code></pre>
          <label class="case-label" for="fix-duplicates">Choose a mitigation</label>
          <select id="fix-duplicates"><option value="no-retry">Turn off client retries</option><option value="mutex">Add an in-process mutex</option><option value="unique">Unique idempotency key + atomic transaction</option></select>
          <button class="button primary" data-test-case="duplicates">Test mitigation</button>
          <div class="case-result" id="result-duplicates" aria-live="polite">Awaiting test</div>
        </article>

        <article class="case-card" data-case-card="stale">
          <div class="case-head"><span>03 · Consistency</span><strong>Confirmation reads “not found”</strong></div>
          <pre class="evidence"><code>commit LSN: 0/9914 on primary\nread LSN:   0/9897 on replica-b\nreplica lag: 2.1 seconds</code></pre>
          <label class="case-label" for="fix-stale">Choose a mitigation</label>
          <select id="fix-stale"><option value="sleep">Sleep 500ms before confirmation</option><option value="random">Retry on another replica</option><option value="token">Pass commit position; wait or pin to leader</option></select>
          <button class="button primary" data-test-case="stale">Test mitigation</button>
          <div class="case-result" id="result-stale" aria-live="polite">Awaiting test</div>
        </article>
      </section>

      <div class="diagnosis incident-verdict" id="incident-verdict"><span class="diagnosis-label">Incident command</span><p>Read the evidence, choose one mitigation per symptom, and test the outcome. A plausible change is not a fix until the failure mode stops reproducing.</p></div>
      <div class="insight"><span class="insight-mark">!</span><p><strong>The through-line:</strong> performance bugs are physical work, integrity bugs are invalid interleavings, and replica bugs are time gaps. The abstraction becomes useful when it predicts the evidence you will see.</p></div>
      ${DSL.lessonFooter("incident")}
    </article>`;
    setupIncidentCapstone();
  }

  function setupIncidentCapstone() {
    const solved = new Set();
    const cases = {
      latency: {
        select: "fix-latency", correct: "stats-index", success: "PASS · p95 286 ms · 24 pages read",
        failure: { pods: "FAIL · p95 2.7 s · database work unchanged", cache: "FAIL · miss path still 2.8 s; invalidation risk added" },
        metric: ["cap-latency", "286 ms"],
      },
      duplicates: {
        select: "fix-duplicates", correct: "unique", success: "PASS · 10k concurrent retries · 1 order committed",
        failure: { "no-retry": "FAIL · network retries still happen outside your client", mutex: "FAIL · two API pods do not share process memory" },
        metric: ["cap-duplicates", "0"],
      },
      stale: {
        select: "fix-stale", correct: "token", success: "PASS · 1k immediate reads · 100% observe commit",
        failure: { sleep: "FAIL · replica occasionally lags longer than 500 ms", random: "FAIL · the next replica can be equally far behind" },
        metric: ["cap-missing", "0%"],
      },
    };

    function updateProgress() {
      document.getElementById("incident-score").textContent = `${solved.size} / 3`;
      document.getElementById("incident-progress").style.width = `${solved.size / 3 * 100}%`;
      if (solved.has("latency") && solved.has("duplicates")) document.getElementById("system-primary").classList.add("fixed");
      if (solved.has("stale")) document.getElementById("system-replica").classList.add("fixed");
      if (solved.size !== 3) return;

      document.getElementById("system-client").classList.add("fixed");
      document.getElementById("system-api").classList.add("fixed");
      const verdict = document.getElementById("incident-verdict");
      verdict.className = "diagnosis incident-verdict resolved";
      verdict.innerHTML = `<span class="diagnosis-label">Incident stabilized</span><p>All three failure modes stopped reproducing. The fixes reduce physical page work, put the booking invariant in the database, and make read freshness explicit.</p>`;
      DSL.showToast("Incident stabilized — all mitigations verified");
    }

    document.querySelectorAll("[data-test-case]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.testCase;
      const item = cases[id];
      const select = document.getElementById(item.select);
      const choice = select.value;
      const pass = choice === item.correct;
      const result = document.getElementById(`result-${id}`);
      const card = document.querySelector(`[data-case-card="${id}"]`);
      result.textContent = "Running production-shaped test…";
      result.className = "case-result running";
      button.disabled = true;

      DSL.setTimer(() => {
        result.textContent = pass ? item.success : item.failure[choice];
        result.className = `case-result ${pass ? "pass" : "fail"}`;
        if (pass) {
          solved.add(id);
          card.classList.add("resolved");
          select.disabled = true;
          document.getElementById(item.metric[0]).textContent = item.metric[1];
          document.getElementById(item.metric[0]).closest(".metric").classList.remove("alert");
        } else {
          button.disabled = false;
        }
        updateProgress();
      }, 650);
    }));
  }

  DSL.registerRenderer("incident", renderIncident);
})(window.DataSystemsLab);
