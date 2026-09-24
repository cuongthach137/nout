(function registerJoinAlgorithmsLesson(DSL) {
  "use strict";

  const SCENARIOS = {
    lookup: {
      label: "Checkout · 25 orders → customers",
      outer: 25,
      inner: 1000000,
      output: 25,
      indexed: true,
      sorted: false,
      recommended: "nested",
      reason: "Only 25 outer rows drive indexed lookups. Building or scanning a million-row structure would do far more work.",
    },
    batch: {
      label: "Analytics · 200k events → users",
      outer: 200000,
      inner: 1000000,
      output: 160000,
      indexed: true,
      sorted: false,
      recommended: "hash",
      reason: "A large equality join favors one build pass and one probe pass over hundreds of thousands of index traversals.",
    },
    reconcile: {
      label: "Reconciliation · two ordered feeds",
      outer: 500000,
      inner: 600000,
      output: 420000,
      indexed: false,
      sorted: true,
      recommended: "merge",
      reason: "Both feeds already arrive in join-key order, so the executor can advance through them once without a large hash table.",
    },
  };

  const ALGORITHM_NAMES = { nested: "Nested loop", hash: "Hash join", merge: "Merge join" };

  function compactNumber(value) {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(value >= 100000 ? 0 : 1)}k`;
    return Math.round(value).toLocaleString();
  }

  function estimatePlan(scenario, algorithm) {
    if (algorithm === "nested") {
      const innerWork = scenario.indexed ? Math.log2(scenario.inner) + 1 : scenario.inner;
      return { work: scenario.outer * innerWork, memory: 2, note: scenario.indexed ? `${compactNumber(scenario.outer)} index probes` : `${compactNumber(scenario.outer)} full inner scans` };
    }
    if (algorithm === "hash") {
      const buildRows = Math.min(scenario.outer, scenario.inner);
      return { work: scenario.outer + scenario.inner, memory: buildRows * 56 / 1024 / 1024, note: `build ${compactNumber(buildRows)}, probe ${compactNumber(Math.max(scenario.outer, scenario.inner))}` };
    }
    const sortWork = scenario.sorted ? 0 : (scenario.outer * Math.log2(scenario.outer) + scenario.inner * Math.log2(scenario.inner)) * 0.18;
    return { work: scenario.outer + scenario.inner + sortWork, memory: scenario.sorted ? 4 : 96, note: scenario.sorted ? "consume two ordered streams" : "sort both inputs, then merge" };
  }

  function renderJoinAlgorithms() {
    const lesson = DSL.getLesson("join-algorithms");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "A JOIN is an algorithm, <em>not a keyword.</em>", "The same SQL can become repeated index probes, a temporary hash table, or a synchronized walk through sorted inputs. The right choice depends on row counts, ordering, memory, and available indexes.", "Intermediate")}

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Plan laboratory</span><strong>Change the workload shape, not the SQL syntax</strong><span class="severity">simplified estimates</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Lab 22 · join execution</span><h2>Make three algorithms do the same join</h2><p class="lab-copy">Let the planner choose or force a plan for comparison. The visual model counts relative executor work; production costs also depend on cache state, row width, parallelism, and data distribution.</p></div><span class="lab-badge">build · probe · match</span></div>
        <div class="controls"><div class="control grow"><label for="join-scenario">Workload</label><select id="join-scenario"><option value="lookup">Checkout · 25 orders → customers</option><option value="batch">Analytics · 200k events → users</option><option value="reconcile">Reconciliation · two ordered feeds</option></select></div><div class="control"><label for="join-plan">Execution plan</label><select id="join-plan"><option value="auto">Planner choice</option><option value="nested">Force nested loop</option><option value="hash">Force hash join</option><option value="merge">Force merge join</option></select></div><button class="button primary" id="run-join">Compare plan</button></div>

        <div class="join-plan-strip" id="join-plan-strip"></div>
        <div class="join-stage" id="join-stage" aria-live="polite"></div>
        <div class="metric-grid compact"><div class="metric"><span>Estimated executor work</span><strong id="join-work">—</strong><small>relative operations</small></div><div class="metric"><span>Working memory</span><strong id="join-memory">—</strong><small>illustrative requirement</small></div><div class="metric"><span>Rows emitted</span><strong id="join-output">—</strong><small>joined result</small></div></div>
        <pre class="query-box"><code id="join-explain">Choose a workload to inspect its plan.</code></pre>
        <div class="diagnosis" id="join-diagnosis"><span class="diagnosis-label">Ready</span><p>Compare the algorithms against the same input shape.</p></div>
      </section>

      <section class="concept-grid">
        <article class="concept-card"><span class="concept-number">01 · Nested loop</span><h3>One outer row at a time</h3><p>Excellent when the outer side is small and the inner side has a selective lookup path. Dangerous when the outer estimate is far too low.</p></article>
        <article class="concept-card"><span class="concept-number">02 · Hash join</span><h3>Build once, probe once</h3><p>Strong for large equality joins. The build side needs memory; if it does not fit, batches spill to temporary storage.</p></article>
        <article class="concept-card"><span class="concept-number">03 · Merge join</span><h3>Advance ordered streams</h3><p>Efficient when both sides are already ordered or when the required ordering is useful later. Otherwise sorting has a real cost.</p></article>
      </section>

      <div class="insight"><span class="insight-mark">!</span><p><strong>Read EXPLAIN from the inside out.</strong> For a nested loop, multiply the inner node's work by its loop count. A cheap inner lookup repeated 200,000 times is no longer cheap—and a cardinality error near the outer node can hide that multiplication.</p></div>
      ${DSL.lessonFooter("join-algorithms")}
    </article>`;
    setupJoinLab();
  }

  function renderAlgorithmVisual(algorithm, scenario) {
    if (algorithm === "nested") {
      return `<div class="join-visual nested-visual"><div class="join-source"><small>outer rows</small><span>o₁</span><span>o₂</span><span>o₃</span><i>… ${compactNumber(scenario.outer)}</i></div><div class="join-motion">each row →</div><div class="join-structure"><small>${scenario.indexed ? "inner B-tree" : "inner table"}</small><strong>${scenario.indexed ? "root → leaf → row" : `scan ${compactNumber(scenario.inner)} rows`}</strong><em>repeat per outer row</em></div></div>`;
    }
    if (algorithm === "hash") {
      return `<div class="join-visual hash-visual"><div class="join-source"><small>build side</small><span>42</span><span>17</span><span>91</span><i>${compactNumber(Math.min(scenario.outer, scenario.inner))} rows</i></div><div class="join-motion">hash(key) →</div><div class="hash-buckets"><span>00 · 42</span><span>01 · 17</span><span>10 · 91</span><span>11 · …</span></div><div class="join-motion">← probe</div><div class="join-source"><small>probe side</small><strong>${compactNumber(Math.max(scenario.outer, scenario.inner))} rows</strong></div></div>`;
    }
    return `<div class="join-visual merge-visual"><div class="merge-stream"><small>left · ordered</small><span>12</span><span class="matched">17</span><span>42</span><span>91</span></div><div class="merge-cursor">⇢ compare ⇠</div><div class="merge-stream"><small>right · ordered</small><span>09</span><span class="matched">17</span><span>44</span><span>98</span></div></div>`;
  }

  function setupJoinLab() {
    function update() {
      const scenario = SCENARIOS[document.getElementById("join-scenario").value];
      const requested = document.getElementById("join-plan").value;
      const selected = requested === "auto" ? scenario.recommended : requested;
      const estimates = Object.fromEntries(Object.keys(ALGORITHM_NAMES).map((algorithm) => [algorithm, estimatePlan(scenario, algorithm)]));
      const estimate = estimates[selected];

      document.getElementById("join-plan-strip").innerHTML = Object.entries(ALGORITHM_NAMES).map(([algorithm, name]) => `<div class="join-plan-card ${algorithm === selected ? "active" : ""} ${algorithm === scenario.recommended ? "recommended" : ""}"><small>${algorithm === scenario.recommended ? "planner favorite" : "alternative"}</small><strong>${name}</strong><span>${compactNumber(estimates[algorithm].work)} work</span></div>`).join("");
      document.getElementById("join-stage").innerHTML = renderAlgorithmVisual(selected, scenario);
      document.getElementById("join-work").textContent = compactNumber(estimate.work);
      document.getElementById("join-memory").textContent = `${Math.max(1, estimate.memory).toFixed(estimate.memory < 10 ? 1 : 0)} MiB`;
      document.getElementById("join-output").textContent = compactNumber(scenario.output);
      document.getElementById("join-explain").textContent = `${ALGORITHM_NAMES[selected]}  (actual rows=${scenario.output.toLocaleString()})\n  → ${estimate.note}\n  → outer rows=${scenario.outer.toLocaleString()}, inner rows=${scenario.inner.toLocaleString()}`;

      const ideal = selected === scenario.recommended;
      const multiplier = estimate.work / estimates[scenario.recommended].work;
      const diagnosis = document.getElementById("join-diagnosis");
      diagnosis.className = `diagnosis ${ideal ? "resolved" : "warning"}`;
      diagnosis.innerHTML = ideal
        ? `<span class="diagnosis-label">Good fit</span><p>${scenario.reason}</p>`
        : `<span class="diagnosis-label">Plan regression</span><p>${ALGORITHM_NAMES[selected]} does about ${multiplier.toFixed(multiplier < 10 ? 1 : 0)}× the modeled work of ${ALGORITHM_NAMES[scenario.recommended].toLowerCase()} here. Check row estimates, indexes, ordering, and spill evidence before forcing a plan.</p>`;
    }

    document.getElementById("run-join").addEventListener("click", update);
    document.getElementById("join-scenario").addEventListener("change", update);
    document.getElementById("join-plan").addEventListener("change", update);
    update();
  }

  DSL.registerRenderer("join-algorithms", renderJoinAlgorithms);
})(window.DataSystemsLab);
