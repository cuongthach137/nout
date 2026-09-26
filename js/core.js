(function initializeCourseCore() {
  "use strict";

  const lessons = [
    { id: "welcome", module: "Start here", title: "Course map", minutes: 3 },
    { id: "modeling", module: "Data modeling", title: "One fact, one place", minutes: 14 },
    { id: "select", module: "Writing SQL", title: "SELECT, filter, sort", minutes: 12 },
    { id: "joins", module: "Writing SQL", title: "Join types", minutes: 12 },
    { id: "group", module: "Writing SQL", title: "GROUP BY and HAVING", minutes: 12 },
    { id: "sub", module: "Writing SQL", title: "Subqueries and CTEs", minutes: 12 },
    { id: "window", module: "Writing SQL", title: "Window functions", minutes: 12 },
    { id: "null", module: "Writing SQL", title: "NULL traps", minutes: 12 },
    { id: "pages", module: "Storage", title: "Pages, not rows", minutes: 18 },
    { id: "btree", module: "Storage", title: "Walk a B-tree", minutes: 16 },
    { id: "index-layout", module: "Storage", title: "Physical data layout", minutes: 12 },
    { id: "btree-writes", module: "Storage", title: "Keys and page splits", minutes: 14 },
    { id: "index-types", module: "Indexes", title: "Choose an index", minutes: 15 },
    { id: "access-paths", module: "Indexes", title: "Scan strategies", minutes: 18 },
    { id: "index-operations", module: "Indexes", title: "Build indexes safely", minutes: 15 },
    { id: "bloom", module: "Indexes", title: "Bloom filters", minutes: 12 },
    { id: "index-quiz", module: "Indexes", title: "Index design challenge", minutes: 10 },
    { id: "planner", module: "Query execution", title: "Think like a planner", minutes: 14 },
    { id: "join-algorithms", module: "Query execution", title: "How joins execute", minutes: 17 },
    { id: "memory-spills", module: "Query execution", title: "Memory & disk spills", minutes: 15 },
    { id: "acid-foundations", module: "Transactions", title: "Atomic by design", minutes: 15 },
    { id: "transactions", module: "Transactions", title: "Transactions collide", minutes: 16 },
    { id: "deadlocks", module: "Transactions", title: "Locks & deadlocks", minutes: 15 },
    { id: "mvcc-snapshots", module: "Transactions", title: "Snapshots & phantoms", minutes: 16 },
    { id: "tuple-versions", module: "Transactions", title: "Updates create versions", minutes: 15 },
    { id: "vacuum", module: "Transactions", title: "VACUUM & bloat", minutes: 16 },
    { id: "serializability", module: "Transactions", title: "Serializable, with retries", minutes: 15 },
    { id: "consistency", module: "Transactions", title: "Protect invariants", minutes: 14 },
    { id: "durability", module: "Transactions", title: "Commit, WAL & recovery", minutes: 15 },
    { id: "acid-quiz", module: "Transactions", title: "ACID incident review", minutes: 10 },
    { id: "columnar-lsm", module: "Engines for scale", title: "Store by question", minutes: 16 },
    { id: "partitioning", module: "Engines for scale", title: "Partitioning & pruning", minutes: 16 },
    { id: "replication", module: "Distributed data", title: "Replication & lag", minutes: 15 },
    { id: "incident", module: "Distributed data", title: "Checkout incident", minutes: 12 },
    { id: "predicate-indexes", module: "Electives: engine depth", title: "Partial & expression indexes", minutes: 17 },
    { id: "specialized-indexes", module: "Electives: engine depth", title: "Specialized index families", minutes: 18 },
    { id: "index-observability", module: "Electives: engine depth", title: "Observe & remove indexes", minutes: 16 },
    { id: "migration-capstone", module: "Electives: engine depth", title: "Cross-engine migration", minutes: 20 },
  ];

  // Everything the course saves lives in this browser's localStorage, under "dsl-" keys. All reads
  // and writes go through store, so blocked or full storage never breaks a page, and Back up /
  // Restore can move every key at once. Values are JSON; a few early keys were saved as plain
  // text, so get() falls back to the raw string when a value isn't JSON.
  const STORE_PREFIX = "dsl-";
  const STORE_SCHEMA = 1;
  const store = {
    get(key, fallback) {
      let raw;
      try {
        raw = localStorage.getItem(STORE_PREFIX + key);
      } catch (error) {
        return fallback;
      }
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw);
      } catch (error) {
        return raw;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value));
        return true;
      } catch (error) {
        return false;
      }
    },
    // A backup of every saved key, as a plain object ready to download.
    exportAll() {
      const data = {};
      try {
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (key && key.startsWith(STORE_PREFIX)) data[key] = localStorage.getItem(key);
        }
      } catch (error) {
        // Nothing readable to back up.
      }
      return { app: "data-systems-lab", schema: STORE_SCHEMA, exportedAt: new Date().toISOString(), data };
    },
    // Restore a backup made by exportAll(); returns how many keys were written.
    importAll(backup) {
      if (!backup || backup.app !== "data-systems-lab" || typeof backup.data !== "object") throw new Error("That file isn't a Data Systems Lab backup.");
      let count = 0;
      Object.entries(backup.data).forEach(([key, value]) => {
        if (!key.startsWith(STORE_PREFIX) || typeof value !== "string") return;
        localStorage.setItem(key, value);
        count += 1;
      });
      return count;
    },
  };
  if (store.get("schema", 0) < STORE_SCHEMA) store.set("schema", STORE_SCHEMA);

  function readCompletedLessons() {
    const stored = store.get("completed", []);
    return new Set(Array.isArray(stored) ? stored : []);
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

  // Consecutive lessons that share a module, in course order: [{ name, lessons }].
  function modules(list = lessons) {
    const groups = [];
    list.forEach((lesson) => {
      let group = groups[groups.length - 1];
      if (!group || group.name !== lesson.module) groups.push((group = { name: lesson.module, lessons: [] }));
      group.lessons.push(lesson);
    });
    return groups;
  }

  function getLesson(id) {
    return lessons.find((lesson) => lesson.id === id);
  }

  function registerRenderer(id, renderer) {
    if (!getLesson(id)) throw new Error(`Cannot register unknown lesson: ${id}`);
    if (typeof renderer !== "function") throw new TypeError(`Renderer for ${id} must be a function`);
    api.renderers[id] = renderer;
  }

  // Practice pages (#/<id>) sit beside the lessons: no modes, no numbers, no progress.
  // page = { title, icon, render(), badge?() → { count, label } | null }
  function registerPage(id, page) {
    if (getLesson(id)) throw new Error(`Page id clashes with a lesson: ${id}`);
    api.pages[id] = page;
  }

  // Guided and Narrated modes: a lesson may register extra renderers beside Explore.
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
    const saved = store.get("mode", null);
    return MODES.includes(saved) ? saved : null;
  }

  function setMode(mode) {
    store.set("mode", MODES.includes(mode) ? mode : "narrated");
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
    // The mode on screen right now (a ?view= visit can differ from the saved choice).
    const mode = id === state.current && state.mode ? state.mode : modeFor(id);
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

  // extra: more buttons before "Mark complete" (a quiz's reset button, for example).
  function lessonFooter(id, { extra = "" } = {}) {
    const index = lessons.findIndex((lesson) => lesson.id === id);
    const previous = lessons[index - 1];
    const next = lessons[index + 1];
    const done = state.completed.has(id);
    return `
      <footer class="lesson-footer">
        <div>${previous ? `<a class="button ghost" href="#/${previous.id}">← ${previous.title}</a>` : ""}</div>
        <div class="footer-actions">
          ${extra}
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
    pages: Object.create(null),
    store,
    modules,
    getLesson,
    lessonNumber,
    lessonRef,
    labLabel,
    registerRenderer,
    registerPage,
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
