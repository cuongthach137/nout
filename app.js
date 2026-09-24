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
    DSL.elements.toast.classList.remove("show");
    const requested = window.location.hash.replace("#/", "") || "welcome";
    DSL.state.current = DSL.renderers[requested] ? requested : "welcome";
    renderNavigation();
    DSL.renderers[DSL.state.current]();
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
  });

  document.getElementById("menu-button").addEventListener("click", (event) => {
    const sidebar = document.querySelector(".sidebar");
    const open = sidebar.classList.toggle("open");
    event.currentTarget.setAttribute("aria-expanded", String(open));
  });

  window.addEventListener("hashchange", route);
  renderNavigation();
  route();
})(window.DataSystemsLab);
