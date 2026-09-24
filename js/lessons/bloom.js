(function registerBloomLesson(DSL) {
  "use strict";

  const INSERTED = {
    compact: { mango: [2, 9, 17], cedar: [4, 9, 20], orbit: [2, 13, 20] },
    roomy: { mango: [2, 25, 41], cedar: [4, 29, 44], orbit: [10, 31, 46] },
  };
  const QUERIES = {
    compact: { mango: [2, 9, 17], quartz: [4, 13, 20], comet: [1, 9, 16] },
    roomy: { mango: [2, 25, 41], quartz: [4, 13, 44], comet: [1, 25, 40] },
  };

  function activeBits(mode) {
    return new Set(Object.values(INSERTED[mode]).flat());
  }

  function renderBloom() {
    const lesson = DSL.getLesson("bloom");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "Ask a cheap question before an <em>expensive read</em>.", "A Bloom filter is a compact probabilistic set. It can prove that a key is absent, or say that a key might exist—but false positives are possible.", "Intermediate")}
      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Lab 08</span><h2>Probe the bitset</h2><p class="lab-copy">Three stored keys set three bit positions each. Probe a key and follow its hash positions before deciding whether storage I/O is necessary.</p></div><span class="lab-badge">hash → bits → maybe</span></div>
        <div class="controls"><div class="control"><label for="bloom-size">Filter size</label><select id="bloom-size"><option value="compact">24 bits · crowded</option><option value="roomy">48 bits · roomier</option></select></div><div class="control grow"><label for="bloom-query">Probe key</label><select id="bloom-query"><option value="mango">mango · stored</option><option value="quartz">quartz · absent, collision-prone</option><option value="comet">comet · absent</option></select></div><button class="button primary" id="probe-bloom">Probe filter</button></div>
        <div class="bloom-source"><span>Inserted keys</span>${["mango", "cedar", "orbit"].map((key) => `<code>${key}</code>`).join("")}</div>
        <div class="bloom-bits" id="bloom-bits" aria-label="Bloom filter bitset"></div>
        <div class="bloom-hashes" id="bloom-hashes" aria-live="polite"></div>
        <div class="workload-flow"><div class="flow-node"><small>Probe</small><strong id="bloom-probe-label">—</strong></div><span class="flow-arrow">→</span><div class="flow-node"><small>Filter answer</small><strong id="bloom-answer">—</strong></div><span class="flow-arrow">→</span><div class="flow-node"><small>Storage</small><strong id="bloom-storage">—</strong></div></div>
        <div class="metric-grid compact"><div class="metric"><span>Bits checked</span><strong id="bloom-checked">—</strong><small>one per hash function</small></div><div class="metric"><span>Disk read</span><strong id="bloom-read">—</strong><small>avoided on definite miss</small></div><div class="metric"><span>Result type</span><strong id="bloom-result">—</strong><small>exact or probabilistic</small></div></div>
        <div class="diagnosis" id="bloom-diagnosis"><span class="diagnosis-label">Rule</span><p>Any zero bit proves absence. All one bits mean only “maybe present.”</p></div>
      </section>
      <section class="concept-grid">
        <div class="concept-card"><span class="concept-number">zero</span><h3>Definitely absent</h3><p>If one required bit is unset, the key was never added. Skip the expensive downstream lookup.</p></div>
        <div class="concept-card"><span class="concept-number">all ones</span><h3>Maybe present</h3><p>Other keys may have set the same positions. Check the authoritative store before returning a hit.</p></div>
        <div class="concept-card"><span class="concept-number">tuning</span><h3>Memory buys accuracy</h3><p>More bits per key generally reduce collisions; too many hash functions add CPU and eventually set too many bits.</p></div>
      </section>
      <div class="insight"><span class="insight-mark">!</span><p><strong>Where this helps:</strong> LSM-based stores often use Bloom filters to avoid checking sorted files that definitely cannot contain a requested key.</p></div>
      ${DSL.lessonFooter("bloom")}
    </article>`;
    setupBloomLab();
  }

  function setupBloomLab() {
    const size = document.getElementById("bloom-size");
    const query = document.getElementById("bloom-query");
    const bits = document.getElementById("bloom-bits");

    function drawBits() {
      const count = size.value === "compact" ? 24 : 48;
      const set = activeBits(size.value);
      bits.innerHTML = Array.from({ length: count }, (_, index) => `<span class="bloom-bit ${set.has(index) ? "set" : ""}" data-bit="${index}"><small>${index}</small><strong>${set.has(index) ? "1" : "0"}</strong></span>`).join("");
      document.getElementById("bloom-hashes").innerHTML = "";
      ["bloom-probe-label", "bloom-answer", "bloom-storage", "bloom-checked", "bloom-read", "bloom-result"].forEach((id) => { document.getElementById(id).textContent = "—"; });
    }
    size.addEventListener("change", drawBits);
    drawBits();

    document.getElementById("probe-bloom").addEventListener("click", () => {
      DSL.clearTimers();
      drawBits();
      const mode = size.value;
      const key = query.value;
      const positions = QUERIES[mode][key];
      const set = activeBits(mode);
      const maybe = positions.every((position) => set.has(position));
      const actuallyPresent = Object.prototype.hasOwnProperty.call(INSERTED[mode], key);
      document.getElementById("bloom-probe-label").textContent = key;
      document.getElementById("bloom-hashes").innerHTML = positions.map((position, index) => `<span>h${index + 1}(${key}) → bit ${position}</span>`).join("");
      positions.forEach((position, index) => DSL.setTimer(() => {
        document.querySelector(`[data-bit="${position}"]`).classList.add(set.has(position) ? "checked-set" : "checked-zero");
        document.getElementById("bloom-checked").textContent = String(index + 1);
        if (index === positions.length - 1) {
          document.getElementById("bloom-answer").textContent = maybe ? "maybe present" : "definitely absent";
          document.getElementById("bloom-storage").textContent = maybe ? (actuallyPresent ? "found mango" : "not found") : "read skipped";
          document.getElementById("bloom-read").textContent = maybe ? "Yes" : "No";
          document.getElementById("bloom-result").textContent = !maybe ? "Exact miss" : actuallyPresent ? "True positive" : "False positive";
          const diagnosis = document.getElementById("bloom-diagnosis");
          diagnosis.className = `diagnosis ${!maybe || actuallyPresent ? "resolved" : "warning"}`;
          diagnosis.innerHTML = `<span class="diagnosis-label">${!maybe ? "Saved I/O" : actuallyPresent ? "Confirmed hit" : "Expected trade-off"}</span><p>${!maybe ? "At least one required bit was zero, so the system can safely avoid touching storage." : actuallyPresent ? "All bits were set, so the system checked storage and found the key." : "All bits were set by other keys. The extra storage read found nothing: a false positive, never an incorrect returned value."}</p>`;
        }
      }, 160 + index * 260));
    });
  }

  DSL.registerRenderer("bloom", renderBloom);
})(window.DataSystemsLab);
