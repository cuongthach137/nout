(function registerTransactionsLesson(DSL) {
  "use strict";

  function renderTransactions() {
    const lesson = DSL.getLesson("transactions");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "Two correct transactions can produce a wrong result.", "Isolation controls what concurrent work is allowed to observe. Run the same schedule under two isolation behaviors and watch the final balance change.", "Intermediate")}
      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Lab 12 · isolation</span><h2>The lost update</h2><p class="lab-copy">Two transactions read $100, then independently add $20 and $30. Choose how the database handles the collision.</p></div><span class="lab-badge">read → write → commit</span></div>
        <div class="controls"><div class="control grow"><label for="isolation-mode">Concurrency behavior</label><select id="isolation-mode"><option value="unsafe">Allow overwrite (lost update)</option><option value="locked">Lock the row (serialized)</option></select></div><button class="button primary" id="run-transactions">Run schedule</button></div>
        <div class="balance-display"><div class="balance-card"><small>Starting balance</small><strong>$100</strong></div><div class="balance-card"><small>Final balance</small><strong id="final-balance">—</strong></div></div>
        <div class="schedule" id="schedule" aria-live="polite"></div>
        <div class="viz-caption"><span class="live-status"><i class="pulse" id="tx-pulse"></i><span id="tx-status">Ready</span></span><span>Expected: $150</span></div>
      </section>

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Production drill</span><strong>Two confirmations for the last seat</strong><span class="severity">data integrity</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Symptom → race → invariant</span><h2>An application check is not a guarantee</h2><p class="lab-copy">Two checkout requests both see seat A7 as available before either inserts. Choose where to enforce “one booking per seat,” then race the requests.</p></div><span class="lab-badge">1 seat · 2 buyers</span></div>
        <div class="controls"><div class="control grow"><label for="booking-protection">Integrity strategy</label><select id="booking-protection"><option value="check">SELECT then INSERT · app check only</option><option value="unique">UNIQUE(event_id, seat_id) · reject conflict</option><option value="lock">SELECT … FOR UPDATE · serialize</option></select></div><button class="button primary" id="race-bookings">Race both checkouts</button></div>
        <div class="seat-scene"><div class="seat" id="seat-a7"><small>Seat</small><strong>A7</strong><span id="seat-state">available</span></div><div class="race-lanes" id="booking-race" aria-live="polite"><div><small>Buyer A</small><span>waiting</span></div><div><small>Buyer B</small><span>waiting</span></div></div></div>
        <div class="metric-grid compact"><div class="metric"><span>Confirmed bookings</span><strong id="booking-count">—</strong><small>must never exceed 1</small></div><div class="metric"><span>Conflict behavior</span><strong id="booking-conflict">—</strong><small>what buyer B observes</small></div><div class="metric"><span>Invariant</span><strong id="booking-invariant">—</strong><small>one booking per seat</small></div></div>
        <div class="diagnosis" id="booking-diagnosis"><span class="diagnosis-label">Investigation</span><p>Race the requests. Timing bugs need a database-enforced outcome, not a faster pre-check.</p></div>
      </section>
      <div class="insight"><span class="insight-mark">!</span><p><strong>Isolation is a policy:</strong> engines use locks, timestamp ordering, optimistic checks, or MVCC snapshots. Each decides which interleavings are valid—and what must wait or retry.</p></div>
      ${DSL.lessonFooter("transactions")}
    </article>`;
    setupLostUpdateLab();
    setupBookingIncident();
  }

  function setupLostUpdateLab() {
    const schedules = {
      unsafe: [
        ["t1", '<span class="tx-event read">READ → $100</span>', ""],
        ["t2", "", '<span class="tx-event read">READ → $100</span>'],
        ["t3", '<span class="tx-event write">WRITE $120</span>', ""],
        ["t4", "", '<span class="tx-event write">WRITE $130</span>'],
        ["t5", '<span class="tx-event commit">COMMIT</span>', '<span class="tx-event commit">COMMIT</span>'],
      ],
      locked: [
        ["t1", '<span class="tx-event read">LOCK + READ → $100</span>', ""],
        ["t2", "", '<span class="tx-event blocked">WAIT for lock…</span>'],
        ["t3", '<span class="tx-event write">WRITE $120</span>', ""],
        ["t4", '<span class="tx-event commit">COMMIT + UNLOCK</span>', ""],
        ["t5", "", '<span class="tx-event read">READ → $120</span>'],
        ["t6", "", '<span class="tx-event write">WRITE $150</span>'],
        ["t7", "", '<span class="tx-event commit">COMMIT</span>'],
      ],
    };

    function runSchedule() {
      DSL.clearTimers();
      const mode = document.getElementById("isolation-mode").value;
      const rows = schedules[mode];
      const schedule = document.getElementById("schedule");
      schedule.innerHTML = `<div class="schedule-head">Time</div><div class="schedule-head">Transaction A · +$20</div><div class="schedule-head">Transaction B · +$30</div>`;
      document.getElementById("final-balance").textContent = "—";
      document.getElementById("tx-pulse").classList.add("active");
      document.getElementById("tx-status").textContent = "Transactions are running…";
      rows.forEach((row, index) => DSL.setTimer(() => {
        schedule.insertAdjacentHTML("beforeend", `<div class="schedule-time">${row[0]}</div><div>${row[1]}</div><div>${row[2]}</div>`);
        if (index === rows.length - 1) {
          const safe = mode === "locked";
          const balance = document.getElementById("final-balance");
          balance.textContent = safe ? "$150" : "$130";
          balance.style.color = safe ? "var(--green)" : "var(--coral)";
          document.getElementById("tx-status").textContent = safe ? "Both updates preserved" : "Transaction B overwrote A — $20 was lost";
          document.getElementById("tx-pulse").classList.remove("active");
        }
      }, index * 450));
    }

    document.getElementById("run-transactions").addEventListener("click", runSchedule);
    document.getElementById("schedule").innerHTML = `<div class="schedule-head">Time</div><div class="schedule-head">Transaction A · +$20</div><div class="schedule-head">Transaction B · +$30</div><div class="schedule-time">—</div><div>Run the schedule</div><div>to compare outcomes</div>`;
  }

  function setupBookingIncident() {
    const sequences = {
      check: {
        a: ["READ available", "INSERT booking A", "COMMIT ✓"], b: ["READ available", "INSERT booking B", "COMMIT ✓"], count: "2", conflict: "none", invariant: "BROKEN",
        detail: "Both checks were true when they ran, so both inserts committed. The race lives between SELECT and INSERT; no amount of application validation closes that gap.",
      },
      unique: {
        a: ["READ available", "INSERT booking A", "COMMIT ✓"], b: ["READ available", "INSERT booking B", "23505 conflict"], count: "1", conflict: "reject + recover", invariant: "PRESERVED",
        detail: "The unique constraint is the final authority. One insert wins; the other gets a conflict the application can translate into “seat just sold.”",
      },
      lock: {
        a: ["LOCK A7", "INSERT booking A", "COMMIT + unlock"], b: ["WAIT for A7", "READ sold", "show sold-out"], count: "1", conflict: "wait then stop", invariant: "PRESERVED",
        detail: "The row lock makes the decision serial. It preserves the invariant but adds waiting and raises deadlock/throughput considerations; keep the transaction short.",
      },
    };

    document.getElementById("race-bookings").addEventListener("click", () => {
      DSL.clearTimers();
      const mode = document.getElementById("booking-protection").value;
      const result = sequences[mode];
      const race = document.getElementById("booking-race");
      const button = document.getElementById("race-bookings");
      race.innerHTML = `<div><small>Buyer A</small><span id="buyer-a-event">request starts</span></div><div><small>Buyer B</small><span id="buyer-b-event">request starts</span></div>`;
      button.disabled = true;
      document.getElementById("seat-a7").className = "seat racing";
      document.getElementById("seat-state").textContent = "contested";
      ["booking-count", "booking-conflict", "booking-invariant"].forEach((id) => { document.getElementById(id).textContent = "…"; });
      result.a.forEach((event, index) => DSL.setTimer(() => { document.getElementById("buyer-a-event").textContent = event; }, 180 + index * 420));
      result.b.forEach((event, index) => DSL.setTimer(() => { document.getElementById("buyer-b-event").textContent = event; }, 310 + index * 420));
      DSL.setTimer(() => {
        const safe = mode !== "check";
        button.disabled = false;
        document.getElementById("seat-a7").className = `seat ${safe ? "sold" : "oversold"}`;
        document.getElementById("seat-state").textContent = safe ? "sold once" : "oversold ×2";
        document.getElementById("booking-count").textContent = result.count;
        document.getElementById("booking-conflict").textContent = result.conflict;
        document.getElementById("booking-invariant").textContent = result.invariant;
        document.getElementById("booking-invariant").style.color = safe ? "var(--green)" : "var(--coral)";
        const diagnosis = document.getElementById("booking-diagnosis");
        diagnosis.className = `diagnosis ${safe ? "resolved" : "warning"}`;
        diagnosis.innerHTML = `<span class="diagnosis-label">${safe ? "Observable fix" : "Root cause"}</span><p>${result.detail}</p>`;
      }, 1650);
    });
  }

  DSL.registerRenderer("transactions", renderTransactions);
})(window.DataSystemsLab);
