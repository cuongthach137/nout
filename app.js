(function bootCourse(DSL) {
  "use strict";

  function updateProgress() {
    const completable = DSL.lessons.filter((lesson) => lesson.id !== "welcome");
    const completed = completable.filter((lesson) => DSL.state.completed.has(lesson.id)).length;
    const percent = Math.round(completed / completable.length * 100);
    document.getElementById("progress-percent").textContent = `${percent}%`;
    document.getElementById("progress-fill").style.width = `${percent}%`;
  }

  function renderNavigation() {
    const practice = `<section class="nav-module"><p class="nav-module-title">Practice</p>
        ${Object.entries(DSL.pages).map(([id, page]) => {
          const badge = page.badge ? page.badge() : null;
          return `<a href="#/${id}" class="nav-link ${DSL.state.current === id ? "active" : ""}"><span class="nav-number"><span>${page.icon}</span></span><span>${page.title}</span>${badge ? `<em class="nav-due" aria-label="${badge.label}">${badge.count}</em>` : ""}</a>`;
        }).join("")}
      </section>`;
    DSL.elements.nav.innerHTML = practice + DSL.modules().map(({ name: module, lessons }) => `
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
    DSL.Sfx.reset();
    DSL.leave();
    DSL.elements.toast.classList.remove("show");
    const [path, query = ""] = window.location.hash.replace("#/", "").split("?");
    const requested = path || "welcome";
    const params = new URLSearchParams(query);
    const forced = params.get("mode");
    // ?view= shows a mode for this visit only, without changing the learner's saved choice.
    const view = params.get("view");
    // Practice pages (flashcards, the SQL sandbox) aren't lessons: no modes, no progress.
    if (DSL.pages[requested]) {
      DSL.state.current = requested;
      DSL.state.mode = "explore";
      document.body.classList.remove("guided");
      renderNavigation();
      DSL.pages[requested].render();
      window.scrollTo(0, 0);
      setNav(false);
      return;
    }
    DSL.state.current = DSL.renderers[requested] ? requested : "welcome";
    if (forced === "narrated" || forced === "guided" || forced === "explore") {
      DSL.setMode(forced);
      history.replaceState(null, "", `#/${DSL.state.current}`);
    }
    const offered = { narrated: DSL.narrated, guided: DSL.guided, explore: DSL.renderers };
    const mode = view && offered[view] && offered[view][DSL.state.current] ? view : DSL.modeFor(DSL.state.current);
    if (view) history.replaceState(null, "", `#/${DSL.state.current}`);
    DSL.state.mode = mode;
    document.body.classList.toggle("guided", mode !== "explore");
    renderNavigation();
    ({ narrated: DSL.narrated, guided: DSL.guided, explore: DSL.renderers })[mode][DSL.state.current]();
    window.scrollTo(0, 0);
    DSL.elements.root.focus({ preventScroll: true });
    setNav(false);
  }

  // The course menu slides over the page on phones (and in Guided and Narrated modes). A
  // backdrop and a close button dismiss it; so do Esc and picking a lesson.
  function setNav(open) {
    document.querySelector(".sidebar").classList.toggle("open", open);
    document.querySelector(".nav-scrim").hidden = !open;
    document.body.classList.toggle("nav-open", open);
    document.getElementById("menu-button").setAttribute("aria-expanded", String(open));
    if (open) document.querySelector(".nav-close").focus({ preventScroll: true });
  }

  const navIsOpen = () => document.querySelector(".sidebar").classList.contains("open");

  document.addEventListener("click", (event) => {
    const completeButton = event.target.closest("[data-complete]");
    if (completeButton) {
      const id = completeButton.dataset.complete;
      DSL.state.completed.add(id);
      DSL.store.set("completed", [...DSL.state.completed]);
      completeButton.textContent = "✓ Completed";
      completeButton.classList.add("done");
      DSL.Sfx.play("complete");
      renderNavigation();
      DSL.showToast("Lesson completed — progress saved");
    }
    if (event.target.closest("[data-finish]")) DSL.showToast("Course complete — now explain one incident in your own words.");
    const modeButton = event.target.closest("[data-mode]");
    if (modeButton) {
      DSL.setMode(modeButton.dataset.mode);
      route();
    }
    if (event.target.closest("[data-nav-toggle]")) setNav(!navIsOpen());
    if (event.target.closest("[data-nav-close]")) setNav(false);
  });

  document.getElementById("menu-button").addEventListener("click", () => setNav(!navIsOpen()));

  // Sound effects switch (narration has its own mute in the player).
  const soundToggle = document.querySelector("[data-sound]");
  soundToggle.checked = DSL.Sfx.soundOn();
  soundToggle.addEventListener("change", () => {
    DSL.Sfx.setSound(soundToggle.checked);
    if (soundToggle.checked) DSL.Sfx.play("correct", { streak: 1 });
  });

  // Back up / Restore: progress lives in one browser, so let learners carry it elsewhere.
  document.querySelector("[data-backup]").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(DSL.store.exportAll(), null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `data-systems-lab-progress-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    DSL.showToast("Progress backed up. Keep the file somewhere safe.");
  });

  document.querySelector("[data-restore]").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const count = DSL.store.importAll(JSON.parse(await file.text()));
      DSL.showToast(`Restored ${count} saved item${count === 1 ? "" : "s"}. Reloading…`);
      setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      DSL.showToast(error.message.startsWith("That file") ? error.message : "Couldn't read that file. Choose a backup made with Back up.");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navIsOpen()) setNav(false);
  });

  if (DSL.Vocab) DSL.Vocab.onChange = renderNavigation;

  window.addEventListener("hashchange", route);
  renderNavigation();
  route();
})(window.DataSystemsLab);
