(function registerGuidedEngine(DSL) {
  "use strict";

  // Guided mode: a lesson as a sequence of one-screen "beats". Each beat shows one short prompt,
  // mounts one interactive scene, and unlocks Next when the learner reaches its goal.
  //
  // beat = { id, prompt, why?, continues?, mount(scene, api) → cleanup? }
  // api  = { alive, wait, after, prompt, say, done, lab, restart, state }

  const { reducedMotion, retrigger } = DSL.LabKit;
  let active = null;

  function readSaved(key) {
    const saved = DSL.store.get(key, {}) || {};
    return { index: Number(saved.index) || 0, seen: Number(saved.seen) || 0, done: Array.isArray(saved.done) ? saved.done : [] };
  }

  const writeSaved = (key, value) => DSL.store.set(key, value);

  function run({ lessonId, title, beats, onLab }) {
    const root = DSL.elements.root;
    const key = `guided-${lessonId}`;
    const saved = readSaved(key);
    const done = new Set(saved.done.filter((id) => beats.some((beat) => beat.id === id)));
    const state = {};
    let index = Math.min(Math.max(saved.index, 0), beats.length - 1);
    let seen = Math.max(saved.seen, index);
    let token = 0;
    let cleanup = null;

    root.innerHTML = `<div class="gd">
      <header class="gd-bar">
        <button type="button" class="gd-icon" data-nav-toggle aria-label="Course menu">☰</button>
        <span class="gd-title">${title}</span>
        <ol class="gd-dots" aria-label="Steps">${beats.map((beat, i) => `<li><button type="button" data-beat="${i}" aria-label="Step ${i + 1}"></button></li>`).join("")}</ol>
        ${DSL.modeSwitch(lessonId)}
      </header>
      <div class="gd-prompt-row"><h1 class="gd-prompt" aria-live="polite"></h1><button type="button" class="gd-why-button" aria-expanded="false" aria-label="Why?">?</button></div>
      <p class="gd-why" hidden></p>
      <section class="gd-stage" tabindex="-1"></section>
      <footer class="gd-foot">
        <button type="button" class="gd-nav gd-back" aria-label="Previous step">←</button>
        <p class="gd-say" aria-live="polite"></p>
        <button type="button" class="gd-skip">skip</button>
        <button type="button" class="gd-nav gd-next" disabled>Next →</button>
      </footer>
    </div>`;

    const el = (selector) => root.querySelector(selector);
    const stage = el(".gd-stage");
    const promptEl = el(".gd-prompt");
    const whyButton = el(".gd-why-button");
    const whyEl = el(".gd-why");
    const sayEl = el(".gd-say");
    const next = el(".gd-next");
    const back = el(".gd-back");
    const skip = el(".gd-skip");

    function persist() {
      writeSaved(key, { index, seen, done: [...done] });
    }

    function paintChrome() {
      root.querySelectorAll(".gd-dots button").forEach((dot, i) => {
        dot.className = `${done.has(beats[i].id) ? "done" : ""}${i === index ? " current" : ""}`;
        dot.disabled = i > seen;
      });
      const finished = done.has(beats[index].id);
      next.disabled = !finished || index === beats.length - 1;
      next.classList.toggle("ready", finished && index < beats.length - 1);
      back.disabled = index === 0;
      skip.hidden = finished || index === beats.length - 1;
    }

    function setPrompt(text) {
      promptEl.textContent = text;
      retrigger(promptEl, "gd-prompt-in");
    }

    function say(html, tone = "") {
      sayEl.innerHTML = html || "";
      sayEl.className = `gd-say ${tone}`;
      if (html) retrigger(sayEl, "gd-say-in");
    }

    function makeApi(t) {
      const alive = () => t === token;
      return {
        state,
        alive,
        wait: (ms) => new Promise((resolve) => DSL.setTimer(() => { if (alive()) resolve(); }, reducedMotion() ? Math.min(ms, 80) : ms)),
        after: (promise) => promise.then((value) => (alive() ? value : new Promise(() => {}))),
        prompt: (text) => { if (alive()) setPrompt(text); },
        say: (html, tone) => { if (alive()) say(html, tone); },
        done: (html, tone = "ok") => {
          if (!alive()) return;
          if (html) say(html, tone);
          const first = !done.has(beats[index].id);
          done.add(beats[index].id);
          persist();
          paintChrome();
          if (first) retrigger(next, "gd-next-pop");
        },
        lab: (labId) => { if (onLab) onLab(labId); },
        restart: () => {
          done.clear();
          Object.keys(state).forEach((k) => delete state[k]);
          seen = 0;
          show(0, -1);
        },
      };
    }

    function show(i, direction = 1) {
      token += 1;
      if (cleanup) cleanup();
      cleanup = null;
      index = i;
      seen = Math.max(seen, i);
      persist();
      const beat = beats[i];
      setPrompt(beat.prompt);
      whyEl.hidden = true;
      whyEl.textContent = beat.why || "";
      whyButton.hidden = !beat.why;
      whyButton.setAttribute("aria-expanded", "false");
      say(done.has(beat.id) ? "Done here. Replay it, or press Next." : "");
      paintChrome();

      const old = stage.firstElementChild;
      const scene = document.createElement("div");
      scene.className = "gd-scene";
      stage.appendChild(scene);
      const animate = old && !reducedMotion() && !(direction > 0 && beat.continues);
      if (old) {
        if (animate) {
          old.style.position = "absolute";
          old.style.inset = "0";
          old.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateX(${direction > 0 ? -48 : 48}px)` }], { duration: 220, easing: "ease-in" }).onfinish = () => old.remove();
          scene.animate([{ opacity: 0, transform: `translateX(${direction > 0 ? 48 : -48}px)` }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,.8,.3,1)" });
        } else {
          old.remove();
        }
      }
      cleanup = beat.mount(scene, makeApi(token)) || null;
    }

    function go(delta) {
      const target = index + delta;
      if (target < 0 || target >= beats.length) return;
      show(target, delta);
    }

    next.addEventListener("click", () => go(1));
    back.addEventListener("click", () => go(-1));
    skip.addEventListener("click", () => go(1));
    whyButton.addEventListener("click", () => {
      whyEl.hidden = !whyEl.hidden;
      whyButton.setAttribute("aria-expanded", String(!whyEl.hidden));
    });
    root.querySelector(".gd-dots").addEventListener("click", (event) => {
      const dot = event.target.closest("[data-beat]");
      if (dot && !dot.disabled) show(Number(dot.dataset.beat), Number(dot.dataset.beat) >= index ? 1 : -1);
    });

    active = {
      root,
      key: (event) => {
        if (event.target.closest("input, textarea, select")) return;
        if ((event.key === "ArrowRight" || event.key === "Enter") && !next.disabled && !event.target.closest("button:not(.gd-next)")) {
          event.preventDefault();
          go(1);
        }
        if (event.key === "ArrowLeft" && !back.disabled) go(-1);
      },
    };
    show(index, 1);
  }

  // A teaching beat: an animated visual that advances one short caption per tap.
  // frames = [{ caption, enter(ctx, api) → Promise? }], build(stage) → ctx
  function storyboard(scene, api, { build, frames, doneText = "Got it? Your turn next." }) {
    scene.innerHTML = `<div class="gd-story">
      <div class="gd-story-stage"></div>
      <p class="gd-story-cap" aria-live="polite"></p>
      <div class="gd-story-nav"><span class="gd-pips" aria-hidden="true">${frames.map(() => "<i></i>").join("")}</span><button type="button" class="button primary gd-big gd-story-next">Next frame ▶</button></div>
    </div>`;
    const stage = scene.querySelector(".gd-story-stage");
    const caption = scene.querySelector(".gd-story-cap");
    const button = scene.querySelector(".gd-story-next");
    const pips = [...scene.querySelectorAll(".gd-pips i")];
    const ctx = build(stage) || {};
    let index = -1;
    let busy = false;

    async function step() {
      if (busy || index >= frames.length - 1) return;
      busy = true;
      button.disabled = true;
      index += 1;
      caption.innerHTML = frames[index].caption;
      retrigger(caption, "gd-cap-in");
      pips.forEach((pip, i) => { pip.className = i < index ? "done" : i === index ? "current" : ""; });
      await frames[index].enter(ctx, api);
      if (!api.alive()) return;
      busy = false;
      if (index === frames.length - 1) {
        button.hidden = true;
        api.done(doneText);
        return;
      }
      button.disabled = false;
      button.focus({ preventScroll: true });
    }

    button.addEventListener("click", step);
    stage.addEventListener("click", step);
    step();
  }

  // Shared closing beats: a card-by-card quiz and a finish screen.
  function quizBeat({ questions, passScore = Math.ceil(questions.length * 0.75), onPass }) {
    const { burst } = DSL.LabKit;
    return {
      id: "quiz",
      prompt: `${questions.length} quick calls.`,
      mount(scene, api) {
        let q = 0;
        let right = 0;
        function render() {
          const question = questions[q];
          scene.innerHTML = `<div class="gd-quiz">
            <span class="gd-q-count">${q + 1} / ${questions.length}</span>
            <p class="gd-q">${question.prompt}</p>
            <div class="gd-answers">${question.options.map((option, i) => `<button type="button" class="gd-answer" data-i="${i}">${option}</button>`).join("")}</div>
          </div>`;
          retrigger(scene.querySelector(".gd-quiz"), "gd-card-in");
          scene.querySelectorAll(".gd-answer").forEach((button) => button.addEventListener("click", async () => {
            const correct = Number(button.dataset.i) === question.answer;
            scene.querySelectorAll(".gd-answer").forEach((b) => {
              b.disabled = true;
              if (Number(b.dataset.i) === question.answer) b.classList.add("correct");
            });
            if (correct) {
              right += 1;
              burst(button, { count: 12 });
              api.say("✓ Right.", "ok");
            } else {
              button.classList.add("wrong");
              api.say(`✗ ${question.why}`, "warn");
            }
            await api.wait(correct ? 1000 : 2600);
            q += 1;
            if (q < questions.length) {
              render();
              api.say("");
              return;
            }
            const passed = right >= passScore;
            scene.innerHTML = `<div class="gd-quiz gd-quiz-done"><b>${right} / ${questions.length}</b><span>${passed ? "Passed" : "Replay the steps and try again"}</span></div>`;
            retrigger(scene.querySelector(".gd-quiz"), "gd-card-in");
            if (passed) {
              burst(scene.querySelector(".gd-quiz b"), { count: 20, spread: 80 });
              if (onPass) onPass();
            }
            api.done(`<b>${right} / ${questions.length}</b> right.`);
          }));
        }
        render();
      },
    };
  }

  // next defaults to the lesson after this one in the course order.
  function finishBeat({ lessonId, badges, next }) {
    const { burst } = DSL.LabKit;
    const after = DSL.lessons[DSL.lessons.findIndex((lesson) => lesson.id === lessonId) + 1];
    next = next || (after && after.id);
    return {
      id: "finish",
      prompt: "Lesson done. 🎉",
      mount(scene, api) {
        const completed = DSL.state.completed.has(lessonId);
        scene.innerHTML = `<div class="gd-finish">
          <div class="gd-badges">${badges.map(([icon, title, sub], i) => `<div style="--i:${i}"><span>${icon}</span><b>${title}</b><small>${sub}</small></div>`).join("")}</div>
          <div class="gd-finish-actions">
            <button type="button" class="button primary complete-button ${completed ? "done" : ""}" data-complete="${lessonId}">${completed ? "✓ Completed" : "Mark complete"}</button>
            ${next ? `<a class="button" href="#/${next}">Next lesson →</a>` : ""}
            <button type="button" class="button ghost" data-mode="explore">Open Explore mode</button>
            <button type="button" class="button ghost gd-replay">↺ Replay</button>
          </div>
        </div>`;
        DSL.setTimer(() => burst(scene.querySelector(".gd-badges"), { count: 26, spread: 140 }), 350);
        scene.querySelector(".gd-replay").addEventListener("click", () => api.restart());
        api.done();
      },
    };
  }

  document.addEventListener("keydown", (event) => {
    if (active && active.root.querySelector(".gd")) active.key(event);
  });

  DSL.Guided = Object.freeze({ run, storyboard, quizBeat, finishBeat });
})(window.DataSystemsLab);
