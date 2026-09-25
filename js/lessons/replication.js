(function registerReplicationLesson(DSL) {
  "use strict";

  function renderReplication() {
    const lesson = DSL.getLesson("replication");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "Copies improve availability—and create time gaps.", "Replication sends a stream of changes from one node to others. Until a follower catches up, different nodes can truthfully return different answers.", "Intermediate")}
      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Lab 20 · distributed consistency</span><h2>Observe replication lag</h2><p class="lab-copy">Write a new profile name to the leader. Adjust network lag, then read from a follower before or after the update arrives.</p></div><span class="lab-badge">leader → followers</span></div>
        <div class="controls"><div class="control grow"><label for="replication-lag">Follower lag: <span class="range-value" id="lag-value">1.5s</span></label><input id="replication-lag" type="range" min="0" max="5" step="0.5" value="1.5"></div><button class="button primary" id="write-leader">Write “Ari v2”</button><button class="button" id="read-follower">Read follower B</button></div>
        <div class="viz-stage"><svg class="replication-lines" aria-hidden="true"><line x1="20%" y1="50%" x2="50%" y2="50%"/><line x1="50%" y1="50%" x2="80%" y2="50%"/></svg><div class="replica-scene"><div class="replica leader"><div class="replica-icon">L</div><h3>Leader</h3><small>accepts writes</small><div class="log-value">name = <strong id="leader-value">Ari</strong></div></div><div class="replica"><div class="replica-icon">A</div><h3>Follower A</h3><small>async replica</small><div class="log-value">name = <strong id="follower-a-value">Ari</strong></div></div><div class="replica"><div class="replica-icon">B</div><h3>Follower B</h3><small>async replica</small><div class="log-value">name = <strong id="follower-b-value">Ari</strong></div></div></div></div>
        <div class="lag-meter"><div class="lag-head"><span id="replica-status" aria-live="polite">All replicas are current</span><span id="log-position">log position 0</span></div><div class="progress-track light"><div class="progress-fill" id="replica-progress"></div></div></div>
      </section>

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Production drill</span><strong>“I saved my address, but checkout shows the old one.”</strong><span class="severity">consistency</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Symptom → read routing</span><h2>Design a read-your-writes path</h2><p class="lab-copy">The profile write commits on the leader, then checkout immediately reads through a replica pool. Choose a routing policy and run the user journey under lag.</p></div><span class="lab-badge">save → checkout</span></div>
        <div class="controls"><div class="control grow"><label for="routing-strategy">Routing policy</label><select id="routing-strategy"><option value="nearest">Nearest replica · eventual</option><option value="leader">Leader for session after write</option><option value="token">Carry commit position · wait for replica</option></select></div><div class="control"><label for="journey-lag">Replica lag: <span id="journey-lag-value" class="range-value">2.0s</span></label><input id="journey-lag" type="range" min="0" max="5" step="0.5" value="2"></div><button class="button primary" id="run-user-journey">Save, then checkout</button></div>
        <div class="journey-flow" aria-live="polite"><div class="journey-step"><small>1 · write</small><strong id="journey-write">new address</strong></div><span>→</span><div class="journey-step"><small>2 · router</small><strong id="journey-route">waiting</strong></div><span>→</span><div class="journey-step"><small>3 · read</small><strong id="journey-read">—</strong></div><span>→</span><div class="journey-step"><small>4 · checkout</small><strong id="journey-result">—</strong></div></div>
        <div class="metric-grid compact"><div class="metric"><span>Freshness</span><strong id="journey-freshness">—</strong><small>did the read include the write?</small></div><div class="metric"><span>User-visible wait</span><strong id="journey-wait">—</strong><small>simplified routing latency</small></div><div class="metric"><span>Leader pressure</span><strong id="journey-load">—</strong><small>trade-off of the policy</small></div></div>
        <div class="diagnosis" id="journey-diagnosis"><span class="diagnosis-label">Architecture choice</span><p>Run the journey. “Eventually correct” can still be a product bug when one user immediately reads their own write.</p></div>
      </section>

      <section class="concept-grid">
        <div class="concept-card"><span class="concept-number">read-after-write</span><h3>Your write should stick</h3><p>Route a user’s own reads to the leader or track the minimum log position they must observe.</p></div>
        <div class="concept-card"><span class="concept-number">monotonic reads</span><h3>Time should not reverse</h3><p>Pin a user to one replica so a newer value is not followed by an older one.</p></div>
        <div class="concept-card"><span class="concept-number">eventual</span><h3>Convergence takes time</h3><p>If writes stop and communication continues, replicas eventually agree.</p></div>
      </section>
      ${DSL.lessonFooter("replication")}
    </article>`;
    setupReplicationLab();
    setupReadRoutingLab();
  }

  function setupReplicationLab() {
    let version = 1;
    let pending = false;
    const lag = document.getElementById("replication-lag");
    const updateLag = () => { document.getElementById("lag-value").textContent = `${Number(lag.value).toFixed(1)}s`; };
    lag.addEventListener("input", updateLag);
    updateLag();

    document.getElementById("write-leader").addEventListener("click", () => {
      DSL.clearTimers();
      pending = true;
      version += 1;
      document.getElementById("leader-value").textContent = "Ari v2";
      document.getElementById("replica-status").textContent = "Replicating log entry…";
      document.getElementById("log-position").textContent = `leader at ${version} · followers at ${version - 1}`;
      document.getElementById("replica-progress").style.width = "18%";
      document.querySelectorAll(".replication-lines line").forEach((line) => line.classList.add("flowing"));
      const delay = Number(lag.value) * 1000;
      DSL.setTimer(() => {
        document.getElementById("follower-a-value").textContent = "Ari v2";
        document.getElementById("replica-progress").style.width = "60%";
      }, delay * 0.6);
      DSL.setTimer(() => {
        pending = false;
        document.getElementById("follower-b-value").textContent = "Ari v2";
        document.getElementById("replica-progress").style.width = "100%";
        document.getElementById("replica-status").textContent = "All replicas caught up";
        document.getElementById("log-position").textContent = `all nodes at ${version}`;
        document.querySelectorAll(".replication-lines line").forEach((line) => line.classList.remove("flowing"));
      }, delay || 50);
    });

    document.getElementById("read-follower").addEventListener("click", () => {
      const value = document.getElementById("follower-b-value").textContent;
      DSL.showToast(pending ? `Follower B returned stale data: “${value}”` : `Follower B returned current data: “${value}”`);
    });
  }

  function setupReadRoutingLab() {
    const lag = document.getElementById("journey-lag");
    const updateLag = () => { document.getElementById("journey-lag-value").textContent = `${Number(lag.value).toFixed(1)}s`; };
    lag.addEventListener("input", updateLag);
    updateLag();

    document.getElementById("run-user-journey").addEventListener("click", () => {
      DSL.clearTimers();
      const strategy = document.getElementById("routing-strategy").value;
      const seconds = Number(lag.value);
      const stale = strategy === "nearest" && seconds > 0;
      const route = strategy === "nearest" ? "nearest follower" : strategy === "leader" ? "session → leader" : `wait for LSN +${seconds.toFixed(1)}s`;
      const source = strategy === "leader" ? "leader" : "follower B";
      const wait = strategy === "token" ? Math.round(seconds * 1000 + 12) : strategy === "leader" ? 38 : 12;
      const load = strategy === "leader" ? "higher" : "low";
      const button = document.getElementById("run-user-journey");
      button.disabled = true;
      document.getElementById("journey-route").textContent = "routing…";
      document.getElementById("journey-read").textContent = "—";
      document.getElementById("journey-result").textContent = "—";
      ["journey-freshness", "journey-wait", "journey-load"].forEach((id) => { document.getElementById(id).textContent = "…"; });
      DSL.setTimer(() => { document.getElementById("journey-route").textContent = route; }, 320);
      DSL.setTimer(() => { document.getElementById("journey-read").textContent = `${source}: ${stale ? "old" : "new"}`; }, 700);
      DSL.setTimer(() => {
        button.disabled = false;
        document.getElementById("journey-result").textContent = stale ? "wrong address" : "new address ✓";
        document.getElementById("journey-freshness").textContent = stale ? "STALE" : "CURRENT";
        document.getElementById("journey-freshness").style.color = stale ? "var(--coral)" : "var(--green)";
        document.getElementById("journey-wait").textContent = `${wait.toLocaleString()} ms`;
        document.getElementById("journey-load").textContent = load;
        const diagnosis = document.getElementById("journey-diagnosis");
        diagnosis.className = `diagnosis ${stale ? "warning" : "resolved"}`;
        const details = strategy === "nearest"
          ? "The random replica has not applied the commit yet. Cheap, eventually consistent reads violate this user journey’s read-your-writes expectation."
          : strategy === "leader"
            ? "Session stickiness makes the write immediately visible. Bound the stickiness window so every reader does not permanently load the leader."
            : "The commit position becomes a consistency token. The replica serves the read only after reaching it; freshness is explicit, but lag becomes user-visible waiting.";
        diagnosis.innerHTML = `<span class="diagnosis-label">${stale ? "Root cause" : "Observable fix"}</span><p>${details}</p>`;
      }, 1100);
    });
  }

  DSL.registerRenderer("replication", renderReplication);
})(window.DataSystemsLab);
