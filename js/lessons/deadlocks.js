(function registerDeadlocksLesson(DSL) {
  "use strict";

  function renderDeadlocks() {
    const lesson = DSL.getLesson("deadlocks");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "Waiting is normal. A cycle is a <em>deadlock.</em>", "Locks protect concurrent changes, but two transactions can each hold what the other needs. PostgreSQL detects the cycle, aborts one participant, and expects the application to handle that outcome.", "Intermediate")}

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Production drill</span><strong>Transfers occasionally fail with SQLSTATE 40P01</strong><span class="severity">concurrency</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Lab 26 · wait-for graph</span><h2>Run two valid transfers at the same time</h2><p class="lab-copy">Transaction A moves $10 from account 1 to 2; transaction B moves $20 in the opposite direction. Change only their lock order and watch a wait become—or avoid—a cycle.</p></div><span class="lab-badge">2 rows · 2 transactions</span></div>
        <div class="controls"><div class="control grow"><label for="lock-order">Row lock order</label><select id="lock-order"><option value="opposite">Business order · opposite</option><option value="consistent">Account ID order · consistent</option></select></div><div class="control"><label for="deadlock-retry">On deadlock</label><select id="deadlock-retry"><option value="none">Return error</option><option value="retry">Retry whole transaction</option></select></div><button class="button primary" id="run-deadlock">Run schedule</button></div>

        <div class="deadlock-scene" aria-live="polite">
          <div class="transaction-lanes"><div class="transaction-lane" id="deadlock-t1"><small>Transaction A · 1 → 2</small><strong id="deadlock-t1-state">ready</strong></div><div class="transaction-lane" id="deadlock-t2"><small>Transaction B · 2 → 1</small><strong id="deadlock-t2-state">ready</strong></div></div>
          <div class="lock-resources"><div class="lock-resource" id="lock-account-1"><small>row lock</small><strong>account 1</strong><span id="account-1-owner">free</span></div><div class="lock-resource" id="lock-account-2"><small>row lock</small><strong>account 2</strong><span id="account-2-owner">free</span></div></div>
          <div class="wait-graph" id="wait-graph"><small>wait-for graph</small><div><span class="wait-node">Tx A</span><i id="wait-a-b">→</i><span class="wait-node">Tx B</span><i id="wait-b-a">→</i><span class="wait-node ghost">Tx A</span></div><strong id="cycle-state">no cycle</strong></div>
        </div>

        <ol class="lock-event-log" id="deadlock-log"><li>Ready to execute both transfers.</li></ol>
        <div class="metric-grid compact"><div class="metric"><span>Transactions aborted</span><strong id="deadlock-aborts">—</strong><small>deadlock victims</small></div><div class="metric"><span>Whole retries</span><strong id="deadlock-retries">—</strong><small>application responsibility</small></div><div class="metric"><span>Final total</span><strong id="deadlock-total">$200</strong><small>must remain invariant</small></div></div>
        <div class="balance-display"><div class="balance-card"><small>Account 1</small><strong id="deadlock-balance-1">$100</strong></div><div class="balance-card"><small>Account 2</small><strong id="deadlock-balance-2">$100</strong></div></div>
        <div class="diagnosis" id="deadlock-diagnosis"><span class="diagnosis-label">Investigation</span><p>Run the schedule. An ordinary wait has a path forward; a deadlock cycle does not.</p></div>
      </section>

      <section class="concept-grid">
        <article class="concept-card"><span class="concept-number">01 · Detect</span><h3>Find the cycle</h3><p>“Blocked” alone is not a deadlock. The decisive evidence is a cycle in which every participant waits for a lock held by the next.</p></article>
        <article class="concept-card"><span class="concept-number">02 · Prevent</span><h3>Acquire in one order</h3><p>If every transfer locks the smaller account ID first, one transaction may wait, but the dependency graph cannot close this two-row cycle.</p></article>
        <article class="concept-card"><span class="concept-number">03 · Recover</span><h3>Retry the transaction</h3><p>The database aborts a victim to break the cycle. Retry the entire idempotent transaction with bounded backoff—not only its final statement.</p></article>
      </section>

      ${DSL.EngineLens.render({ id: "locking-engine-lens", title: "The thing being locked is not always “the row”", copy: "The portable wait-for graph still applies, but PostgreSQL tuple/table locks, InnoDB index-record and gap locks, and SQLite file/WAL writer serialization create very different contention footprints." })}
      <div class="insight"><span class="insight-mark">!</span><p><strong>Keep transactions short and ordering explicit.</strong> Consistent acquisition prevents many deadlocks; short scopes reduce how long everyone else waits. Still treat deadlock errors as a normal concurrency outcome that can happen under rare plans and code paths.</p></div>
      ${DSL.lessonFooter("deadlocks")}
    </article>`;
    setupDeadlockLab();
    DSL.EngineLens.mount("locking-engine-lens", lockingEngineConfig());
  }

  function lockingEngineConfig() {
    return { engines: [
      {
        id: "postgres", label: "PostgreSQL", version: "PostgreSQL 18", mechanism: "Tuple/table locks + wait-for deadlock detection", signature: "pg_locks + pg_blocking_pids(); victim gets 40P01",
        diagram: [{ kicker: "Tx A", label: "lock row 1", detail: "granted" }, { kicker: "Tx B", label: "lock row 2", detail: "granted" }, { kicker: "cross request", label: "A ↔ B", detail: "cycle" }, { kicker: "detector", label: "abort victim", detail: "40P01" }],
        steps: [{ title: "Acquire tuple locks", copy: "UPDATE or SELECT FOR UPDATE locks matching tuple versions while both transactions keep their table-level intent locks." }, { title: "Queue incompatible requests", copy: "A request waits behind a conflicting holder rather than reading a half-written value." }, { title: "Form a wait-for cycle", copy: "Opposite acquisition order can make A wait for B while B waits for A." }, { title: "Abort one transaction", copy: "After deadlock_timeout, the detector chooses a victim; the surviving transaction can proceed and the application may retry the aborted unit." }],
        counters: [{ label: "Deadlock error", value: "40P01", note: "retryable class" }, { label: "Blocker view", value: "pg_locks", note: "plus activity" }, { label: "SSI read lock", value: "nonblocking", note: "different mechanism" }],
        incident: { title: "A code path changed lock order after a new index", copy: "The query now reaches accounts in a different order. Explicitly sort and lock identifiers rather than depending on a planner's scan order.", evidence: "SELECT pg_blocking_pids(pid), query\nFROM pg_stat_activity\nWHERE wait_event_type = 'Lock';\n-- server log: deadlock detected" },
        challenge: { prompt: "Can an SIReadLock shown by pg_locks be the blocking edge in this row-lock deadlock?", options: ["Yes, always", "No; SSI predicate locks do not block", "Only for SELECT"], answer: 1, why: "PostgreSQL SSI predicate locks track dependencies for serialization detection; they are distinct from blocking row/table locks." },
        source: { label: "explicit-locking documentation", url: "https://www.postgresql.org/docs/18/explicit-locking.html" },
      },
      {
        id: "mysql", label: "MySQL / InnoDB", version: "MySQL 8.4 · InnoDB", mechanism: "Index-record, gap, and next-key locks", signature: "next-key = record + preceding gap; victim gets 1213",
        diagram: [{ kicker: "index", label: "keys 10, 13, 20", detail: "ordered records" }, { kicker: "range scan", label: "(10, 13]", detail: "next-key lock" }, { kicker: "insert", label: "key 12 waits", detail: "gap protected" }, { kicker: "cycle", label: "abort victim", detail: "ERROR 1213" }],
        steps: [{ title: "Search an index", copy: "InnoDB row locks are locks on index records encountered by the access path." }, { title: "Protect the adjacent gap", copy: "At default Repeatable Read, range searches commonly use next-key locks: the record plus the gap before it." }, { title: "Block a phantom insert", copy: "An insert into a protected interval waits even though no existing row has that exact key." }, { title: "Detect cycles", copy: "If waits form a cycle, InnoDB rolls back a victim; performance_schema.data_locks and data_lock_waits expose the edges." }],
        counters: [{ label: "Range lock", value: "next-key", note: "record + gap" }, { label: "Deadlock error", value: "1213", note: "SQLSTATE 40001" }, { label: "Evidence", value: "data_locks", note: "granted/waiting" }],
        incident: { title: "INSERT waits on a row that does not exist", copy: "A locking range scan protects an index gap to prevent phantoms. The missing key is precisely why the gap—not a row—is the contested resource.", evidence: "LOCK_MODE: X,GAP\nLOCK_STATUS: WAITING\nINDEX_NAME: idx_price\nLOCK_DATA: 20" },
        challenge: { prompt: "A next-key lock on index record 20 protects which area?", options: ["Only the row containing 20", "The record and gap immediately before it", "Every table page"], answer: 1, why: "A next-key lock combines the index-record lock with a gap lock on the interval preceding that record." },
        source: { label: "InnoDB locking documentation", url: "https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html" },
      },
      {
        id: "sqlite", label: "SQLite", version: "SQLite 3.x · WAL mode", mechanism: "Many readers, one serialized writer", signature: "contention usually surfaces as SQLITE_BUSY, not row-lock cycles",
        diagram: [{ kicker: "readers", label: "R1 · R2 · R3", detail: "snapshot end marks" }, { kicker: "writer", label: "W1 appends WAL", detail: "owns write slot" }, { kicker: "second writer", label: "W2 waits/fails", detail: "busy handler" }, { kicker: "commit", label: "writer releases", detail: "next writer" }],
        steps: [{ title: "Let readers overlap", copy: "WAL readers use stable end marks and do not block the active writer." }, { title: "Serialize the writer", copy: "Only one connection may append a write transaction to the WAL at a time." }, { title: "Handle competing writes", copy: "A second writer invokes the busy handler or returns SQLITE_BUSY when it cannot acquire the write lock in time." }, { title: "Keep the transaction short", copy: "Network calls or user interaction inside a write transaction hold the single-writer slot for the whole application." }],
        counters: [{ label: "Simultaneous readers", value: "many", note: "WAL snapshots" }, { label: "Simultaneous writers", value: "1", note: "serialized" }, { label: "Common symptom", value: "SQLITE_BUSY", note: "bounded retry" }],
        incident: { title: "A five-second HTTP call happens after BEGIN IMMEDIATE", copy: "The connection owns the write slot while waiting on the network. Every other writer sees busy errors even though the SQL statements themselves are fast.", evidence: "BEGIN IMMEDIATE;\nUPDATE jobs SET state='sending';\n-- remote HTTP call: 5.2s\nCOMMIT;" },
        challenge: { prompt: "What most directly improves SQLite write concurrency in this incident?", options: ["Add row-level indexes", "Move remote work outside the write transaction", "Increase reader count"], answer: 1, why: "SQLite serializes writers, so shortening the write transaction releases the scarce writer slot sooner." },
        source: { label: "WAL concurrency documentation", url: "https://www.sqlite.org/wal.html" },
      },
    ] };
  }

  function buildSchedule(order, retry) {
    if (order === "consistent") {
      return [
        { message: "Tx A locks account 1.", t1: "holds account 1", t2: "running", a1: "Tx A", a2: "free" },
        { message: "Tx B requests account 1 and waits.", t1: "holds account 1", t2: "waiting for account 1", a1: "Tx A", a2: "free", waitBA: true },
        { message: "Tx A locks account 2 and applies its transfer.", t1: "holds accounts 1 + 2", t2: "waiting for account 1", a1: "Tx A", a2: "Tx A", waitBA: true },
        { message: "Tx A commits; Tx B can acquire account 1.", t1: "committed", t2: "holds account 1", a1: "Tx B", a2: "free" },
        { message: "Tx B locks account 2, applies its transfer, and commits.", t1: "committed", t2: "committed", a1: "free", a2: "free", final: true },
      ];
    }

    const schedule = [
      { message: "Tx A locks account 1.", t1: "holds account 1", t2: "running", a1: "Tx A", a2: "free" },
      { message: "Tx B locks account 2.", t1: "holds account 1", t2: "holds account 2", a1: "Tx A", a2: "Tx B" },
      { message: "Tx A requests account 2 and waits for Tx B.", t1: "waiting for account 2", t2: "holds account 2", a1: "Tx A", a2: "Tx B", waitAB: true },
      { message: "Tx B requests account 1. The wait-for graph now has a cycle.", t1: "waiting for account 2", t2: "waiting for account 1", a1: "Tx A", a2: "Tx B", waitAB: true, waitBA: true, cycle: true },
      { message: "PostgreSQL aborts Tx B; Tx A acquires account 2 and commits.", t1: "committed", t2: "aborted · 40P01", a1: "free", a2: "free", victim: true },
    ];
    if (retry) {
      schedule.push(
        { message: "The application backs off and restarts all of Tx B.", t1: "committed", t2: "retrying", a1: "free", a2: "free", victim: true },
        { message: "Retried Tx B obtains both rows and commits.", t1: "committed", t2: "committed on retry", a1: "free", a2: "free", victim: true, final: true },
      );
    } else {
      schedule[schedule.length - 1].final = true;
    }
    return schedule;
  }

  function setupDeadlockLab() {
    document.getElementById("run-deadlock").addEventListener("click", () => {
      DSL.clearTimers();
      const button = document.getElementById("run-deadlock");
      const order = document.getElementById("lock-order").value;
      const retry = document.getElementById("deadlock-retry").value === "retry";
      const schedule = buildSchedule(order, retry);
      const log = document.getElementById("deadlock-log");
      button.disabled = true;
      log.innerHTML = "";
      document.getElementById("deadlock-aborts").textContent = "…";
      document.getElementById("deadlock-retries").textContent = "…";
      document.getElementById("deadlock-balance-1").textContent = "$100";
      document.getElementById("deadlock-balance-2").textContent = "$100";

      schedule.forEach((step, index) => DSL.setTimer(() => {
        document.getElementById("deadlock-t1-state").textContent = step.t1;
        document.getElementById("deadlock-t2-state").textContent = step.t2;
        document.getElementById("account-1-owner").textContent = step.a1;
        document.getElementById("account-2-owner").textContent = step.a2;
        document.getElementById("lock-account-1").classList.toggle("held", step.a1 !== "free");
        document.getElementById("lock-account-2").classList.toggle("held", step.a2 !== "free");
        document.getElementById("deadlock-t1").classList.toggle("waiting", step.t1.includes("waiting"));
        document.getElementById("deadlock-t2").classList.toggle("waiting", step.t2.includes("waiting"));
        document.getElementById("deadlock-t2").classList.toggle("aborted", step.t2.includes("aborted"));
        document.getElementById("wait-a-b").classList.toggle("active", Boolean(step.waitAB));
        document.getElementById("wait-b-a").classList.toggle("active", Boolean(step.waitBA));
        document.getElementById("wait-graph").classList.toggle("cycle", Boolean(step.cycle));
        document.getElementById("cycle-state").textContent = step.cycle ? "cycle detected" : "no cycle";
        log.insertAdjacentHTML("beforeend", `<li>${step.message}</li>`);
        log.scrollTop = log.scrollHeight;

        if (!step.final) return;
        const deadlocked = order === "opposite";
        const bothCommitted = !deadlocked || retry;
        document.getElementById("deadlock-aborts").textContent = deadlocked ? "1" : "0";
        document.getElementById("deadlock-retries").textContent = deadlocked && retry ? "1" : "0";
        document.getElementById("deadlock-balance-1").textContent = bothCommitted ? "$110" : "$90";
        document.getElementById("deadlock-balance-2").textContent = bothCommitted ? "$90" : "$110";
        button.disabled = false;
        const diagnosis = document.getElementById("deadlock-diagnosis");
        diagnosis.className = `diagnosis ${deadlocked ? "warning" : "resolved"}`;
        if (!deadlocked) {
          diagnosis.innerHTML = `<span class="diagnosis-label">Cycle prevented</span><p>Both transactions requested account 1 before account 2. Tx B waited, but Tx A could finish and release the path forward. The final balances include both transfers.</p>`;
        } else if (retry) {
          diagnosis.innerHTML = `<span class="diagnosis-label">Recovered, not prevented</span><p>The opposite ordering created a cycle and one abort. A whole-transaction retry recovered the business operation, but consistent lock order would avoid the wasted work and error path.</p>`;
        } else {
          diagnosis.innerHTML = `<span class="diagnosis-label">Deadlock surfaced</span><p>The database preserved consistency by aborting Tx B. Without application retry, only Tx A's transfer completed. Handle SQLSTATE 40P01 and make the operation idempotent.</p>`;
        }
      }, 250 + index * 560));
    });
  }

  DSL.registerRenderer("deadlocks", renderDeadlocks);
})(window.DataSystemsLab);
