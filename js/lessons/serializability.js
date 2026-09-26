(function registerSerializabilityLesson(DSL) {
  "use strict";

  function renderSerializability() {
    const lesson = DSL.getLesson("serializability");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "A stable snapshot can still produce an <em>impossible outcome</em>.", "Repeatable Read prevents values from changing underneath a transaction, but two transactions can make compatible-looking decisions that are invalid together. Serializable detects those dependency cycles.", "Advanced")}
      <section class="lab incident-lab">
        <div class="incident-strip"><span>Production drill</span><strong>Both doctors go off call</strong><span class="severity">write skew</span></div>
        <div class="lab-top"><div><span class="lab-kicker">${DSL.labLabel("serializability")} · serialization anomaly</span><h2>Preserve a cross-row invariant</h2><p class="lab-copy">Ava and Bo each check that two doctors are on call, then update only their own row. The rule is “at least one doctor must remain on call.”</p></div><span class="lab-badge">two readers · two writers</span></div>
        <div class="controls">
          <div class="control grow"><label for="serial-isolation">Isolation level</label><select id="serial-isolation"><option value="repeatable">REPEATABLE READ</option><option value="serializable">SERIALIZABLE</option></select></div>
          <div class="control grow"><label for="serial-retry">Application behavior on SQLSTATE 40001</label><select id="serial-retry"><option value="retry">Retry the complete transaction</option><option value="surface">Return an error without retry</option></select></div>
          <button class="button primary" type="button" id="run-write-skew">Run both requests</button>
        </div>

        <div class="write-skew-scene" aria-live="polite">
          <div class="doctor-card on" id="doctor-ava"><small>row · doctor Ava</small><strong>Ava</strong><span id="ava-state">ON CALL</span></div>
          <div class="invariant-gauge"><small>Business invariant</small><strong id="on-call-count">2 on call</strong><span>minimum required: 1</span></div>
          <div class="doctor-card on" id="doctor-bo"><small>row · doctor Bo</small><strong>Bo</strong><span id="bo-state">ON CALL</span></div>
        </div>

        <div class="conflict-graph" id="conflict-graph" aria-label="Read-write dependency graph">
          <div class="conflict-node" id="conflict-a"><small>Transaction A</small><strong>reads Bo</strong><span>writes Ava</span></div>
          <span class="conflict-edge" id="edge-a-b">A depends on B →</span>
          <div class="conflict-node" id="conflict-b"><small>Transaction B</small><strong>reads Ava</strong><span>writes Bo</span></div>
          <span class="conflict-edge reverse" id="edge-b-a">← B depends on A</span>
        </div>

        <div class="schedule" id="serial-schedule"><div class="schedule-head">Time</div><div class="schedule-head">Transaction A · Ava</div><div class="schedule-head">Transaction B · Bo</div><div class="schedule-time">—</div><div>Both start from</div><div>the same snapshot</div></div>
        <div class="metric-grid compact"><div class="metric"><span>Committed requests</span><strong id="serial-commits">—</strong><small>after any retry</small></div><div class="metric"><span>Serialization failures</span><strong id="serial-failures">—</strong><small>SQLSTATE 40001</small></div><div class="metric"><span>Invariant</span><strong id="serial-invariant">—</strong><small>at least one on call</small></div></div>
        <div class="diagnosis" id="serial-diagnosis"><span class="diagnosis-label">Why it matters</span><p>Neither transaction writes the row the other writes, so simple row-conflict detection does not catch the business-level dependency.</p></div>
      </section>

      <section class="concept-grid">
        <div class="concept-card"><span class="concept-number">repeatable read</span><h3>Same snapshot</h3><p>Both requests can honestly see two doctors and commit changes to different rows, leaving zero.</p></div>
        <div class="concept-card"><span class="concept-number">serializable</span><h3>Equivalent to some serial order</h3><p>PostgreSQL runs work concurrently but rejects a dangerous dependency structure when it cannot prove a valid order.</p></div>
        <div class="concept-card"><span class="concept-number">retry contract</span><h3>Start over completely</h3><p>Retry all decision logic, not only the failed SQL statement, because the next snapshot may change the decision.</p></div>
      </section>
      <div class="query-box"><code>BEGIN ISOLATION LEVEL SERIALIZABLE;  SELECT count(*) …;  UPDATE doctors …;  COMMIT;  -- retry the whole block on 40001</code></div>
      ${DSL.lessonFooter("serializability")}
    </article>`;
    setupWriteSkewLab();
  }

  function setupWriteSkewLab() {
    const button = document.getElementById("run-write-skew");
    const schedule = document.getElementById("serial-schedule");

    function addRow(time, a, b) {
      schedule.insertAdjacentHTML("beforeend", `<div class="schedule-time">${time}</div><div>${a}</div><div>${b}</div>`);
    }

    function setDoctor(id, onCall) {
      const card = document.getElementById(`doctor-${id}`);
      card.className = `doctor-card ${onCall ? "on" : "off"}`;
      document.getElementById(`${id}-state`).textContent = onCall ? "ON CALL" : "OFF CALL";
    }

    button.addEventListener("click", () => {
      DSL.clearTimers();
      const serializable = document.getElementById("serial-isolation").value === "serializable";
      const retry = document.getElementById("serial-retry").value === "retry";
      const diagnosis = document.getElementById("serial-diagnosis");
      button.disabled = true;
      setDoctor("ava", true);
      setDoctor("bo", true);
      document.getElementById("on-call-count").textContent = "2 on call";
      document.getElementById("serial-commits").textContent = "…";
      document.getElementById("serial-failures").textContent = "…";
      document.getElementById("serial-invariant").textContent = "CHECKING";
      schedule.innerHTML = `<div class="schedule-head">Time</div><div class="schedule-head">Transaction A · Ava</div><div class="schedule-head">Transaction B · Bo</div>`;
      document.getElementById("conflict-graph").className = "conflict-graph active";
      diagnosis.className = "diagnosis investigating";
      diagnosis.innerHTML = `<span class="diagnosis-label">Concurrent reads</span><p>Both transactions take a snapshot with Ava and Bo on call. Each concludes that its own doctor may safely leave.</p>`;

      DSL.setTimer(() => addRow("t1", '<span class="tx-event read">COUNT on_call → 2</span>', '<span class="tx-event read">COUNT on_call → 2</span>'), 260);
      DSL.setTimer(() => {
        addRow("t2", '<span class="tx-event write">Ava → off</span>', '<span class="tx-event write">Bo → off</span>');
        setDoctor("ava", false);
        setDoctor("bo", false);
        document.getElementById("on-call-count").textContent = "0 staged";
      }, 720);
      DSL.setTimer(() => {
        if (!serializable) {
          addRow("t3", '<span class="tx-event commit">COMMIT ✓</span>', '<span class="tx-event commit">COMMIT ✓</span>');
          document.getElementById("on-call-count").textContent = "0 on call";
          document.getElementById("serial-commits").textContent = "2";
          document.getElementById("serial-failures").textContent = "0";
          document.getElementById("serial-invariant").textContent = "BROKEN";
          document.getElementById("serial-invariant").style.color = "var(--coral)";
          diagnosis.className = "diagnosis warning";
          diagnosis.innerHTML = `<span class="diagnosis-label">Write skew</span><p>Both snapshots were internally stable, yet the combined committed state cannot result from either serial order. Repeatable Read permits this serialization anomaly.</p>`;
          document.getElementById("conflict-graph").className = "conflict-graph dangerous";
          button.disabled = false;
          return;
        }

        addRow("t3", '<span class="tx-event commit">COMMIT ✓</span>', '<span class="tx-event blocked">ROLLBACK · 40001</span>');
        setDoctor("bo", true);
        document.getElementById("on-call-count").textContent = "1 on call";
        document.getElementById("serial-failures").textContent = "1";
        document.getElementById("serial-invariant").textContent = "PRESERVED";
        document.getElementById("serial-invariant").style.color = "var(--green)";
        document.getElementById("conflict-graph").className = "conflict-graph detected";
      }, 1190);

      DSL.setTimer(() => {
        if (!serializable) return;
        if (retry) {
          addRow("retry", "", '<span class="tx-event read">COUNT → 1; stay on call</span>');
          document.getElementById("serial-commits").textContent = "2 after retry";
          diagnosis.className = "diagnosis resolved";
          diagnosis.innerHTML = `<span class="diagnosis-label">Safe retry</span><p>The engine chose transaction B as the victim. Its complete retry sees only Ava off call, changes its decision, and keeps Bo on call.</p>`;
        } else {
          document.getElementById("serial-commits").textContent = "1";
          diagnosis.className = "diagnosis resolved";
          diagnosis.innerHTML = `<span class="diagnosis-label">Safe database state</span><p>The invariant survived, but Bo’s request failed with SQLSTATE 40001. Production code must retry or return a deliberate transient error.</p>`;
        }
        button.disabled = false;
      }, 1650);
    });
  }

  DSL.registerRenderer("serializability", renderSerializability);
})(window.DataSystemsLab);
