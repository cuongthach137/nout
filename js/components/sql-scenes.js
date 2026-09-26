(function registerSqlScenes(DSL) {
  "use strict";

  // Building blocks for SQL lessons in Guided and Narrated mode: a query board (code above an
  // animated result grid that runs real queries), FLIP moves, prediction and exercise beats, and
  // the narrated wrapper that reacts to each kind of wrong answer. Lesson files add storyboards.

  const { retrigger, burst, reducedMotion } = DSL.LabKit;
  const hl = (sql) => DSL.Sql.highlight(sql);
  const run = (sql) => DSL.Sql.run("bakery", sql);

  // ---------- Query board: code on top, an animated result grid below ----------

  function cellText(value) {
    if (value === null) return `<i class="sq-null">NULL</i>`;
    if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
    return String(value).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  }

  // build(stage) → board: { code(sql), async show(sql, opts) → result, grid, rows(), col(name) }
  // dataset: which DSL.Sql dataset queries run against (default "bakery").
  function board(stage, { label = "", dataset = "bakery" } = {}) {
    stage.innerHTML = `<div class="sq-board">
      <pre class="sq-code" aria-label="Query" hidden></pre>
      <div class="sq-result"><span class="sq-label">${label}</span><div class="sq-grid" role="table"></div></div>
    </div>`;
    const codeEl = stage.querySelector(".sq-code");
    const grid = stage.querySelector(".sq-grid");
    const labelEl = stage.querySelector(".sq-label");
    let columns = [];

    function code(sql, { type = false } = {}) {
      codeEl.hidden = !sql;
      if (!type || reducedMotion()) {
        codeEl.innerHTML = hl(sql);
        retrigger(codeEl, "sq-code-in");
        return Promise.resolve();
      }
      // Type it out, a few characters per frame.
      return new Promise((resolve) => {
        let at = 0;
        const step = () => {
          if (!codeEl.isConnected) return resolve();
          at = Math.min(sql.length, at + 3);
          codeEl.innerHTML = `${hl(sql.slice(0, at))}<i class="sq-caret"></i>`;
          if (at < sql.length) window.setTimeout(step, 24);
          else { codeEl.innerHTML = hl(sql); resolve(); }
        };
        step();
      });
    }

    function paint(result, { mark } = {}) {
      columns = result.columns;
      grid.style.setProperty("--cols", String(columns.length));
      grid.innerHTML = `<div class="sq-row sq-head" role="row">${columns.map((c) => `<span role="columnheader" data-col="${c}">${c}</span>`).join("")}</div>`
        + result.rows.map((row, i) => `<div class="sq-row${mark && mark(row) ? ` ${mark(row)}` : ""}" role="row" data-i="${i}" style="--i:${i}">${row.map((v, j) => `<span role="cell" data-col="${columns[j]}">${cellText(v)}</span>`).join("")}</div>`).join("");
      retrigger(grid, "sq-grid-in");
    }

    async function show(sql, options = {}) {
      const result = await DSL.Sql.run(dataset, sql);
      if (result.error) {
        grid.innerHTML = `<p class="sq-err">${result.error}</p>`;
        return result;
      }
      if (options.label !== undefined) labelEl.textContent = options.label;
      paint(result, options);
      return result;
    }

    return {
      stage,
      grid,
      code,
      show,
      paint,
      label: (text) => { labelEl.textContent = text; retrigger(labelEl, "gd-pop"); },
      rows: () => [...grid.querySelectorAll(".sq-row:not(.sq-head)")],
      cells: (name) => [...grid.querySelectorAll(`[data-col="${name}"]`)],
      columns: () => columns,
    };
  }

  // Move elements with a FLIP animation after `change()` rearranges them.
  function flip(elements, change, duration = 520) {
    const before = new Map(elements.map((el) => [el, el.getBoundingClientRect()]));
    change();
    if (reducedMotion()) return Promise.resolve();
    const animations = elements.map((el) => {
      const a = before.get(el);
      const b = el.getBoundingClientRect();
      return el.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: "none" }], { duration, easing: "cubic-bezier(.2,.8,.3,1)" }).finished.catch(() => {});
    });
    return Promise.all(animations);
  }


  // ---------- Beats ----------

  // A question with buttons, then a reveal. Events: predict { key, right }.
  function predictBeat({ id, prompt, why, question, options, answer, explain, reveal }) {
    return {
      id,
      prompt,
      why,
      mount(scene, api) {
        scene.innerHTML = `<div class="sq-predict">
          <div class="sq-predict-q">${question}</div>
          <div class="sq-choices">${options.map(([key, label], i) => `<button type="button" class="sq-chip big" data-key="${key}" style="--i:${i}">${label}</button>`).join("")}</div>
          <div class="sq-reveal"></div>
        </div>`;
        scene.querySelector(".sq-choices").addEventListener("click", async (event) => {
          const chip = event.target.closest("[data-key]");
          if (!chip) return;
          const right = chip.dataset.key === answer;
          scene.querySelectorAll(".sq-chip").forEach((c) => {
            c.disabled = true;
            if (c.dataset.key === answer) c.classList.add("correct");
          });
          DSL.Sfx.play(right ? "correct" : "wrong");
          if (!right) chip.classList.add("wrong");
          else burst(chip, { count: 12 });
          api.event("predict", { key: chip.dataset.key, right });
          if (reveal) await api.after(reveal(scene.querySelector(".sq-reveal"), api));
          api.done(explain[right ? "right" : "wrong"], right ? "ok" : "warn");
        });
      },
    };
  }

  // A written exercise. Events: result { reason }; done when it matches.
  function challengeBeat({ id, prompt, why, task, starter, solution, ordered = false, dataset = "bakery", probe = null }) {
    return {
      id,
      prompt,
      why,
      mount(scene, api) {
        scene.innerHTML = `<div class="sq-challenge"><p class="sq-task">${task}</p><div class="sq-challenge-lab"></div></div>`;
        const lab = DSL.Sql.lab(scene.querySelector(".sq-challenge-lab"), {
          dataset,
          starter,
          solution,
          ordered,
          probe,
          showGoal: false,
          onResult: (result, verdict) => api.event("result", { reason: verdict ? verdict.reason : "none" }),
        });
        lab.passed.then(() => api.done("That's it. ✓"));
        window.setTimeout(() => { if (scene.isConnected) lab.element.querySelector(".sql-input").focus({ preventScroll: true }); }, 400);
      },
    };
  }


  // A storyboard beat, and a run of a storyboard's frames (each frame sets up its own state).
  const teach = (id, prompt, story, why) => ({ id, prompt, why, mount: (scene, api) => DSL.Guided.storyboard(scene, api, story) });
  const slice = (story, from, to) => ({ build: story.build, frames: story.frames.slice(from, to) });

  // ---------- Narrated exercise ----------

  // Mount an exercise beat and wait for a match, reacting to wrong runs without talking over the
  // learner. Lines: <chapter>.1, .ask, .hint, .done, and one per reaction (default: error, extra,
  // missing, columns, order; pass `reactions` to use fewer).
  const REASON_LINE = { error: "error", timeout: "error", extra: "extra", duplicates: "extra", missing: "missing", rows: "missing", columns: "columns", order: "order" };
  async function exercise(n, beat, chapter, { reactions = ["error", "extra", "missing", "columns", "order"], before = [] } = {}) {
    const speak = Object.fromEntries(reactions.map((line) => [line, DSL.Narrator.throttled(n, `${chapter}.${line}`, 2500)]));
    const done = n.mount(beat, {
      onEvent(name, data) {
        const line = name === "result" && REASON_LINE[data.reason];
        if (line && speak[line]) speak[line]();
      },
    });
    await n.say(`${chapter}.1`);
    for (const line of before) await n.say(`${chapter}.${line}`);
    await n.say(`${chapter}.ask`);
    await n.ask(done, { hint: `${chapter}.hint`, highlight: ".sql-editor" });
    await n.say(`${chapter}.done`);
  }

  DSL.SqlScenes = Object.freeze({ board, flip, cellText, predictBeat, challengeBeat, teach, slice, exercise });
})(window.DataSystemsLab);
