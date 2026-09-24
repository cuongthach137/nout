(function registerEngineLensComponent(DSL) {
  "use strict";

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function render({ id, title, copy }) {
    return `<section class="lab engine-lens" id="${id}">
      <div class="lab-top"><div><span class="lab-kicker">Engine lens · compare implementations</span><h2>${title}</h2><p class="lab-copy">${copy}</p></div><span class="lab-badge">PostgreSQL 18 · MySQL 8.4 · SQLite 3.x</span></div>
      <div class="engine-levels" aria-label="Learning progression"><span>1 · portable model</span><span>2 · implementation</span><span>3 · production evidence</span><span>4 · prediction</span></div>
      <div class="engine-tabs" role="tablist" aria-label="Database engine"></div>
      <div class="engine-body" aria-live="polite"></div>
    </section>`;
  }

  function renderDiagram(engine, activeStep) {
    return `<div class="engine-diagram">${engine.diagram.map((node, index) => `${index ? '<span class="engine-arrow">→</span>' : ""}<div class="engine-node ${index <= activeStep ? "active" : ""}"><small>${escapeHTML(node.kicker || `stage ${index + 1}`)}</small><strong>${escapeHTML(node.label)}</strong><span>${escapeHTML(node.detail || "")}</span></div>`).join("")}</div>`;
  }

  function renderBody(engine, activeStep) {
    const step = engine.steps[activeStep];
    const source = engine.source ? `<a class="engine-source" href="${engine.source.url}" target="_blank" rel="noreferrer">Official ${escapeHTML(engine.source.label)} ↗</a>` : "";
    return `<div class="engine-identity"><div><span>${escapeHTML(engine.version)}</span><strong>${escapeHTML(engine.mechanism)}</strong></div><code>${escapeHTML(engine.signature)}</code></div>
      <div class="engine-implementation">
        <div class="engine-trace">
          ${renderDiagram(engine, activeStep)}
          <div class="engine-step"><div><small>Step ${activeStep + 1} of ${engine.steps.length}</small><strong>${escapeHTML(step.title)}</strong><p>${escapeHTML(step.copy)}</p></div><div><button class="button ghost" type="button" data-engine-step="previous" ${activeStep === 0 ? "disabled" : ""}>←</button><button class="button" type="button" data-engine-step="next" ${activeStep === engine.steps.length - 1 ? "disabled" : ""}>Next →</button></div></div>
        </div>
        <div class="engine-counters">${engine.counters.map((counter) => `<div><span>${escapeHTML(counter.label)}</span><strong>${escapeHTML(counter.value)}</strong><small>${escapeHTML(counter.note || "modeled")}</small></div>`).join("")}</div>
      </div>
      <div class="engine-production"><div><span class="engine-level-tag">3 · Production evidence</span><h3>${escapeHTML(engine.incident.title)}</h3><p>${escapeHTML(engine.incident.copy)}</p>${source}</div><pre><code>${escapeHTML(engine.incident.evidence)}</code></pre></div>
      <div class="engine-challenge"><span class="engine-level-tag">4 · Predict before revealing</span><h3>${escapeHTML(engine.challenge.prompt)}</h3><div class="engine-challenge-options">${engine.challenge.options.map((option, index) => `<button type="button" data-engine-answer="${index}">${escapeHTML(option)}</button>`).join("")}</div><p class="engine-challenge-feedback" data-engine-feedback>Choose the outcome your mental model predicts.</p></div>`;
  }

  function mount(id, config) {
    const root = document.getElementById(id);
    if (!root) throw new Error(`EngineLens target not found: ${id}`);
    if (!Array.isArray(config.engines) || config.engines.length < 2) throw new TypeError("EngineLens requires at least two engines");

    let selectedEngine = config.engines[0].id;
    let activeStep = 0;

    function getEngine() {
      return config.engines.find((engine) => engine.id === selectedEngine);
    }

    function draw() {
      root.querySelector(".engine-tabs").innerHTML = config.engines.map((engine) => `<button type="button" role="tab" aria-selected="${engine.id === selectedEngine}" class="engine-tab ${engine.id === selectedEngine ? "active" : ""}" data-engine="${engine.id}"><strong>${escapeHTML(engine.label)}</strong><span>${escapeHTML(engine.version)}</span></button>`).join("");
      root.querySelector(".engine-body").innerHTML = renderBody(getEngine(), activeStep);
    }

    root.addEventListener("click", (event) => {
      const engineButton = event.target.closest("[data-engine]");
      if (engineButton) {
        selectedEngine = engineButton.dataset.engine;
        activeStep = 0;
        draw();
        return;
      }

      const stepButton = event.target.closest("[data-engine-step]");
      if (stepButton) {
        activeStep += stepButton.dataset.engineStep === "next" ? 1 : -1;
        activeStep = Math.max(0, Math.min(getEngine().steps.length - 1, activeStep));
        draw();
        return;
      }

      const answerButton = event.target.closest("[data-engine-answer]");
      if (!answerButton) return;
      const engine = getEngine();
      const selected = Number(answerButton.dataset.engineAnswer);
      root.querySelectorAll("[data-engine-answer]").forEach((button) => {
        const answer = Number(button.dataset.engineAnswer);
        button.classList.toggle("correct", answer === engine.challenge.answer);
        button.classList.toggle("wrong", answer === selected && selected !== engine.challenge.answer);
      });
      const feedback = root.querySelector("[data-engine-feedback]");
      const correct = selected === engine.challenge.answer;
      feedback.className = `engine-challenge-feedback ${correct ? "correct" : "wrong"}`;
      feedback.textContent = `${correct ? "Correct. " : "Not quite. "}${engine.challenge.why}`;
    });

    draw();
  }

  DSL.EngineLens = Object.freeze({ render, mount });
})(window.DataSystemsLab);
