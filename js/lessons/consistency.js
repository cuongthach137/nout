(function registerConsistencyLesson(DSL) {
  "use strict";

  const SCENARIOS = Object.freeze({
    price: {
      label: "Negative product price",
      incoming: "products { id: 81, price: -9.00 }",
      invariant: "price must be greater than zero",
      mechanism: "check",
      mechanismLabel: "CHECK",
      sqlstate: "23514",
      sql: "CHECK (price > 0)",
      consequence: "A refund report interprets the product as revenue moving backwards.",
    },
    email: {
      label: "Duplicate account email",
      incoming: "users { email: 'ari@example.com' } × 2",
      invariant: "one account per normalized email",
      mechanism: "unique",
      mechanismLabel: "UNIQUE",
      sqlstate: "23505",
      sql: "UNIQUE (normalized_email)",
      consequence: "Password recovery can select the wrong account.",
    },
    orphan: {
      label: "Order references a missing product",
      incoming: "order_items { product_id: 404 }",
      invariant: "every order item references an existing product",
      mechanism: "foreign-key",
      mechanismLabel: "FOREIGN KEY",
      sqlstate: "23503",
      sql: "FOREIGN KEY (product_id) REFERENCES products(id)",
      consequence: "The order cannot be priced, displayed, or fulfilled reliably.",
    },
    overlap: {
      label: "Overlapping room reservation",
      incoming: "room 101 · 10:30–11:30 overlaps 10:00–11:00",
      invariant: "one reservation per room at any instant",
      mechanism: "exclude",
      mechanismLabel: "EXCLUDE",
      sqlstate: "23P01",
      sql: "EXCLUDE USING gist (room_id WITH =, during WITH &&)",
      consequence: "Two guests receive valid confirmations for the same room and time.",
    },
  });

  function renderConsistency() {
    const lesson = DSL.getLesson("consistency");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "Consistency starts with an <em>explicit invariant</em>.", "The database cannot preserve a business rule it has never been told. Turn assumptions into constraints so every writer—API, job, migration, or console—faces the same gate.", "Intermediate")}
      <section class="lab incident-lab">
        <div class="incident-strip"><span>Schema review</span><strong>Valid SQL produced invalid business data</strong><span class="severity">consistency</span></div>
        <div class="lab-top"><div><span class="lab-kicker">${DSL.labLabel("consistency")} · invariant workbench</span><h2>Put the rule at the write boundary</h2><p class="lab-copy">Select a data-integrity incident and an enforcement mechanism. The incoming write bypasses application validation, just like an import script or a second service might.</p></div><span class="lab-badge">state → rule → next state</span></div>
        <div class="controls">
          <div class="control grow"><label for="consistency-scenario">Incoming write</label><select id="consistency-scenario"><option value="price">Negative product price</option><option value="email">Duplicate account email</option><option value="orphan">Order references missing product</option><option value="overlap">Overlapping room reservation</option></select></div>
          <div class="control grow"><label for="consistency-mechanism">Database enforcement</label><select id="consistency-mechanism"><option value="app">Application pre-check only</option><option value="check">CHECK constraint</option><option value="unique">UNIQUE constraint</option><option value="foreign-key">FOREIGN KEY constraint</option><option value="exclude">EXCLUDE constraint</option></select></div>
          <button class="button primary" type="button" id="test-invariant">Attempt write</button>
        </div>

        <div class="constraint-pipeline" aria-live="polite">
          <div class="constraint-record"><small>Incoming row</small><strong id="incoming-record">products { id: 81, price: -9.00 }</strong></div>
          <span>→</span>
          <div class="constraint-gate" id="constraint-gate"><small>Write gate</small><strong id="constraint-name">application only</strong><span id="constraint-sql">no database rule</span></div>
          <span>→</span>
          <div class="constraint-record" id="stored-state"><small>Database result</small><strong id="stored-result">not tested</strong></div>
        </div>

        <div class="metric-grid compact"><div class="metric"><span>Write result</span><strong id="constraint-result">—</strong><small>accepted or rejected</small></div><div class="metric"><span>Error contract</span><strong id="constraint-error">—</strong><small>stable signal to the app</small></div><div class="metric"><span>Invariant</span><strong id="constraint-invariant">—</strong><small id="constraint-invariant-copy">price must be greater than zero</small></div></div>
        <div class="diagnosis" id="constraint-diagnosis"><span class="diagnosis-label">Design test</span><p>A constraint should directly express the invariant. An unrelated constraint cannot protect this write, and a pre-check is not a database guarantee.</p></div>
      </section>

      <section class="consistency-meanings">
        <div><span class="lab-kicker">ACID consistency</span><h3>Is this state valid?</h3><p>Transactions should move the database from one invariant-satisfying state to another. Constraints, isolation, and correct transaction logic work together to make that true.</p></div>
        <div><span class="lab-kicker">Distributed consistency</span><h3>Which version did this node return?</h3><p>Replica freshness and agreement are a different dimension. A perfectly valid old value can still violate a user’s read-your-writes expectation.</p><a href="#/replication">Explore eventual consistency in ${DSL.lessonRef("replication")} →</a></div>
      </section>
      <div class="insight"><span class="insight-mark">!</span><p><strong>Consistency is not one switch.</strong> Name the invariant, the scope where it must hold, and the failure behavior the application will handle.</p></div>
      ${DSL.lessonFooter("consistency")}
    </article>`;
    setupConsistencyLab();
  }

  function setupConsistencyLab() {
    const scenarioSelect = document.getElementById("consistency-scenario");
    const mechanismSelect = document.getElementById("consistency-mechanism");
    const button = document.getElementById("test-invariant");

    function preview() {
      const scenario = SCENARIOS[scenarioSelect.value];
      const mechanism = mechanismSelect.value;
      const selectedLabel = mechanismSelect.options[mechanismSelect.selectedIndex].text;
      document.getElementById("incoming-record").textContent = scenario.incoming;
      document.getElementById("constraint-name").textContent = selectedLabel;
      document.getElementById("constraint-sql").textContent = mechanism === scenario.mechanism ? scenario.sql : mechanism === "app" ? "no database rule" : "does not express this invariant";
      document.getElementById("constraint-invariant-copy").textContent = scenario.invariant;
      document.getElementById("stored-state").className = "constraint-record";
      document.getElementById("stored-result").textContent = "not tested";
      document.getElementById("constraint-result").textContent = "—";
      document.getElementById("constraint-error").textContent = "—";
      document.getElementById("constraint-invariant").textContent = "—";
    }

    button.addEventListener("click", () => {
      DSL.clearTimers();
      const scenario = SCENARIOS[scenarioSelect.value];
      const mechanism = mechanismSelect.value;
      const protectedWrite = mechanism === scenario.mechanism;
      const gate = document.getElementById("constraint-gate");
      const result = document.getElementById("stored-state");
      const diagnosis = document.getElementById("constraint-diagnosis");
      button.disabled = true;
      gate.className = "constraint-gate checking";
      result.className = "constraint-record";
      document.getElementById("stored-result").textContent = "validating…";
      document.getElementById("constraint-result").textContent = "…";
      document.getElementById("constraint-error").textContent = "…";
      document.getElementById("constraint-invariant").textContent = "…";
      diagnosis.className = "diagnosis investigating";
      diagnosis.innerHTML = `<span class="diagnosis-label">Constraint check</span><p>The storage engine evaluates the declared rule before this state can commit.</p>`;

      DSL.setTimer(() => {
        gate.className = `constraint-gate ${protectedWrite ? "rejected" : "passed"}`;
        result.className = `constraint-record ${protectedWrite ? "rejected" : "invalid"}`;
        document.getElementById("stored-result").textContent = protectedWrite ? "row not stored" : "invalid row stored";
        document.getElementById("constraint-result").textContent = protectedWrite ? "REJECTED" : "ACCEPTED";
        document.getElementById("constraint-result").style.color = protectedWrite ? "var(--green)" : "var(--coral)";
        document.getElementById("constraint-error").textContent = protectedWrite ? `${scenario.sqlstate} · ${scenario.mechanismLabel}` : "none";
        document.getElementById("constraint-invariant").textContent = protectedWrite ? "PRESERVED" : "BROKEN";
        document.getElementById("constraint-invariant").style.color = protectedWrite ? "var(--green)" : "var(--coral)";
        diagnosis.className = `diagnosis ${protectedWrite ? "resolved" : "warning"}`;
        diagnosis.innerHTML = protectedWrite
          ? `<span class="diagnosis-label">Database guarantee</span><p>${scenario.mechanismLabel} directly represents “${scenario.invariant}.” Every database client gets the same rejection and the application can handle SQLSTATE ${scenario.sqlstate}.</p>`
          : `<span class="diagnosis-label">Invariant escaped</span><p>${mechanism === "app" ? "This writer bypassed the application pre-check." : "The selected constraint protects a different rule."} ${scenario.consequence}</p>`;
        button.disabled = false;
      }, 720);
    });

    scenarioSelect.addEventListener("change", preview);
    mechanismSelect.addEventListener("change", preview);
    preview();
  }

  DSL.registerRenderer("consistency", renderConsistency);
})(window.DataSystemsLab);
