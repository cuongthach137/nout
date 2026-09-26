(function registerLabKit(DSL) {
  "use strict";

  // Shared lesson furniture: collapsible asides, per-lab progress, and small motion helpers.

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // Restart a one-shot CSS animation class on an element.
  function retrigger(el, className) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
  }

  // A lab's status line: message text, plus an optional "warn" or "ok" tone.
  function setStatus(el, message, tone) {
    el.textContent = message;
    el.classList.remove("warn", "ok");
    if (tone) el.classList.add(tone);
  }

  function wonder(question, answer) {
    return `<details class="wonder"><summary><span>Wait, what?</span>${question}</summary><p>${answer}</p></details>`;
  }

  function stamp() {
    return `<span class="lab-stamp" aria-hidden="true">✓ lab done</span>`;
  }

  function labSide(badge) {
    return `<div class="lab-side"><span class="lab-badge">${badge}</span>${stamp()}</div>`;
  }

  // Per-lab progress: a checklist under the header, a stamp on each lab section (#lab-<id>),
  // saved per browser, and a nudge on "Mark complete" once every lab is done.
  function createProgress({ lessonId, labs, storageKey }) {
    // DSL.store adds the "dsl-" prefix; older call sites pass the full key.
    const key = (storageKey || `labs-${lessonId}`).replace(/^dsl-/, "");
    const ids = labs.map((lab) => lab.id);
    const names = Object.fromEntries(labs.map((lab) => [lab.id, lab.name]));
    let done = new Set();
    let root = null;

    function read() {
      const stored = DSL.store.get(key, []);
      return new Set(Array.isArray(stored) ? stored.filter((id) => ids.includes(id)) : []);
    }

    const save = () => DSL.store.set(key, [...done]);

    function completeButton() {
      return document.querySelector(`[data-complete="${lessonId}"]`);
    }

    function onScreen() {
      return Boolean(root && root.isConnected);
    }

    function paint() {
      if (!onScreen()) return;
      root.querySelector("[data-lab-count]").textContent = `${done.size} / ${ids.length} labs`;
      ids.forEach((id) => {
        const finished = done.has(id);
        root.querySelector(`.lc-item[data-goto="${id}"]`).classList.toggle("done", finished);
        const section = document.getElementById(`lab-${id}`);
        if (section) section.classList.toggle("is-done", finished);
      });
    }

    function markup() {
      return `<nav class="lab-checklist" aria-label="Lesson labs">
        <strong data-lab-count>0 / ${ids.length} labs</strong>
        ${labs.map((lab) => `<button type="button" class="lc-item" data-goto="${lab.id}"><i aria-hidden="true"></i>${lab.name}</button>`).join("")}
        <button type="button" class="lc-reset">reset</button>
      </nav>`;
    }

    function mount() {
      root = document.querySelector(".lab-checklist");
      done = read();
      root.addEventListener("click", (event) => {
        const item = event.target.closest("[data-goto]");
        if (item) document.getElementById(`lab-${item.dataset.goto}`).scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
        if (event.target.closest(".lc-reset")) {
          done.clear();
          save();
          paint();
          const button = completeButton();
          if (button) button.classList.remove("nudge");
        }
      });
      paint();
    }

    function complete(id) {
      if (!onScreen()) done = read();
      retrigger(document.getElementById(`lab-${id}`), "ding");
      if (done.has(id)) return;
      done.add(id);
      save();
      paint();
      if (onScreen()) retrigger(root.querySelector(`.lc-item[data-goto="${id}"]`), "ping");
      if (done.size === ids.length) {
        const button = completeButton();
        if (button && !button.classList.contains("done")) button.classList.add("nudge");
        DSL.showToast(`All ${ids.length} labs done. Mark the lesson complete to save it to your course progress.`);
      } else {
        DSL.showToast(`${names[id]} done · ${done.size} of ${ids.length} labs`);
      }
    }

    return { markup, mount, complete };
  }

  // Fly a copy of `source` along an arc into `target`'s box. Resolves when it lands.
  function fly(source, target, { duration = 650, lift = 70, className = "", html } = {}) {
    if (!source || !target || reducedMotion()) return Promise.resolve();
    const from = source.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const ghost = source.cloneNode(true);
    if (html !== undefined) ghost.innerHTML = html;
    ghost.removeAttribute("id");
    ghost.classList.add("kit-flyer");
    if (className) className.split(" ").forEach((name) => ghost.classList.add(name));
    Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    document.body.appendChild(ghost);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const sx = to.width / from.width;
    const sy = to.height / from.height;
    const animation = ghost.animate([
      { transform: "translate(0, 0) scale(1) rotate(0deg)", offset: 0 },
      { transform: `translate(${dx * 0.1}px, ${dy * 0.1 - lift * 0.6}px) scale(1.08) rotate(-4deg)`, offset: 0.2 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - lift}px) scale(${(1 + sx) / 2 + 0.06}, ${(1 + sy) / 2 + 0.06}) rotate(3deg)`, offset: 0.6 },
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(0deg)`, offset: 1 },
    ], { duration, easing: "cubic-bezier(.45,.05,.35,1)", fill: "forwards" });
    return animation.finished.then(() => ghost.remove(), () => ghost.remove());
  }

  // Confetti-ish sparks from the centre of an element.
  function burst(el, { count = 10, colors = ["var(--lime)", "var(--green)", "var(--amber)"], spread = 46 } = {}) {
    if (!el || reducedMotion()) return;
    const rect = el.getBoundingClientRect();
    for (let i = 0; i < count; i += 1) {
      const spark = document.createElement("i");
      spark.className = "kit-spark";
      spark.style.left = `${rect.left + rect.width / 2}px`;
      spark.style.top = `${rect.top + rect.height / 2}px`;
      spark.style.background = colors[i % colors.length];
      document.body.appendChild(spark);
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const distance = spread * (0.6 + Math.random() * 0.6);
      spark.animate([
        { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) scale(.2)`, opacity: 0 },
      ], { duration: 520 + Math.random() * 200, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => spark.remove();
    }
  }

  // A short label that rises off an element and fades, like "+8 ms".
  function floater(el, text, tone = "") {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const tag = document.createElement("span");
    tag.className = `kit-floater ${tone}`;
    tag.textContent = text;
    tag.style.left = `${rect.left + rect.width / 2}px`;
    tag.style.top = `${rect.top}px`;
    document.body.appendChild(tag);
    if (reducedMotion()) {
      DSL.setTimer(() => tag.remove(), 700);
      return;
    }
    tag.animate([
      { transform: "translate(-50%, 0) scale(.7)", opacity: 0 },
      { transform: "translate(-50%, -14px) scale(1.1)", opacity: 1, offset: 0.25 },
      { transform: "translate(-50%, -38px) scale(1)", opacity: 0 },
    ], { duration: 950, easing: "ease-out" }).onfinish = () => tag.remove();
  }

  // Count a number up (or down) inside an element.
  function countTo(el, value, { duration = 600, format = (n) => String(Math.round(n)) } = {}) {
    if (!el) return;
    const start = Number(el.dataset.value || 0);
    el.dataset.value = String(value);
    if (reducedMotion() || start === value) {
      el.textContent = format(value);
      return;
    }
    const began = performance.now();
    const step = (now) => {
      if (!el.isConnected || el.dataset.value !== String(value)) return;
      const t = Math.min(1, (now - began) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(start + (value - start) * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  DSL.LabKit = Object.freeze({ setStatus, reducedMotion, retrigger, wonder, stamp, labSide, createProgress, fly, burst, floater, countTo });
})(window.DataSystemsLab);
