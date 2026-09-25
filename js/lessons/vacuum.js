(function registerVacuumLesson(DSL) {
  "use strict";

  const PAGE_COUNT = 12;
  const SLOTS_PER_PAGE = 6;

  function renderVacuum() {
    const lesson = DSL.getLesson("vacuum");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "Dead tuples are not free space <em>yet.</em>", "Updates and deletes leave old row versions behind. VACUUM decides which versions are no longer visible to any transaction and turns their space into something future writes can reuse.", "Intermediate")}

      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Lab 23 · maintenance</span><h2>Reclaim a high-churn table</h2><p class="lab-copy">Generate obsolete versions, optionally pin them with an old snapshot, then compare ordinary VACUUM with the table rewrite performed by VACUUM FULL.</p></div><span class="lab-badge">visibility → reclaim</span></div>
        <div class="controls">
          <div class="control grow"><label for="vacuum-churn">Obsolete tuples: <span id="vacuum-churn-value">50%</span></label><input id="vacuum-churn" type="range" min="15" max="85" step="5" value="50"></div>
          <div class="control"><label for="vacuum-snapshot">Oldest snapshot</label><select id="vacuum-snapshot"><option value="none">No old transaction</option><option value="pinned">Report open for 4 hours</option></select></div>
          <div class="control"><label for="vacuum-kind">Maintenance</label><select id="vacuum-kind"><option value="standard">VACUUM</option><option value="full">VACUUM FULL</option></select></div>
          <button class="button primary" id="run-vacuum">Run maintenance</button>
        </div>

        <div class="vacuum-comparison" aria-live="polite">
          <div class="vacuum-side"><div class="storage-panel-head"><span>Before</span><strong>12 file pages</strong></div><div class="vacuum-pages" id="vacuum-before"></div></div>
          <div class="vacuum-operation"><span>→</span><strong id="vacuum-operation-label">VACUUM</strong></div>
          <div class="vacuum-side"><div class="storage-panel-head"><span>After</span><strong id="vacuum-file-label">—</strong></div><div class="vacuum-pages" id="vacuum-after"></div></div>
        </div>
        <div class="tuple-legend"><span><i class="live"></i>live</span><span><i class="dead"></i>dead</span><span><i class="pinned"></i>snapshot-pinned</span><span><i class="reusable"></i>reusable</span></div>
        <div class="metric-grid compact">
          <div class="metric"><span>Space made reusable</span><strong id="vacuum-reusable">—</strong><small>tuple slots</small></div>
          <div class="metric"><span>Table file</span><strong id="vacuum-pages-metric">—</strong><small>physical pages after operation</small></div>
          <div class="metric"><span>Write availability</span><strong id="vacuum-lock">—</strong><small>during maintenance</small></div>
        </div>
        <div class="diagnosis" id="vacuum-diagnosis"><span class="diagnosis-label">Ready</span><p>Run maintenance to see whether obsolete versions are actually reclaimable.</p></div>
      </section>

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Production drill</span><strong>Autovacuum runs, but the table keeps growing</strong><span class="severity">storage pressure</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Symptom → blocker → response</span><h2>The oldest transaction sets the cleanup horizon</h2><p class="lab-copy">A reporting connection began a transaction and never closed it. Model the version backlog at the same update rate with and without that pinned snapshot.</p></div><span class="lab-badge">orders table</span></div>
        <div class="controls"><div class="control"><label for="vacuum-report">Reporting session</label><select id="vacuum-report"><option value="closed">Commits after each report</option><option value="open" selected>Idle in transaction · 4h</option></select></div><div class="control grow"><label for="vacuum-rate">Updates per second: <span id="vacuum-rate-value">1,000</span></label><input id="vacuum-rate" type="range" min="100" max="3000" step="100" value="1000"></div><button class="button primary" id="sample-vacuum-health">Sample health</button></div>
        <div class="metric-grid compact"><div class="metric"><span>Old versions retained</span><strong id="vacuum-backlog">—</strong><small>simplified estimate</small></div><div class="metric"><span>Table growth</span><strong id="vacuum-growth">—</strong><small>at 300 bytes/version</small></div><div class="metric"><span>Autovacuum state</span><strong id="autovacuum-state">—</strong><small>cleanup horizon</small></div></div>
        <div class="diagnosis" id="vacuum-health-diagnosis"><span class="diagnosis-label">Investigation</span><p>Sample both states. “Vacuum is running” does not mean every dead tuple is removable.</p></div>
      </section>

      ${DSL.EngineLens.render({ id: "cleanup-engine-lens", title: "All three engines preserve older state—but clean up different structures", copy: "The portable lifecycle is create a newer state, keep history while a reader may need it, then reclaim safely. PostgreSQL tuples, InnoDB undo records, and SQLite WAL/database pages make that lifecycle physically different." })}
      <div class="insight"><span class="insight-mark">!</span><p><strong>Ordinary VACUUM usually keeps the file size unchanged.</strong> It marks safe slots for reuse inside the existing file. VACUUM FULL can shrink the file by rewriting it, but that rewrite takes an exclusive table lock—so prevention is usually cheaper than rescue.</p></div>
      ${DSL.lessonFooter("vacuum")}
    </article>`;
    setupVacuumLab();
    setupVacuumHealthDrill();
    DSL.EngineLens.mount("cleanup-engine-lens", cleanupEngineConfig());
  }

  function cleanupEngineConfig() {
    return { engines: [
      {
        id: "postgres", label: "PostgreSQL", version: "PostgreSQL 18", mechanism: "New heap tuple → pruning/VACUUM → reusable slot", signature: "UPDATE creates tuple; HOT may avoid new index entries",
        diagram: [{ kicker: "write", label: "new tuple", detail: "xmin=new XID" }, { kicker: "history", label: "old tuple", detail: "xmax set" }, { kicker: "horizon", label: "oldest xmin", detail: "still visible?" }, { kicker: "cleanup", label: "reusable slot", detail: "VACUUM/prune" }],
        steps: [{ title: "Create another heap tuple", copy: "UPDATE inserts a new physical version and marks the old one; a HOT update can link it on-page without new index entries." }, { title: "Keep both while visibility requires", copy: "Snapshots can still select the old version, so removing it immediately would violate MVCC." }, { title: "Advance the cleanup horizon", copy: "Once no active transaction can see the old version, it is dead to everyone." }, { title: "Prune or vacuum", copy: "Page pruning can collapse HOT chains; VACUUM cleans dead tuples and indexes and marks heap space reusable." }],
        counters: [{ label: "History lives in", value: "heap", note: "tuple versions" }, { label: "Background cleanup", value: "autovacuum", note: "table workers" }, { label: "Shrink file", value: "VACUUM FULL", note: "rewrite + lock" }],
        incident: { title: "n_dead_tup rises while autovacuum is active", copy: "The cleanup worker is not necessarily misconfigured. An old snapshot can keep versions globally visible and pin the horizon.", evidence: "SELECT pid, xact_start, state\nFROM pg_stat_activity\nWHERE backend_xmin IS NOT NULL\nORDER BY xact_start;" },
        challenge: { prompt: "Which change increases HOT eligibility for an unindexed updated column?", options: ["Pack pages more tightly", "Reserve page space with lower fillfactor", "Add another B-tree"], answer: 1, why: "HOT needs the new version to fit on the same heap page; a lower fillfactor deliberately leaves update room." },
        source: { label: "HOT documentation", url: "https://www.postgresql.org/docs/18/storage-hot.html" },
      },
      {
        id: "mysql", label: "MySQL / InnoDB", version: "MySQL 8.4 · InnoDB", mechanism: "Clustered record + undo history → purge", signature: "DB_ROLL_PTR links to undo; purge removes obsolete history",
        diagram: [{ kicker: "write", label: "clustered record", detail: "new current value" }, { kicker: "history", label: "undo record", detail: "old field values" }, { kicker: "horizon", label: "read views", detail: "history needed?" }, { kicker: "cleanup", label: "purge", detail: "remove obsolete" }],
        steps: [{ title: "Change the clustered record", copy: "InnoDB records information needed to roll the change back and reconstruct older versions." }, { title: "Link undo history", copy: "A rollback pointer connects the current record to undo records used by active consistent reads." }, { title: "Wait for old read views", copy: "Purge cannot discard history still needed by the oldest active read view." }, { title: "Purge asynchronously", copy: "Purge threads remove obsolete undo history and delete-marked secondary records; reclaiming file space may still require a rebuild operation." }],
        counters: [{ label: "History lives in", value: "undo", note: "rollback segments" }, { label: "Background cleanup", value: "purge", note: "threads" }, { label: "Lag signal", value: "history list", note: "old read views" }],
        incident: { title: "History list length climbs during a backup", copy: "A long consistent read needs old undo versions. More purge threads cannot cross that read-view horizon; shorten or isolate the transaction first.", evidence: "SHOW ENGINE INNODB STATUS\n---TRANSACTION 421, ACTIVE 14400 sec\nHistory list length 18200431" },
        challenge: { prompt: "Purge lag grows while one four-hour consistent read remains open. What is the primary blocker?", options: ["Too few B-tree levels", "The old read view", "Missing binary logs"], answer: 1, why: "Undo history must remain available until no active read view can require it." },
        source: { label: "undo-log documentation", url: "https://dev.mysql.com/doc/refman/8.4/en/innodb-undo-logs.html" },
      },
      {
        id: "sqlite", label: "SQLite", version: "SQLite 3.x · WAL mode", mechanism: "Changed pages append to WAL → checkpoint → page reuse", signature: "no PostgreSQL-style dead tuples; page versions live in WAL/main DB",
        diagram: [{ kicker: "write", label: "changed page", detail: "append WAL frame" }, { kicker: "history", label: "older page", detail: "main DB / older frame" }, { kicker: "merge", label: "checkpoint", detail: "copy safe frames" }, { kicker: "space", label: "freelist/VACUUM", detail: "reuse or rebuild" }],
        steps: [{ title: "Write page images to WAL", copy: "Commits append changed database pages and a commit marker; they do not create row-level heap versions." }, { title: "Serve reader snapshots", copy: "Readers resolve page versions no newer than their WAL end mark." }, { title: "Checkpoint safe frames", copy: "The checkpointer copies frames back into the database but stops before pages still needed by an older reader." }, { title: "Reuse or return space", copy: "Deleted database pages join the freelist for reuse. A full VACUUM rebuilds the database to return free pages to the filesystem unless auto-vacuum is configured." }],
        counters: [{ label: "History granularity", value: "page", note: "WAL frames" }, { label: "Merge mechanism", value: "checkpoint", note: "WAL → database" }, { label: "Free DB pages", value: "freelist", note: "reused later" }],
        incident: { title: "The -wal file grows even though checkpoints run", copy: "A continuous old reader prevents the checkpoint from resetting the WAL. Find the reader gap; running more passive checkpoints repeats the same boundary.", evidence: "PRAGMA wal_checkpoint(PASSIVE);\n-- log frames: 48210\n-- checkpointed: 1200\n-- reader end mark pins reset" },
        challenge: { prompt: "What operation moves committed WAL frames back into the main SQLite database file?", options: ["Purge", "Checkpoint", "HOT pruning"], answer: 1, why: "Checkpointing transfers safe WAL content into the main database; purge and HOT are mechanisms from other engines." },
        source: { label: "WAL documentation", url: "https://www.sqlite.org/wal.html" },
      },
    ] };
  }

  function makeCells(live, dead, pinned, reusable, total = PAGE_COUNT * SLOTS_PER_PAGE) {
    const states = [
      ...Array.from({ length: live }, () => "live"),
      ...Array.from({ length: pinned }, () => "pinned"),
      ...Array.from({ length: dead }, () => "dead"),
      ...Array.from({ length: reusable }, () => "reusable"),
    ];
    while (states.length < total) states.push("empty");
    return states.slice(0, total);
  }

  function renderPageGrid(target, cells, pageCount) {
    target.innerHTML = Array.from({ length: pageCount }, (_, pageIndex) => {
      const slots = cells.slice(pageIndex * SLOTS_PER_PAGE, (pageIndex + 1) * SLOTS_PER_PAGE);
      return `<div class="vacuum-page"><small>p${pageIndex + 1}</small><div>${slots.map((state) => `<i class="${state}" title="${state}"></i>`).join("")}</div></div>`;
    }).join("");
  }

  function setupVacuumLab() {
    const churn = document.getElementById("vacuum-churn");
    churn.addEventListener("input", () => { document.getElementById("vacuum-churn-value").textContent = `${churn.value}%`; });

    document.getElementById("run-vacuum").addEventListener("click", () => {
      const total = PAGE_COUNT * SLOTS_PER_PAGE;
      const deadBefore = Math.round(total * Number(churn.value) / 100);
      const live = total - deadBefore;
      const pinnedSnapshot = document.getElementById("vacuum-snapshot").value === "pinned";
      const kind = document.getElementById("vacuum-kind").value;
      const pinned = pinnedSnapshot ? Math.round(deadBefore * 0.72) : 0;
      const reclaimable = deadBefore - pinned;
      const full = kind === "full";
      const waitingForLock = full && pinnedSnapshot;
      const filePages = full && !waitingForLock ? Math.max(1, Math.ceil((live + pinned) / SLOTS_PER_PAGE)) : PAGE_COUNT;

      renderPageGrid(document.getElementById("vacuum-before"), makeCells(live, deadBefore, 0, 0), PAGE_COUNT);
      renderPageGrid(
        document.getElementById("vacuum-after"),
        waitingForLock ? makeCells(live, reclaimable, pinned, 0) : full ? makeCells(live, 0, pinned, 0, filePages * SLOTS_PER_PAGE) : makeCells(live, 0, pinned, reclaimable),
        filePages,
      );

      document.getElementById("vacuum-operation-label").textContent = waitingForLock ? "waiting" : full ? "rewrite" : "reclaim";
      document.getElementById("vacuum-file-label").textContent = `${filePages} file page${filePages === 1 ? "" : "s"}`;
      document.getElementById("vacuum-reusable").textContent = waitingForLock ? "0 · waiting" : full ? `${reclaimable} removed` : reclaimable;
      document.getElementById("vacuum-pages-metric").textContent = full ? `${PAGE_COUNT} → ${filePages}` : `${PAGE_COUNT} → ${PAGE_COUNT}`;
      document.getElementById("vacuum-lock").textContent = waitingForLock ? "WAITING" : full ? "BLOCKED" : "available";

      const diagnosis = document.getElementById("vacuum-diagnosis");
      const healthy = !pinnedSnapshot && !full;
      diagnosis.className = `diagnosis ${healthy ? "resolved" : "warning"}`;
      if (waitingForLock) {
        diagnosis.innerHTML = `<span class="diagnosis-label">Rewrite cannot start</span><p>VACUUM FULL needs an ACCESS EXCLUSIVE lock, but the report still holds its table lock and snapshot. The rewrite waits; end the transaction safely before scheduling disruptive maintenance.</p>`;
      } else if (pinnedSnapshot) {
        diagnosis.innerHTML = `<span class="diagnosis-label">Cleanup horizon pinned</span><p>${pinned} old slots may still be visible to the four-hour snapshot and cannot be discarded. Ordinary VACUUM can reclaim only the other ${reclaimable} slots; end the transaction safely before tuning workers.</p>`;
      } else if (full) {
        diagnosis.innerHTML = `<span class="diagnosis-label">Space returned</span><p>The rewrite compacted live tuples into ${filePages} pages, but writes were blocked by an ACCESS EXCLUSIVE lock. This is a disruptive repair, not routine housekeeping.</p>`;
      } else {
        diagnosis.innerHTML = `<span class="diagnosis-label">Routine outcome</span><p>${reclaimable} slots are reusable by future inserts and updates. The table file remains ${PAGE_COUNT} pages on disk, which is expected for ordinary VACUUM.</p>`;
      }
    });
  }

  function setupVacuumHealthDrill() {
    const rate = document.getElementById("vacuum-rate");
    rate.addEventListener("input", () => { document.getElementById("vacuum-rate-value").textContent = Number(rate.value).toLocaleString(); });

    document.getElementById("sample-vacuum-health").addEventListener("click", () => {
      const open = document.getElementById("vacuum-report").value === "open";
      const updatesPerSecond = Number(rate.value);
      const retained = updatesPerSecond * (open ? 4 * 60 * 60 : 75);
      const growthGiB = retained * 300 / 1024 / 1024 / 1024;
      document.getElementById("vacuum-backlog").textContent = retained.toLocaleString();
      document.getElementById("vacuum-growth").textContent = `${growthGiB.toFixed(growthGiB < 1 ? 2 : 1)} GiB`;
      document.getElementById("autovacuum-state").textContent = open ? "cannot remove" : "keeping pace";
      const diagnosis = document.getElementById("vacuum-health-diagnosis");
      diagnosis.className = `diagnosis ${open ? "warning" : "resolved"}`;
      diagnosis.innerHTML = open
        ? `<span class="diagnosis-label">Root cause</span><p>The report's snapshot can still reference versions created since it began. Inspect transaction age and “idle in transaction” sessions before making vacuum more aggressive; otherwise workers revisit tuples they still cannot remove.</p>`
        : `<span class="diagnosis-label">Healthy horizon</span><p>Short report transactions release snapshots quickly. Autovacuum can reclaim recent churn, holding the simplified backlog near ${retained.toLocaleString()} versions instead of four hours of writes.</p>`;
    });
  }

  DSL.registerRenderer("vacuum", renderVacuum);
})(window.DataSystemsLab);
