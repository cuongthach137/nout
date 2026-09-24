(function initializeCourseCore() {
  "use strict";

  const lessons = [
    { id: "welcome", module: "Start here", number: "00", title: "Course map", minutes: 3 },
    { id: "pages", module: "Storage fundamentals", number: "01", title: "Pages, not rows", minutes: 14 },
    { id: "index-layout", module: "Indexes", number: "02", title: "Physical data layout", minutes: 12 },
    { id: "btree", module: "Indexes", number: "03", title: "Walk a B-tree", minutes: 16 },
    { id: "index-types", module: "Indexes", number: "04", title: "Choose an index", minutes: 15 },
    { id: "access-paths", module: "Indexes", number: "05", title: "Scan strategies", minutes: 18 },
    { id: "index-operations", module: "Indexes", number: "06", title: "Build indexes safely", minutes: 15 },
    { id: "btree-writes", module: "Indexes", number: "07", title: "Keys and page splits", minutes: 14 },
    { id: "bloom", module: "Indexes", number: "08", title: "Bloom filters", minutes: 12 },
    { id: "index-quiz", module: "Indexes", number: "09", title: "Index design challenge", minutes: 10 },
    { id: "planner", module: "Query execution", number: "10", title: "Think like a planner", minutes: 14 },
    { id: "acid-foundations", module: "ACID transactions", number: "11", title: "Atomic by design", minutes: 15 },
    { id: "transactions", module: "ACID transactions", number: "12", title: "Transactions collide", minutes: 16 },
    { id: "mvcc-snapshots", module: "ACID transactions", number: "13", title: "Snapshots & phantoms", minutes: 16 },
    { id: "serializability", module: "ACID transactions", number: "14", title: "Serializable, with retries", minutes: 15 },
    { id: "consistency", module: "ACID transactions", number: "15", title: "Protect invariants", minutes: 14 },
    { id: "durability", module: "ACID transactions", number: "16", title: "Commit, WAL & recovery", minutes: 15 },
    { id: "acid-quiz", module: "ACID transactions", number: "17", title: "ACID incident review", minutes: 10 },
    { id: "replication", module: "Distributed data", number: "18", title: "Replication & lag", minutes: 15 },
    { id: "incident", module: "Production practice", number: "19", title: "Checkout incident", minutes: 12 },
    { id: "tuple-versions", module: "Performance under load", number: "20", title: "Updates create versions", minutes: 15 },
    { id: "vacuum", module: "Performance under load", number: "21", title: "VACUUM & bloat", minutes: 16 },
    { id: "join-algorithms", module: "Performance under load", number: "22", title: "How joins execute", minutes: 17 },
    { id: "memory-spills", module: "Performance under load", number: "23", title: "Memory & disk spills", minutes: 15 },
    { id: "deadlocks", module: "Performance under load", number: "24", title: "Locks & deadlocks", minutes: 15 },
    { id: "partitioning", module: "Performance under load", number: "25", title: "Partitioning & pruning", minutes: 16 },
    { id: "predicate-indexes", module: "Cross-engine indexing", number: "26", title: "Partial & expression indexes", minutes: 17 },
    { id: "specialized-indexes", module: "Cross-engine indexing", number: "27", title: "Specialized index families", minutes: 18 },
    { id: "index-observability", module: "Cross-engine indexing", number: "28", title: "Observe & remove indexes", minutes: 16 },
    { id: "migration-capstone", module: "Cross-engine indexing", number: "29", title: "Cross-engine migration", minutes: 20 },
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
  };

  const elements = {
    root: document.getElementById("lesson-root"),
    nav: document.getElementById("course-nav"),
    toast: document.getElementById("toast"),
  };

  function getLesson(id) {
    return lessons.find((lesson) => lesson.id === id);
  }

  function registerRenderer(id, renderer) {
    if (!getLesson(id)) throw new Error(`Cannot register unknown lesson: ${id}`);
    if (typeof renderer !== "function") throw new TypeError(`Renderer for ${id} must be a function`);
    api.renderers[id] = renderer;
  }

  function lessonHeader(lesson, title, lede, difficulty = "Foundational") {
    return `
      <header class="lesson-header">
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
    getLesson,
    registerRenderer,
    lessonHeader,
    lessonFooter,
    clearTimers,
    setTimer,
    showToast,
  };

  window.DataSystemsLab = api;
})();
