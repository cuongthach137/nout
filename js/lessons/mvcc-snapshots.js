(function registerMvccSnapshotsLesson(DSL) {
  "use strict";

  const SCENARIOS = Object.freeze({
    nonrepeatable: {
      label: "Non-repeatable read",
      first: "$100",
      changed: "$120",
      subject: "order #42 total",
      write: "UPDATE order #42 → $120",
      versionOne: "v1 · $100",
      versionTwo: "v2 · $120",
      anomaly: "The same row changed between two reads.",
    },
    phantom: {
      label: "Phantom read",
      first: "3 rows",
      changed: "4 rows",
      subject: "COUNT(*) WHERE status = 'paid'",
      write: "INSERT another paid order",
      versionOne: "snapshot · 3 matches",
      versionTwo: "new row · paid",
      anomaly: "The repeated predicate returned a different set of rows.",
    },
  });

  function renderMvccSnapshots() {
    const lesson = DSL.getLesson("mvcc-snapshots");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "Every read asks: <em>which version is visible?</em>", "MVCC keeps multiple row versions so readers do not need to block writers. The isolation level determines whether a transaction receives a fresh snapshot for each statement or keeps one stable view.", "Intermediate")}
      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Lab 13 · MVCC timeline</span><h2>Repeat a read while another transaction commits</h2><p class="lab-copy">Compare PostgreSQL Read Committed with Repeatable Read. The write is the same; only transaction A’s snapshot policy changes.</p></div><span class="lab-badge">visible ≠ latest</span></div>
        <div class="controls">
          <div class="control grow"><label for="snapshot-scenario">Phenomenon</label><select id="snapshot-scenario"><option value="nonrepeatable">Non-repeatable read · one row changes</option><option value="phantom">Phantom read · result set changes</option></select></div>
          <div class="control grow"><label for="snapshot-isolation">Transaction A isolation</label><select id="snapshot-isolation"><option value="read-committed">READ COMMITTED</option><option value="repeatable-read">REPEATABLE READ</option></select></div>
          <button class="button primary" type="button" id="run-snapshot-schedule">Run schedule</button>
        </div>

        <div class="snapshot-scene" aria-live="polite">
          <div class="snapshot-transaction"><small>Transaction A sees</small><strong id="snapshot-policy">new snapshot per statement</strong><span id="snapshot-subject">order #42 total</span></div>
          <div class="version-chain" aria-label="Stored row versions"><div class="row-version visible" id="row-version-one"><small>old version</small><strong id="version-one-value">v1 · $100</strong></div><span>→</span><div class="row-version" id="row-version-two"><small>concurrent version</small><strong id="version-two-value">v2 · $120</strong></div></div>
        </div>

        <div class="schedule" id="snapshot-schedule"><div class="schedule-head">Time</div><div class="schedule-head">Transaction A · reader</div><div class="schedule-head">Transaction B · writer</div><div class="schedule-time">—</div><div>Run the schedule</div><div>to compare snapshots</div></div>
        <div class="metric-grid compact"><div class="metric"><span>First read</span><strong id="snapshot-first">—</strong><small>before B commits</small></div><div class="metric"><span>Second read</span><strong id="snapshot-second">—</strong><small>after B commits</small></div><div class="metric"><span>Observed phenomenon</span><strong id="snapshot-outcome">—</strong><small>inside transaction A</small></div></div>
        <div class="diagnosis" id="snapshot-diagnosis"><span class="diagnosis-label">Snapshot rule</span><p>Read Committed starts each statement with a new snapshot. Repeatable Read keeps the transaction’s initial snapshot.</p></div>
      </section>

      <section class="concept-grid">
        <div class="concept-card"><span class="concept-number">dirty read</span><h3>Never in PostgreSQL</h3><p>Even READ UNCOMMITTED behaves as READ COMMITTED; another transaction’s uncommitted version is not visible.</p></div>
        <div class="concept-card"><span class="concept-number">read committed</span><h3>Fresh per statement</h3><p>Two SELECT statements in one transaction can legitimately observe different committed states.</p></div>
        <div class="concept-card"><span class="concept-number">repeatable read</span><h3>Stable snapshot</h3><p>PostgreSQL also prevents phantoms at this level, though serialization anomalies can still occur.</p></div>
      </section>
      ${DSL.EngineLens.render({ id: "snapshot-engine-lens", title: "The word “snapshot” hides three concurrency designs", copy: "The portable rule is that a read selects a committed database state. Where older values live, when the state is chosen, and how serializable behavior is enforced are engine-specific." })}
      <div class="insight"><span class="insight-mark">!</span><p><strong>A stable snapshot is not the same as full serializability.</strong> It fixes re-reads and phantoms, but transactions can still make incompatible decisions from the same old state.</p></div>
      ${DSL.lessonFooter("mvcc-snapshots")}
    </article>`;
    setupSnapshotLab();
    DSL.EngineLens.mount("snapshot-engine-lens", snapshotEngineConfig());
  }

  function snapshotEngineConfig() {
    return { engines: [
      {
        id: "postgres", label: "PostgreSQL", version: "PostgreSQL 18", mechanism: "Heap tuple versions + snapshots + SSI", signature: "xmin/xmax visibility; SIReadLock for Serializable",
        diagram: [{ kicker: "reader", label: "snapshot", detail: "active XIDs + horizon" }, { kicker: "heap", label: "v1 xmin=10", detail: "candidate version" }, { kicker: "visibility", label: "visible?", detail: "evaluate header" }, { kicker: "serializable", label: "dependency graph", detail: "abort unsafe cycle" }],
        steps: [{ title: "Choose a snapshot", copy: "Read Committed chooses one per statement; Repeatable Read and Serializable retain a transaction snapshot." }, { title: "Visit heap versions", copy: "Tuple xmin/xmax metadata is evaluated against the snapshot; old versions coexist in the heap." }, { title: "Return the visible version", copy: "A committed newer tuple can remain invisible to a transaction whose snapshot predates it." }, { title: "Add Serializable checks", copy: "SSI records read/write dependencies with nonblocking predicate locks and aborts an unsafe transaction rather than locking every predicate." }],
        counters: [{ label: "RC snapshot", value: "per statement", note: "can change" }, { label: "RR snapshot", value: "per transaction", note: "stable" }, { label: "Serializable", value: "SSI + retry", note: "40001 possible" }],
        incident: { title: "No blocking, then a serialization failure", copy: "Two Serializable transactions read overlapping predicates and write disjoint rows. SIRead locks do not block; PostgreSQL detects a dangerous dependency and aborts one at commit.", evidence: "ERROR: could not serialize access\ndue to read/write dependencies among transactions\nSQLSTATE 40001" },
        challenge: { prompt: "Does a PostgreSQL SIReadLock block an insert into the protected predicate?", options: ["Always", "No; it records a dependency", "Only outside Serializable"], answer: 1, why: "SSI predicate locks are used to detect serialization anomalies; they do not themselves block the writer." },
        source: { label: "transaction-isolation documentation", url: "https://www.postgresql.org/docs/18/transaction-iso.html" },
      },
      {
        id: "mysql", label: "MySQL / InnoDB", version: "MySQL 8.4 · InnoDB", mechanism: "Read view + clustered record + undo chain", signature: "DB_TRX_ID / DB_ROLL_PTR → undo records",
        diagram: [{ kicker: "reader", label: "read view", detail: "visibility boundary" }, { kicker: "clustered row", label: "latest record", detail: "DB_TRX_ID" }, { kicker: "pointer", label: "ROLL_PTR", detail: "follow undo" }, { kicker: "undo", label: "older value", detail: "consistent read" }],
        steps: [{ title: "Create the read view", copy: "At default Repeatable Read, the first consistent read establishes the view reused by later consistent reads in the transaction." }, { title: "Inspect the current clustered record", copy: "Hidden transaction metadata says whether the latest version belongs in that view." }, { title: "Follow the rollback pointer", copy: "If not visible, InnoDB reconstructs an older version from undo-log records." }, { title: "Separate locking reads", copy: "SELECT ... FOR UPDATE reads a current version and takes record or next-key locks; it is not just another historical consistent read." }],
        counters: [{ label: "Default isolation", value: "Repeatable Read", note: "InnoDB" }, { label: "Old data", value: "undo log", note: "reconstructed" }, { label: "Range protection", value: "next-key locks", note: "locking reads" }],
        incident: { title: "One transaction mixed snapshot and current reads", copy: "A plain SELECT returned the original view; a later SELECT FOR UPDATE saw and locked current data. Treating both as the same kind of read produced a confusing decision.", evidence: "START TRANSACTION;\nSELECT status FROM jobs WHERE id=7; -- consistent read\nSELECT status FROM jobs WHERE id=7 FOR UPDATE; -- current locking read" },
        challenge: { prompt: "Where does InnoDB obtain an older value needed by a consistent read?", options: ["A second table copy", "Undo log records", "Only the binary log"], answer: 1, why: "Rollback pointers lead from the clustered record through undo records that can reconstruct an older visible version." },
        source: { label: "undo-log documentation", url: "https://dev.mysql.com/doc/refman/8.4/en/innodb-undo-logs.html" },
      },
      {
        id: "sqlite", label: "SQLite", version: "SQLite 3.x · WAL mode", mechanism: "Reader end mark + database pages from WAL or main file", signature: "read snapshot = WAL end mark at transaction start",
        diagram: [{ kicker: "begin read", label: "end mark", detail: "last visible commit" }, { kicker: "lookup", label: "wal-index", detail: "newer page version?" }, { kicker: "fallback", label: "main DB", detail: "older page" }, { kicker: "writer", label: "append WAL", detail: "one writer" }],
        steps: [{ title: "Remember a WAL end mark", copy: "A reader fixes the last commit record visible to its read transaction." }, { title: "Resolve each page", copy: "The wal-index finds the newest version of a page at or before that end mark; otherwise the reader uses the database file." }, { title: "Keep reading the snapshot", copy: "Later commits append beyond the reader's end mark and remain invisible to it." }, { title: "Serialize writers", copy: "Readers and one writer can overlap in WAL mode, but two writers cannot proceed simultaneously." }],
        counters: [{ label: "Reader/writer overlap", value: "yes", note: "WAL mode" }, { label: "Concurrent writers", value: "1", note: "serialized" }, { label: "Old page source", value: "WAL or DB", note: "by end mark" }],
        incident: { title: "A long reader prevents WAL reset", copy: "Checkpoint copies safe frames but stops before pages beyond an active reader's end mark. Continuous old readers can cause checkpoint starvation and WAL growth.", evidence: "PRAGMA wal_checkpoint(PASSIVE);\n-- busy=0 log=48210 checkpointed=1200\n-- old reader keeps earlier end mark" },
        challenge: { prompt: "A writer commits after a WAL reader begins. What does the reader see?", options: ["The new commit immediately", "Its original end-mark snapshot", "An error on every read"], answer: 1, why: "The reader continues resolving pages relative to the end mark chosen when its read transaction began." },
        source: { label: "WAL documentation", url: "https://www.sqlite.org/wal.html" },
      },
    ] };
  }

  function setupSnapshotLab() {
    const scenarioSelect = document.getElementById("snapshot-scenario");
    const isolationSelect = document.getElementById("snapshot-isolation");
    const schedule = document.getElementById("snapshot-schedule");
    const button = document.getElementById("run-snapshot-schedule");

    function syncPreview() {
      const scenario = SCENARIOS[scenarioSelect.value];
      const stable = isolationSelect.value === "repeatable-read";
      document.getElementById("snapshot-policy").textContent = stable ? "one transaction snapshot" : "new snapshot per statement";
      document.getElementById("snapshot-subject").textContent = scenario.subject;
      document.getElementById("version-one-value").textContent = scenario.versionOne;
      document.getElementById("version-two-value").textContent = scenario.versionTwo;
    }

    function addRow(time, reader, writer) {
      schedule.insertAdjacentHTML("beforeend", `<div class="schedule-time">${time}</div><div>${reader}</div><div>${writer}</div>`);
    }

    function run() {
      DSL.clearTimers();
      const scenario = SCENARIOS[scenarioSelect.value];
      const stable = isolationSelect.value === "repeatable-read";
      const second = stable ? scenario.first : scenario.changed;
      const anomaly = second !== scenario.first;
      const versionOne = document.getElementById("row-version-one");
      const versionTwo = document.getElementById("row-version-two");
      const diagnosis = document.getElementById("snapshot-diagnosis");
      button.disabled = true;
      schedule.innerHTML = `<div class="schedule-head">Time</div><div class="schedule-head">Transaction A · reader</div><div class="schedule-head">Transaction B · writer</div>`;
      versionOne.className = "row-version visible";
      versionTwo.className = "row-version";
      document.getElementById("snapshot-first").textContent = "…";
      document.getElementById("snapshot-second").textContent = "…";
      document.getElementById("snapshot-outcome").textContent = "RUNNING";
      diagnosis.className = "diagnosis investigating";
      diagnosis.innerHTML = `<span class="diagnosis-label">Snapshot active</span><p>Transaction A is running at ${stable ? "Repeatable Read, so its first snapshot will remain fixed." : "Read Committed, so each SELECT can see newer commits."}</p>`;

      DSL.setTimer(() => {
        addRow("t1", `<span class="tx-event read">READ → ${scenario.first}</span>`, "");
        document.getElementById("snapshot-first").textContent = scenario.first;
      }, 240);
      DSL.setTimer(() => {
        addRow("t2", "", `<span class="tx-event write">${scenario.write}</span>`);
        versionTwo.classList.add("pending");
      }, 650);
      DSL.setTimer(() => {
        addRow("t3", `<span class="tx-event blocked">cannot see uncommitted v2</span>`, `<span class="tx-event commit">COMMIT v2</span>`);
        versionTwo.className = "row-version committed";
      }, 1060);
      DSL.setTimer(() => {
        addRow("t4", `<span class="tx-event read">READ again → ${second}</span>`, "");
        document.getElementById("snapshot-second").textContent = second;
        if (!stable) {
          versionOne.classList.remove("visible");
          versionTwo.classList.add("visible");
        }
      }, 1470);
      DSL.setTimer(() => {
        addRow("t5", `<span class="tx-event commit">COMMIT</span>`, "");
        document.getElementById("snapshot-outcome").textContent = anomaly ? scenario.label.toUpperCase() : "STABLE VIEW";
        document.getElementById("snapshot-outcome").style.color = anomaly ? "var(--coral)" : "var(--green)";
        diagnosis.className = `diagnosis ${anomaly ? "warning" : "resolved"}`;
        diagnosis.innerHTML = anomaly
          ? `<span class="diagnosis-label">Observed</span><p>${scenario.anomaly} This is allowed because Read Committed gives the second SELECT a newer snapshot.</p>`
          : `<span class="diagnosis-label">Prevented</span><p>Transaction A continues to read its original snapshot. Version 2 is committed globally, but it remains invisible until A starts a new transaction.</p>`;
        button.disabled = false;
      }, 1880);
    }

    scenarioSelect.addEventListener("change", syncPreview);
    isolationSelect.addEventListener("change", syncPreview);
    button.addEventListener("click", run);
    syncPreview();
  }

  DSL.registerRenderer("mvcc-snapshots", renderMvccSnapshots);
})(window.DataSystemsLab);
