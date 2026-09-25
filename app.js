(function bootCourse(DSL) {
  "use strict";

  function groupLessonsByModule() {
    return DSL.lessons.reduce((groups, lesson) => {
      if (!groups[lesson.module]) groups[lesson.module] = [];
      groups[lesson.module].push(lesson);
      return groups;
    }, {});
  }

  function updateProgress() {
    const completable = DSL.lessons.filter((lesson) => lesson.id !== "welcome");
    const completed = completable.filter((lesson) => DSL.state.completed.has(lesson.id)).length;
    const percent = Math.round(completed / completable.length * 100);
    document.getElementById("progress-percent").textContent = `${percent}%`;
    document.getElementById("progress-fill").style.width = `${percent}%`;
  }

  function renderNavigation() {
    DSL.elements.nav.innerHTML = Object.entries(groupLessonsByModule()).map(([module, lessons]) => `
      <section class="nav-module">
        <p class="nav-module-title">${module}</p>
        ${lessons.map((lesson) => `
          <a href="#/${lesson.id}" class="nav-link ${DSL.state.current === lesson.id ? "active" : ""} ${DSL.state.completed.has(lesson.id) ? "completed" : ""}" data-lesson="${lesson.id}">
            <span class="nav-number"><span>${lesson.number}</span></span>
            <span>${lesson.title}</span>
          </a>`).join("")}
      </section>`).join("");
    updateProgress();
  }

  function route() {
    DSL.clearTimers();
    DSL.leave();
    DSL.elements.toast.classList.remove("show");
    const [path, query = ""] = window.location.hash.replace("#/", "").split("?");
    const requested = path || "welcome";
    const forced = new URLSearchParams(query).get("mode");
    DSL.state.current = DSL.renderers[requested] ? requested : "welcome";
    if (forced === "narrated" || forced === "guided" || forced === "explore") {
      DSL.setMode(forced);
      history.replaceState(null, "", `#/${DSL.state.current}`);
    }
    const mode = DSL.modeFor(DSL.state.current);
    document.body.classList.toggle("guided", mode !== "explore");
    renderNavigation();
    ({ narrated: DSL.narrated, guided: DSL.guided, explore: DSL.renderers })[mode][DSL.state.current]();
    window.scrollTo(0, 0);
    DSL.elements.root.focus({ preventScroll: true });
    document.querySelector(".sidebar").classList.remove("open");
    document.getElementById("menu-button").setAttribute("aria-expanded", "false");
  }

  document.addEventListener("click", (event) => {
    const completeButton = event.target.closest("[data-complete]");
    if (completeButton) {
      const id = completeButton.dataset.complete;
      DSL.state.completed.add(id);
      localStorage.setItem("dsl-completed", JSON.stringify([...DSL.state.completed]));
      completeButton.textContent = "✓ Completed";
      completeButton.classList.add("done");
      renderNavigation();
      DSL.showToast("Lesson completed — progress saved");
    }
    if (event.target.closest("[data-finish]")) DSL.showToast("Course complete — now explain one incident in your own words.");
    const modeButton = event.target.closest("[data-mode]");
    if (modeButton) {
      DSL.setMode(modeButton.dataset.mode);
      route();
    }
    if (event.target.closest("[data-nav-toggle]")) {
      const sidebar = document.querySelector(".sidebar");
      const open = sidebar.classList.toggle("open");
      document.getElementById("menu-button").setAttribute("aria-expanded", String(open));
    }
  });

  document.getElementById("menu-button").addEventListener("click", (event) => {
    const sidebar = document.querySelector(".sidebar");
    const open = sidebar.classList.toggle("open");
    event.currentTarget.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") document.querySelector(".sidebar").classList.remove("open");
  });

  window.addEventListener("hashchange", route);
  renderNavigation();
  route();
})(window.DataSystemsLab);
