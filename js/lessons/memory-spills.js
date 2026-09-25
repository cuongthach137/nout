(function registerMemorySpillsLesson(DSL) {
  "use strict";

  const WORKLOADS = {
    endpoint: { label: "API endpoint", rows: 120000, operators: 1, requirements: { sort: 18, hash: 28, aggregate: 12 } },
    report: { label: "Monthly report", rows: 8000000, operators: 2, requirements: { sort: 220, hash: 340, aggregate: 140 } },
  };

  const OPERATORS = {
    sort: { name: "Sort", multiplier: 1, verb: "merge passes" },
    hash: { name: "Hash join", multiplier: 2, verb: "hash batches" },
    aggregate: { name: "Hash aggregate", multiplier: 2, verb: "hash batches" },
  };

  function renderMemorySpills() {
    const lesson = DSL.getLesson("memory-spills");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "Memory is budgeted <em>per operation.</em>", "A sort or hash node that outgrows its allowance writes temporary data to disk. Raising work_mem can remove that I/O—but the same setting is multiplied by operators and concurrent sessions.", "Intermediate")}

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Production drill</span><strong>Report latency fixed; database memory exhausted next</strong><span class="severity">resource trade-off</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Lab 25 · memory and temp I/O</span><h2>Fit one query without sinking the cluster</h2><p class="lab-copy">The model uses an 8 GiB database host and PostgreSQL's default 2× hash-memory multiplier. Values are teaching estimates, not a capacity formula.</p></div><span class="lab-badge">RAM ↔ temp files</span></div>
        <div class="controls">
          <div class="control"><label for="memory-workload">Workload</label><select id="memory-workload"><option value="endpoint">API endpoint · 120k rows</option><option value="report" selected>Monthly report · 8m rows</option></select></div>
          <div class="control"><label for="memory-operator">Operator</label><select id="memory-operator"><option value="sort">Sort</option><option value="hash" selected>Hash join</option><option value="aggregate">Hash aggregate</option></select></div>
          <div class="control grow"><label for="work-mem">work_mem: <span id="work-mem-value">32 MiB</span></label><input id="work-mem" type="range" min="4" max="256" step="4" value="32"></div>
          <div class="control grow"><label for="memory-sessions">Concurrent sessions: <span id="memory-sessions-value">10</span></label><input id="memory-sessions" type="range" min="1" max="60" value="10"></div>
        </div>

        <div class="memory-scene" aria-live="polite">
          <div class="memory-operation"><div class="memory-operation-head"><small id="memory-operator-name">Hash join</small><strong id="memory-required">—</strong></div><div class="memory-vessel"><span id="memory-fill"></span><i id="memory-limit-line"></i><em id="memory-limit-label">limit</em></div><p id="memory-operation-copy">—</p></div>
          <div class="spill-arrow" id="spill-arrow">overflow →</div>
          <div class="temp-storage" id="temp-storage"><small>temporary storage</small><div id="temp-blocks"></div><strong id="temp-written">—</strong></div>
          <div class="cluster-budget"><small>Concurrent upper bound</small><div class="cluster-track"><span id="cluster-fill"></span><i>8 GiB host</i></div><strong id="cluster-bound">—</strong><p>capacity illustration</p></div>
        </div>

        <div class="metric-grid compact"><div class="metric"><span>Per-operation allowance</span><strong id="operation-allowance">—</strong><small>hash uses multiplier</small></div><div class="metric"><span>Temporary data</span><strong id="spill-metric">—</strong><small>simplified spill estimate</small></div><div class="metric"><span>Potential concurrent memory</span><strong id="concurrency-memory">—</strong><small>allowance × ops × sessions</small></div></div>
        <pre class="query-box"><code id="memory-explain">Hash Join\n  Batches: —  Memory Usage: —  Disk Usage: —</code></pre>
        <div class="diagnosis" id="memory-diagnosis"><span class="diagnosis-label">Investigation</span><p>Move both sliders. A local speedup can become a global availability risk.</p></div>
      </section>

      <section class="concept-grid">
        <article class="concept-card"><span class="concept-number">01 · Scope</span><h3>Not a query-wide pool</h3><p>One plan can contain several sorts and hashes, and parallel workers can add more consumers. work_mem applies before that multiplication.</p></article>
        <article class="concept-card"><span class="concept-number">02 · Spill evidence</span><h3>Look for temp I/O</h3><p>EXPLAIN ANALYZE can reveal external merge sorts, hash batches, memory usage, and disk usage. Server temp-file metrics show the fleet-wide symptom.</p></article>
        <article class="concept-card"><span class="concept-number">03 · Response</span><h3>Tune at the narrowest scope</h3><p>Reduce rows, improve the plan, or apply a transaction-local setting for the report before raising a global default for every connection.</p></article>
      </section>

      <div class="insight"><span class="insight-mark">!</span><p><strong>Two limits can fail in opposite directions.</strong> Too little memory turns CPU work into storage I/O; too much promised memory lets concurrency overwhelm the host. Diagnose the operator and the fleet at the same time.</p></div>
      ${DSL.lessonFooter("memory-spills")}
    </article>`;
    setupMemoryLab();
  }

  function setupMemoryLab() {
    const workMem = document.getElementById("work-mem");
    const sessions = document.getElementById("memory-sessions");
    const workloadControl = document.getElementById("memory-workload");
    const operatorControl = document.getElementById("memory-operator");

    function update() {
      const workload = WORKLOADS[workloadControl.value];
      const operator = OPERATORS[operatorControl.value];
      const configured = Number(workMem.value);
      const concurrentSessions = Number(sessions.value);
      const allowance = configured * operator.multiplier;
      const required = workload.requirements[operatorControl.value];
      const resident = Math.min(required, allowance);
      const spilled = Math.max(0, required - allowance);
      const passes = spilled > 0 ? Math.max(1, Math.ceil(required / allowance) - 1) : 0;
      const concurrentBound = allowance * workload.operators * concurrentSessions;
      const hostMemory = 8192;
      const memoryRisk = concurrentBound > hostMemory * 0.7;
      const spill = spilled > 0;

      document.getElementById("work-mem-value").textContent = `${configured} MiB`;
      document.getElementById("memory-sessions-value").textContent = concurrentSessions;
      document.getElementById("memory-operator-name").textContent = operator.name;
      document.getElementById("memory-required").textContent = `${required} MiB needed`;
      document.getElementById("memory-fill").style.height = `${Math.min(100, resident / required * 100)}%`;
      document.getElementById("memory-limit-line").style.bottom = `${Math.min(96, allowance / required * 100)}%`;
      document.getElementById("memory-limit-label").style.bottom = `${Math.min(92, allowance / required * 100)}%`;
      document.getElementById("memory-limit-label").textContent = `${allowance} MiB cap`;
      document.getElementById("memory-operation-copy").textContent = `${workload.label}: ${workload.rows.toLocaleString()} input rows · ${workload.operators} memory operator${workload.operators === 1 ? "" : "s"}`;
      document.getElementById("spill-arrow").classList.toggle("active", spill);
      document.getElementById("temp-storage").classList.toggle("active", spill);
      document.getElementById("temp-blocks").innerHTML = Array.from({ length: Math.min(8, passes * 2) }, () => "<i></i>").join("");
      document.getElementById("temp-written").textContent = spill ? `${spilled} MiB written` : "no spill";
      document.getElementById("cluster-fill").style.width = `${Math.min(100, concurrentBound / hostMemory * 100)}%`;
      document.getElementById("cluster-fill").classList.toggle("danger", memoryRisk);
      document.getElementById("cluster-bound").textContent = concurrentBound >= 1024 ? `${(concurrentBound / 1024).toFixed(1)} GiB` : `${concurrentBound} MiB`;
      document.getElementById("operation-allowance").textContent = `${allowance} MiB`;
      document.getElementById("spill-metric").textContent = spill ? `${spilled} MiB` : "0 MiB";
      document.getElementById("concurrency-memory").textContent = concurrentBound >= 1024 ? `${(concurrentBound / 1024).toFixed(1)} GiB` : `${concurrentBound} MiB`;
      document.getElementById("memory-explain").textContent = `${operator.name}  (actual rows=${workload.rows.toLocaleString()})\n  ${operator.verb}: ${spill ? passes + 1 : 1}  Memory Usage: ${resident} MiB  Disk Usage: ${spilled} MiB`;

      const diagnosis = document.getElementById("memory-diagnosis");
      if (spill && memoryRisk) {
        diagnosis.className = "diagnosis warning";
        diagnosis.innerHTML = `<span class="diagnosis-label">Both limits exposed</span><p>This operator still spills ${spilled} MiB, while the concurrent allowance can reach ${(concurrentBound / 1024).toFixed(1)} GiB. Reduce input work or isolate the report; a larger global value alone is unsafe.</p>`;
      } else if (spill) {
        diagnosis.className = "diagnosis warning";
        diagnosis.innerHTML = `<span class="diagnosis-label">Temp I/O bottleneck</span><p>The ${operator.name.toLowerCase()} exceeds its ${allowance} MiB allowance and uses ${passes + 1} ${operator.verb}. Consider fewer input rows, a better plan, or a narrowly scoped memory increase.</p>`;
      } else if (memoryRisk) {
        diagnosis.className = "diagnosis warning";
        diagnosis.innerHTML = `<span class="diagnosis-label">Concurrency risk</span><p>One operation fits, but ${concurrentSessions} sessions with ${workload.operators} operators can claim a ${(concurrentBound / 1024).toFixed(1)} GiB upper bound on an 8 GiB host. The setting is not a server-wide cap.</p>`;
      } else {
        diagnosis.className = "diagnosis resolved";
        diagnosis.innerHTML = `<span class="diagnosis-label">Balanced model</span><p>The operation fits without a spill, and the concurrent allowance stays below 70% of the illustrative host budget. Keep observing real concurrency and temp-file metrics.</p>`;
      }
    }

    [workMem, sessions].forEach((control) => control.addEventListener("input", update));
    [workloadControl, operatorControl].forEach((control) => control.addEventListener("change", update));
    update();
  }

  DSL.registerRenderer("memory-spills", renderMemorySpills);
})(window.DataSystemsLab);
