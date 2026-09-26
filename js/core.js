(function initializeCourseCore() {
  "use strict";

  const lessons = [
    { id: "welcome", module: "Start here", title: "Course map", minutes: 3 },
    { id: "modeling", module: "Start here", title: "One fact, one place", minutes: 14 },
    { id: "pages", module: "Storage fundamentals", title: "Pages, not rows", minutes: 18 },
    { id: "index-layout", module: "Indexes", title: "Physical data layout", minutes: 12 },
    { id: "btree", module: "Indexes", title: "Walk a B-tree", minutes: 16 },
    { id: "index-types", module: "Indexes", title: "Choose an index", minutes: 15 },
    { id: "access-paths", module: "Indexes", title: "Scan strategies", minutes: 18 },
    { id: "index-operations", module: "Indexes", title: "Build indexes safely", minutes: 15 },
    { id: "btree-writes", module: "Indexes", title: "Keys and page splits", minutes: 14 },
    { id: "bloom", module: "Indexes", title: "Bloom filters", minutes: 12 },
    { id: "columnar-lsm", module: "Indexes", title: "Store by question", minutes: 16 },
    { id: "index-quiz", module: "Indexes", title: "Index design challenge", minutes: 10 },
    { id: "planner", module: "Query execution", title: "Think like a planner", minutes: 14 },
    { id: "acid-foundations", module: "ACID transactions", title: "Atomic by design", minutes: 15 },
    { id: "transactions", module: "ACID transactions", title: "Transactions collide", minutes: 16 },
    { id: "mvcc-snapshots", module: "ACID transactions", title: "Snapshots & phantoms", minutes: 16 },
    { id: "serializability", module: "ACID transactions", title: "Serializable, with retries", minutes: 15 },
    { id: "consistency", module: "ACID transactions", title: "Protect invariants", minutes: 14 },
    { id: "durability", module: "ACID transactions", title: "Commit, WAL & recovery", minutes: 15 },
    { id: "acid-quiz", module: "ACID transactions", title: "ACID incident review", minutes: 10 },
    { id: "replication", module: "Distributed data", title: "Replication & lag", minutes: 15 },
    { id: "incident", module: "Production practice", title: "Checkout incident", minutes: 12 },
    { id: "tuple-versions", module: "Performance under load", title: "Updates create versions", minutes: 15 },
    { id: "vacuum", module: "Performance under load", title: "VACUUM & bloat", minutes: 16 },
    { id: "join-algorithms", module: "Performance under load", title: "How joins execute", minutes: 17 },
    { id: "memory-spills", module: "Performance under load", title: "Memory & disk spills", minutes: 15 },
    { id: "deadlocks", module: "Performance under load", title: "Locks & deadlocks", minutes: 15 },
    { id: "partitioning", module: "Performance under load", title: "Partitioning & pruning", minutes: 16 },
    { id: "predicate-indexes", module: "Cross-engine indexing", title: "Partial & expression indexes", minutes: 17 },
    { id: "specialized-indexes", module: "Cross-engine indexing", title: "Specialized index families", minutes: 18 },
    { id: "index-observability", module: "Cross-engine indexing", title: "Observe & remove indexes", minutes: 16 },
    { id: "migration-capstone", module: "Cross-engine indexing", title: "Cross-engine migration", minutes: 20 },
  ];

  function readCompletedLessons() {
    try {
      const stored = JSON.parse(localStorage.getItem("dsl-completed") || "[]");
      return new Set(Array.isArray(stored) ? stored : []);
    } catch (error) {
      console.warn("Could not restore course progress", error);
      return new Set();
    }
  }

  const state = {
    completed: readCompletedLessons(),
    current: "welcome",
    timers: new Set(),
    leaving: new Set(),
  };

  const elements = {
    root: document.getElementById("lesson-root"),
    nav: document.getElementById("course-nav"),
    toast: document.getElementById("toast"),
  };

  // A lesson's number is its position in the list above, so reordering the list renumbers the
  // course. Lesson text refers to other lessons by id through the helpers below, never by number.
  lessons.forEach((lesson, index) => { lesson.number = String(index).padStart(2, "0"); });

  function lessonNumber(id) {
    const lesson = lessons.find((candidate) => candidate.id === id);
    if (!lesson) throw new Error(`Unknown lesson: ${id}`);
    return lesson.number;
  }

  // "Lesson 03"
  function lessonRef(id) {
    return `Lesson ${lessonNumber(id)}`;
  }

  // "Lab 06" or "Lab 06A"
  function labLabel(id, suffix = "") {
    return `Lab ${lessonNumber(id)}${suffix}`;
  }

  function getLesson(id) {
    return lessons.find((lesson) => lesson.id === id);
  }

  function registerRenderer(id, renderer) {
    if (!getLesson(id)) throw new Error(`Cannot register unknown lesson: ${id}`);
    if (typeof renderer !== "function") throw new TypeError(`Renderer for ${id} must be a function`);
    api.renderers[id] = renderer;
  }

  // Guided and Narrated modes: a lesson may register extra renderers beside Explore.
  const MODE_KEY = "dsl-mode";
  const MODES = ["narrated", "guided", "explore"];

  function registerGuided(id, renderer) {
    if (!getLesson(id)) throw new Error(`Cannot register guided mode for unknown lesson: ${id}`);
    api.guided[id] = renderer;
  }

  // A lesson's narration counts as complete once every chapter is written and voiced; only then
  // does Narrated become that lesson's default.
  function registerNarrated(id, renderer, { complete = false } = {}) {
    if (!getLesson(id)) throw new Error(`Cannot register narrated mode for unknown lesson: ${id}`);
    api.narrated[id] = renderer;
    if (complete) api.narratedComplete.add(id);
  }

  // The mode the learner picked with the toggle, or null if they never picked one.
  function getMode() {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      return MODES.includes(saved) ? saved : null;
    } catch (error) {
      return null;
    }
  }

  function setMode(mode) {
    try {
      localStorage.setItem(MODE_KEY, MODES.includes(mode) ? mode : "narrated");
    } catch (error) {
      // The preference is a convenience; the default still works.
    }
  }

  // The mode a lesson actually renders in: the learner's pick if the lesson offers it; otherwise
  // Narrated once its narration is complete, then Guided, then a narration in progress, then Explore.
  function modeFor(id) {
    const picked = getMode();
    if (picked === "explore") return "explore";
    if (picked && (picked === "narrated" ? api.narrated : api.guided)[id]) return picked;
    if (api.narrated[id] && api.narratedComplete.has(id)) return "narrated";
    if (api.guided[id]) return "guided";
    if (api.narrated[id]) return "narrated";
    return "explore";
  }

  function modeSwitch(id) {
    if (!api.guided[id] && !api.narrated[id]) return "";
    const mode = modeFor(id);
    const button = (value, label) => `<button type="button" data-mode="${value}" aria-pressed="${mode === value}">${label}</button>`;
    return `<div class="mode-switch" role="group" aria-label="Lesson mode">${api.narrated[id] ? button("narrated", "🎧 Narrated") : ""}${api.guided[id] ? button("guided", "▶ Guided") : ""}${button("explore", "Explore")}</div>`;
  }

  // Work to stop when the learner leaves the current screen (audio, speech, listeners).
  function onLeave(callback) {
    state.leaving.add(callback);
  }

  function leave() {
    state.leaving.forEach((callback) => callback());
    state.leaving.clear();
  }

  function lessonHeader(lesson, title, lede, difficulty = "Foundational") {
    return `
      <header class="lesson-header">
        ${modeSwitch(lesson.id)}
        <div class="eyebrow">Lesson ${lesson.number} · ${lesson.module}</div>
        <h1>${title}</h1>
        <p class="lede">${lede}</p>
        <div class="lesson-meta">
          <span class="meta-item"><span class="meta-icon">◷</span>${lesson.minutes} minutes</span>
          <span class="meta-item"><span class="meta-icon">↗</span>${difficulty}</span>
          <span class="meta-item"><span class="meta-icon">◉</span>Interactive lab</span>
        </div>
      </header>`;
  }

  function lessonFooter(id) {
    const index = lessons.findIndex((lesson) => lesson.id === id);
    const previous = lessons[index - 1];
    const next = lessons[index + 1];
    const done = state.completed.has(id);
    return `
      <footer class="lesson-footer">
        <div>${previous ? `<a class="button ghost" href="#/${previous.id}">← ${previous.title}</a>` : ""}</div>
        <div class="footer-actions">
          ${id !== "welcome" ? `<button class="button complete-button ${done ? "done" : ""}" data-complete="${id}">${done ? "✓ Completed" : "Mark complete"}</button>` : ""}
          ${next ? `<a class="button primary" href="#/${next.id}">Next: ${next.title} →</a>` : `<button class="button primary" data-finish>Finish course</button>`}
        </div>
      </footer>`;
  }

  function clearTimers() {
    state.timers.forEach((timer) => window.clearTimeout(timer));
    state.timers.clear();
  }

  function setTimer(callback, milliseconds) {
    const timer = window.setTimeout(() => {
      state.timers.delete(timer);
      callback();
    }, milliseconds);
    state.timers.add(timer);
    return timer;
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    setTimer(() => elements.toast.classList.remove("show"), 2600);
  }

  const api = {
    lessons,
    state,
    elements,
    renderers: Object.create(null),
    guided: Object.create(null),
    narrated: Object.create(null),
    narratedComplete: new Set(),
    getLesson,
    lessonNumber,
    lessonRef,
    labLabel,
    registerRenderer,
    registerGuided,
    registerNarrated,
    getMode,
    setMode,
    modeFor,
    modeSwitch,
    onLeave,
    leave,
    lessonHeader,
    lessonFooter,
    clearTimers,
    setTimer,
    showToast,
  };

  window.DataSystemsLab = api;
})();
