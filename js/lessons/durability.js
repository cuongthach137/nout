(function registerDurabilityLesson(DSL) {
  "use strict";

  function renderDurability() {
    const lesson = DSL.getLesson("durability");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "COMMIT is a protocol between <em>memory and durable storage</em>.", "PostgreSQL does not need to flush every changed table page before acknowledging a transaction. It first makes the redo information durable in the write-ahead log, then can repair data pages during recovery.", "Intermediate")}
      <section class="lab incident-lab">
        <div class="incident-strip"><span>Crash lab</span><strong>Power fails immediately after checkout</strong><span class="severity">durability</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Lab 16 · WAL recovery</span><h2>Choose when the server crashes</h2><p class="lab-copy">Commit one order, then cut power at a precise point. Compare synchronous and asynchronous commit by watching the acknowledgement, WAL, and heap page independently.</p></div><span class="lab-badge">log before data</span></div>
        <div class="controls">
          <div class="control grow"><label for="commit-mode">Commit acknowledgement</label><select id="commit-mode"><option value="sync">synchronous_commit = on</option><option value="async">synchronous_commit = off</option></select></div>
          <div class="control grow"><label for="crash-point">Crash point</label><select id="crash-point"><option value="before-wal">After WAL generation, before WAL flush</option><option value="after-wal">After WAL flush, before heap-page flush</option><option value="after-data">After heap-page flush</option></select></div>
          <button class="button primary" type="button" id="run-crash">Commit, then crash</button>
        </div>

        <div class="durability-pipeline" aria-live="polite">
          <div class="durability-node" id="durability-client"><small>Client</small><strong id="ack-state">waiting</strong><span>COMMIT response</span></div><span>←</span>
          <div class="durability-node" id="durability-memory"><small>Memory</small><strong id="memory-state">order #9001</strong><span>dirty page + WAL record</span></div><span>→</span>
          <div class="durability-node" id="durability-wal"><small>Durable WAL</small><strong id="wal-state">empty</strong><span>sequential fsync</span></div><span>→</span>
          <div class="durability-node" id="durability-heap"><small>Data file</small><strong id="heap-state">old page</strong><span>flushed later</span></div>
        </div>
        <div class="crash-banner" id="crash-banner"><span>⚡</span><strong>System running</strong><small>Recovery has not started</small></div>

        <div class="metric-grid compact"><div class="metric"><span>Client observed</span><strong id="durability-ack">—</strong><small>was success returned?</small></div><div class="metric"><span>Recovery source</span><strong id="recovery-source">—</strong><small>what can reconstruct the write?</small></div><div class="metric"><span>Order after restart</span><strong id="recovery-result">—</strong><small>durable application state</small></div></div>
        <div class="diagnosis" id="durability-diagnosis"><span class="diagnosis-label">Commit contract</span><p>With synchronous commit, success waits for the WAL flush—not for every changed table page to reach disk.</p></div>
      </section>

      <section class="concept-grid">
        <div class="concept-card"><span class="concept-number">write ahead</span><h3>Log first</h3><p>The WAL describing a page change reaches durable storage before the corresponding dirty data page may be written.</p></div>
        <div class="concept-card"><span class="concept-number">redo</span><h3>Repair after a crash</h3><p>Recovery replays durable WAL records whose effects were not yet present in the data files.</p></div>
        <div class="concept-card"><span class="concept-number">async commit</span><h3>Lower latency, weaker acknowledgement</h3><p>The server may return success before WAL is flushed, so a crash can lose recently acknowledged transactions without corrupting the database.</p></div>
      </section>
      <div class="insight"><span class="insight-mark">!</span><p><strong>External side effects raise the stakes.</strong> Do not dispense cash, send an irreversible message, or tell another system “done” from a transaction whose durability contract permits acknowledged loss.</p></div>
      ${DSL.lessonFooter("durability")}
    </article>`;
    setupDurabilityLab();
  }

  function setupDurabilityLab() {
    const button = document.getElementById("run-crash");

    function resetVisual() {
      ["durability-client", "durability-memory", "durability-wal", "durability-heap"].forEach((id) => {
        document.getElementById(id).className = "durability-node";
      });
      document.getElementById("ack-state").textContent = "waiting";
      document.getElementById("memory-state").textContent = "order #9001";
      document.getElementById("wal-state").textContent = "empty";
      document.getElementById("heap-state").textContent = "old page";
      document.getElementById("crash-banner").className = "crash-banner";
      document.getElementById("crash-banner").innerHTML = "<span>⚡</span><strong>System running</strong><small>Recovery has not started</small>";
    }

    function finish(crashPoint, synchronous) {
      const walDurable = crashPoint !== "before-wal";
      const dataDurable = crashPoint === "after-data";
      const acknowledged = !synchronous || walDurable;
      const survives = walDurable || dataDurable;
      const riskyLoss = acknowledged && !survives;
      const banner = document.getElementById("crash-banner");
      const diagnosis = document.getElementById("durability-diagnosis");

      document.getElementById("durability-memory").className = "durability-node lost";
      document.getElementById("memory-state").textContent = "memory lost";
      document.getElementById("durability-ack").textContent = acknowledged ? "SUCCESS" : "NO ACK";
      document.getElementById("recovery-source").textContent = walDurable ? (dataDurable ? "DATA PAGE" : "WAL REDO") : "NONE";
      document.getElementById("recovery-result").textContent = survives ? "RESTORED" : "MISSING";
      document.getElementById("recovery-result").style.color = survives ? "var(--green)" : "var(--coral)";
      banner.className = `crash-banner ${survives ? "recovered" : "failed"}`;
      banner.innerHTML = `<span>⚡</span><strong>Crash → restart → ${survives ? "recovery complete" : "no durable record"}</strong><small>${walDurable && !dataDurable ? "REDO reapplied order #9001 to the data page" : dataDurable ? "The changed data page was already durable" : "The in-memory WAL record disappeared"}</small>`;

      if (riskyLoss) {
        diagnosis.className = "diagnosis warning";
        diagnosis.innerHTML = `<span class="diagnosis-label">Acknowledged loss</span><p>Asynchronous commit returned success before the WAL flush. The database restarts in a consistent state, but order #9001 is absent even though the client was told it committed.</p>`;
      } else if (!acknowledged) {
        diagnosis.className = "diagnosis resolved";
        diagnosis.innerHTML = `<span class="diagnosis-label">Contract preserved</span><p>The crash happened before the required WAL flush, so synchronous commit never returned success. The client sees an uncertain/failed request and may reconcile or retry idempotently.</p>`;
      } else {
        diagnosis.className = "diagnosis resolved";
        diagnosis.innerHTML = `<span class="diagnosis-label">Durable commit</span><p>${dataDurable ? "The heap page already contains the order." : "The heap page was stale, but the durable WAL record rebuilt it during REDO."} A success response remains true after restart.</p>`;
      }
      button.disabled = false;
    }

    button.addEventListener("click", () => {
      DSL.clearTimers();
      const synchronous = document.getElementById("commit-mode").value === "sync";
      const crashPoint = document.getElementById("crash-point").value;
      const diagnosis = document.getElementById("durability-diagnosis");
      button.disabled = true;
      resetVisual();
      ["durability-ack", "recovery-source", "recovery-result"].forEach((id) => { document.getElementById(id).textContent = "…"; });
      document.getElementById("durability-memory").className = "durability-node active";
      diagnosis.className = "diagnosis investigating";
      diagnosis.innerHTML = `<span class="diagnosis-label">Commit in progress</span><p>The data page and WAL record exist in memory. ${synchronous ? "The client is still waiting for durable WAL." : "Asynchronous mode may acknowledge before durable WAL."}</p>`;

      DSL.setTimer(() => {
        if (!synchronous) {
          document.getElementById("durability-client").className = "durability-node acknowledged";
          document.getElementById("ack-state").textContent = "SUCCESS sent";
        }
        document.getElementById("wal-state").textContent = "record generated";
      }, 380);

      DSL.setTimer(() => {
        if (crashPoint === "before-wal") {
          finish(crashPoint, synchronous);
          return;
        }
        document.getElementById("durability-wal").className = "durability-node durable";
        document.getElementById("wal-state").textContent = "flushed + fsync";
        if (synchronous) {
          document.getElementById("durability-client").className = "durability-node acknowledged";
          document.getElementById("ack-state").textContent = "SUCCESS sent";
        }
      }, 820);

      DSL.setTimer(() => {
        if (crashPoint === "before-wal") return;
        if (crashPoint === "after-wal") {
          finish(crashPoint, synchronous);
          return;
        }
        document.getElementById("durability-heap").className = "durability-node durable";
        document.getElementById("heap-state").textContent = "order #9001";
      }, 1260);

      DSL.setTimer(() => {
        if (crashPoint === "after-data") finish(crashPoint, synchronous);
      }, 1660);
    });
  }

  DSL.registerRenderer("durability", renderDurability);
})(window.DataSystemsLab);
