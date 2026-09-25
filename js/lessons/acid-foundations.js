(function registerAcidFoundationsLesson(DSL) {
  "use strict";

  const STARTING_STATE = Object.freeze({ alice: 500, bob: 200, receipts: 0 });

  function renderAcidFoundations() {
    const lesson = DSL.getLesson("acid-foundations");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "A transaction is a <em>promise about outcomes</em>.", "A feature can execute several valid SQL statements and still leave invalid data when one step fails. Put the whole business action inside one atomic boundary and observe what becomes visible.", "Foundational")}

      <section class="concept-grid acid-principles" aria-label="The four ACID properties">
        <div class="concept-card"><span class="concept-number">A · atomicity</span><h3>All of it, or none</h3><p>A partial transfer must never become the durable result.</p></div>
        <div class="concept-card"><span class="concept-number">C · consistency</span><h3>Invariants still hold</h3><p>Every committed state must satisfy the rules your system depends on.</p></div>
        <div class="concept-card"><span class="concept-number">I · isolation</span><h3>Concurrency is controlled</h3><p>Overlapping work must behave according to a chosen isolation contract.</p></div>
        <div class="concept-card"><span class="concept-number">D · durability</span><h3>Acknowledged means retained</h3><p>A committed result survives the failures covered by the durability contract.</p></div>
      </section>

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Production drill</span><strong>Payment failed after the debit succeeded</strong><span class="severity">atomicity</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Lab 13 · transfer boundary</span><h2>Crash between two correct updates</h2><p class="lab-copy">Move $100 from Alice to Bob and write an audit receipt. Inject a failure, then compare statement autocommit with one explicit transaction.</p></div><span class="lab-badge">$500 + $200 = $700</span></div>
        <div class="controls">
          <div class="control grow"><label for="atomic-mode">Execution boundary</label><select id="atomic-mode"><option value="autocommit">Each statement autocommits</option><option value="transaction">One BEGIN … COMMIT transaction</option></select></div>
          <div class="control grow"><label for="atomic-failure">Injected failure</label><select id="atomic-failure"><option value="credit">Credit statement errors</option><option value="receipt">Receipt insert errors</option><option value="none">No failure</option></select></div>
          <button class="button primary" type="button" id="run-atomic-transfer">Run transfer</button>
        </div>

        <div class="atomic-scene" aria-live="polite">
          <div class="account-node"><small>accounts · Alice</small><strong id="atomic-alice">$500</strong><span id="alice-visibility">committed</span></div>
          <span class="atomic-arrow">− $100 →</span>
          <div class="transaction-envelope" id="transaction-envelope"><small id="atomic-boundary-label">no shared boundary</small><strong id="atomic-step">Ready</strong><span id="atomic-workspace">Each statement publishes independently</span></div>
          <span class="atomic-arrow">→ + $100</span>
          <div class="account-node"><small>accounts · Bob</small><strong id="atomic-bob">$200</strong><span id="bob-visibility">committed</span></div>
        </div>

        <div class="transaction-log" id="atomic-log" aria-label="Transaction event log"><div><span>—</span><strong>Choose a failure point and run the transfer.</strong></div></div>
        <div class="metric-grid compact"><div class="metric"><span>Account total</span><strong id="atomic-total">$700</strong><small>must remain $700</small></div><div class="metric"><span>Audit receipts</span><strong id="atomic-receipts">0</strong><small>must match completed transfers</small></div><div class="metric"><span>Final outcome</span><strong id="atomic-outcome">READY</strong><small>externally visible state</small></div></div>
        <div class="diagnosis" id="atomic-diagnosis"><span class="diagnosis-label">What to watch</span><p>Atomicity protects a business action only when every required database change shares the same transaction boundary.</p></div>
      </section>

      <div class="query-box"><code>BEGIN;  UPDATE accounts … Alice;  UPDATE accounts … Bob;  INSERT INTO transfer_receipts …;  COMMIT;</code></div>
      <div class="insight"><span class="insight-mark">!</span><p><strong>Transaction boundaries belong to the use case.</strong> A repository method that opens and commits its own transaction can make a multi-step service operation impossible to roll back as one unit.</p></div>
      ${DSL.lessonFooter("acid-foundations")}
    </article>`;
    setupAtomicityLab();
  }

  function setupAtomicityLab() {
    const log = document.getElementById("atomic-log");
    const button = document.getElementById("run-atomic-transfer");

    function renderState(state, outcome, safe) {
      document.getElementById("atomic-alice").textContent = `$${state.alice}`;
      document.getElementById("atomic-bob").textContent = `$${state.bob}`;
      document.getElementById("atomic-total").textContent = `$${state.alice + state.bob}`;
      document.getElementById("atomic-receipts").textContent = String(state.receipts);
      document.getElementById("atomic-outcome").textContent = outcome;
      document.getElementById("atomic-outcome").style.color = safe ? "var(--green)" : "var(--coral)";
    }

    function appendEvent(time, event, kind = "") {
      log.insertAdjacentHTML("beforeend", `<div class="${kind}"><span>${time}</span><strong>${event}</strong></div>`);
    }

    button.addEventListener("click", () => {
      DSL.clearTimers();
      const mode = document.getElementById("atomic-mode").value;
      const failure = document.getElementById("atomic-failure").value;
      const transactional = mode === "transaction";
      const visible = { ...STARTING_STATE };
      const staged = { ...STARTING_STATE };
      const envelope = document.getElementById("transaction-envelope");
      const diagnosis = document.getElementById("atomic-diagnosis");
      button.disabled = true;
      log.innerHTML = "";
      envelope.className = `transaction-envelope ${transactional ? "active" : "open"}`;
      document.getElementById("atomic-boundary-label").textContent = transactional ? "private transaction workspace" : "statement-level commits";
      document.getElementById("atomic-workspace").textContent = transactional ? "Changes stay private until COMMIT" : "Each success is immediately visible";
      document.getElementById("atomic-step").textContent = transactional ? "BEGIN" : "autocommit on";
      document.getElementById("alice-visibility").textContent = "committed";
      document.getElementById("bob-visibility").textContent = "committed";
      renderState(visible, "RUNNING", true);
      diagnosis.className = "diagnosis investigating";
      diagnosis.innerHTML = `<span class="diagnosis-label">Executing</span><p>${transactional ? "One unit of work has started; no intermediate balance is visible outside it." : "Each statement is its own unit of work, so later failure cannot undo earlier commits."}</p>`;
      appendEvent("t0", transactional ? "BEGIN — open one transaction" : "autocommit — no shared transaction");

      DSL.setTimer(() => {
        staged.alice -= 100;
        if (!transactional) visible.alice = staged.alice;
        document.getElementById("atomic-step").textContent = "debit Alice −$100";
        document.getElementById("alice-visibility").textContent = transactional ? "staged: $400" : "committed: $400";
        renderState(visible, "RUNNING", true);
        appendEvent("t1", `Debit Alice ${transactional ? "staged" : "committed"}`, transactional ? "pending" : "committed");
      }, 320);

      DSL.setTimer(() => {
        if (failure === "credit") {
          finishFailure("Credit Bob failed", visible, staged, transactional, diagnosis, envelope, button);
          return;
        }
        staged.bob += 100;
        if (!transactional) visible.bob = staged.bob;
        document.getElementById("atomic-step").textContent = "credit Bob +$100";
        document.getElementById("bob-visibility").textContent = transactional ? "staged: $300" : "committed: $300";
        renderState(visible, "RUNNING", true);
        appendEvent("t2", `Credit Bob ${transactional ? "staged" : "committed"}`, transactional ? "pending" : "committed");
      }, 760);

      DSL.setTimer(() => {
        if (failure === "credit") return;
        if (failure === "receipt") {
          finishFailure("Receipt insert failed", visible, staged, transactional, diagnosis, envelope, button);
          return;
        }
        staged.receipts = 1;
        if (!transactional) visible.receipts = 1;
        appendEvent("t3", `Receipt ${transactional ? "staged" : "committed"}`, transactional ? "pending" : "committed");
        document.getElementById("atomic-step").textContent = "write audit receipt";
      }, 1200);

      DSL.setTimer(() => {
        if (failure !== "none") return;
        Object.assign(visible, staged);
        envelope.className = "transaction-envelope committed";
        document.getElementById("atomic-step").textContent = transactional ? "COMMIT" : "all statements done";
        document.getElementById("alice-visibility").textContent = "committed";
        document.getElementById("bob-visibility").textContent = "committed";
        appendEvent("t4", transactional ? "COMMIT — publish all changes together" : "Workflow completed", "committed");
        renderState(visible, "COMMITTED", true);
        diagnosis.className = "diagnosis resolved";
        diagnosis.innerHTML = `<span class="diagnosis-label">Valid state</span><p>Both balances and the receipt agree. ${transactional ? "Other sessions observe the complete transfer at once." : "This run happened to finish, but partial commits remain possible on the next failure."}</p>`;
        button.disabled = false;
      }, 1640);
    });

    function finishFailure(message, visible, staged, transactional, diagnosis, envelope, runButton) {
      appendEvent("ERR", `${message} → ${transactional ? "ROLLBACK" : "workflow stops"}`, "failed");
      document.getElementById("atomic-step").textContent = transactional ? "ROLLBACK" : "partial result";
      document.getElementById("alice-visibility").textContent = "committed";
      document.getElementById("bob-visibility").textContent = "committed";

      if (transactional) {
        Object.assign(staged, STARTING_STATE);
        envelope.className = "transaction-envelope rolled-back";
        renderState(STARTING_STATE, "ROLLED BACK", true);
        diagnosis.className = "diagnosis resolved";
        diagnosis.innerHTML = `<span class="diagnosis-label">Atomic outcome</span><p>The error aborted the unit of work. Neither the debit, credit, nor receipt became visible, so the last committed state remains valid.</p>`;
      } else {
        const brokenMoney = visible.alice + visible.bob !== 700;
        envelope.className = "transaction-envelope failed";
        renderState(visible, "PARTIAL COMMIT", false);
        diagnosis.className = "diagnosis warning";
        diagnosis.innerHTML = `<span class="diagnosis-label">Production bug</span><p>${brokenMoney ? "Alice was debited but Bob was never credited: $100 disappeared from the account total." : "The balances moved but no audit receipt exists, so the ledger and account state disagree."} Earlier autocommits cannot be rolled back by the failed statement.</p>`;
      }
      runButton.disabled = false;
    }
  }

  DSL.registerRenderer("acid-foundations", renderAcidFoundations);
})(window.DataSystemsLab);
